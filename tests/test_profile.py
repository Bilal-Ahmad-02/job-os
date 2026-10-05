import json
import sqlite3
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from pydantic import TypeAdapter, ValidationError

from app.db.store import SCHEMA_VERSION, identity_path, open_store
from app.db.workspace import initialize_workspace, prepare_workspace
from app.schemas.desktop import DesktopRequest
from app.schemas.profile import (
    CandidateData,
    Certification,
    Education,
    Experience,
    Preferences,
    ProfileSaveRequest,
    Project,
    Skill,
)
from app.services.backup_snapshot import (
    DATABASE,
    MANIFEST,
    digest,
    snapshot_workspace,
    verify_snapshot,
)
from app.services.profile import ProfileConflict, get_profile, save_profile


def sample():
    return CandidateData(
        full_name="Synthetic Candidate",
        headline="Example engineer",
        experience=[
            Experience(
                id=uuid4(),
                role="Engineer",
                organization="Example",
                start_month="2022-01",
                current=True,
            )
        ],
        education=[
            Education(id=uuid4(), institution="Example Institute", qualification="Example course")
        ],
        skills=[Skill(id=uuid4(), name="Python", category="Programming")],
        projects=[Project(id=uuid4(), name="Synthetic project", technologies=["Python"])],
        certifications=[
            Certification(id=uuid4(), name="Example credential", issuer="Example issuer")
        ],
        preferences=Preferences(
            target_roles=["Engineer"],
            locations=["Example city"],
            work_modes=["hybrid"],
            constraints="Synthetic constraint",
            excluded_employers=["Synthetic agency"],
            excluded_keywords=["commission only"],
        ),
    )


def save(engine, version, data):
    data = CandidateData.model_validate_json(data.model_dump_json())
    return save_profile(
        engine, ProfileSaveRequest(action="profile_save", version=version, data=data)
    )


def test_read_is_empty_and_does_not_create_profile_then_round_trips(tmp_path):
    path = tmp_path / DATABASE
    engine = initialize_workspace(path)
    try:
        empty = get_profile(engine)
        assert empty.version == 0 and empty.data == CandidateData()
        with sqlite3.connect(path) as connection:
            assert connection.execute("SELECT COUNT(*) FROM candidate_profile").fetchone() == (0,)
        data = sample()
        saved = save(engine, 0, data)
        assert saved.version == 1 and saved.data == data
        assert saved.evidence_status == "user_provided"
        assert saved.data.education[0].completion == "unspecified"
        assert save(engine, 0, data) == saved  # Lost response: idempotent retry.
        assert save(engine, 1, data) == saved  # No-op save retains revision/time.
    finally:
        engine.dispose()
    reopened = open_store(path)
    try:
        assert get_profile(reopened) == saved
    finally:
        reopened.dispose()


def test_conflicts_preserve_saved_data_and_concurrent_edits_do_not_overwrite(tmp_path):
    engine = initialize_workspace(tmp_path / DATABASE)
    try:
        initial = save(engine, 0, sample())
        candidates = [
            initial.data.model_copy(update={"summary": note}) for note in ("First", "Second")
        ]

        def attempt(data):
            try:
                return save(engine, initial.version, data)
            except ProfileConflict:
                return None

        with ThreadPoolExecutor(max_workers=2) as workers:
            results = list(workers.map(attempt, candidates))
        successes = [result for result in results if result is not None]
        assert len(successes) == 1
        winner = successes[0]
        assert winner.version == 2 and get_profile(engine) == winner
        with pytest.raises(ProfileConflict):
            save(engine, 0, initial.data)
        assert get_profile(engine) == winner
    finally:
        engine.dispose()


@pytest.mark.parametrize(
    "change",
    [
        {"full_name": 123},
        {"summary": "x" * 4001},
        {"verified": True},
        {"preferences": {"work_modes": ["remote", "remote"]}},
        {"preferences": {"target_roles": ["Engineer", "engineer"]}},
        {"skills": [{"id": str(uuid4()), "name": "   "}]},
        {"skills": [{"id": "bad-id", "name": "Python"}]},
        {"skills": [{"id": str(uuid4()), "name": "Python", "verified": True}]},
    ],
)
def test_profile_rejects_invalid_types_unknown_claims_and_overflow(change):
    with pytest.raises(ValidationError):
        CandidateData.model_validate(change)


def test_dates_duplicate_ids_and_aggregate_byte_budget():
    for change in (
        {"start_month": "2023-13"},
        {"start_month": "2023-01", "end_month": "2022-12"},
        {"current": True, "end_month": "2024-01"},
    ):
        with pytest.raises(ValidationError):
            Experience(id=uuid4(), role="Example", organization="Example", **change)
    with pytest.raises(ValidationError):
        Education(
            id=uuid4(),
            institution="Example",
            qualification="Course",
            current=True,
            completion="completed",
        )
    with pytest.raises(ValidationError):
        Certification(
            id=uuid4(),
            name="Example",
            issuer="Example",
            issued_month="2024-01",
            expires_month="2023-01",
        )
    shared = uuid4()
    with pytest.raises(ValidationError):
        CandidateData(
            skills=[Skill(id=shared, name="Python")], projects=[Project(id=shared, name="Example")]
        )
    with pytest.raises(ValidationError, match="storage limit"):
        CandidateData(
            skills=[Skill(id=uuid4(), name="Example", details="\u754c" * 4000) for _ in range(25)]
        )


@pytest.mark.parametrize(
    "payload",
    [
        {"action": "profile_get", "path": "private"},
        {"action": "profile_save", "version": True, "data": {}},
        {"action": "profile_save", "version": -1, "data": {}},
        {"action": "profile_save", "version": 1, "data": {"full_name": "Incomplete"}},
        {"action": "profile_save", "version": 0, "data": {}, "evidence_status": "verified"},
    ],
)
def test_desktop_rejects_untrusted_request_fields(payload):
    with pytest.raises(ValidationError):
        TypeAdapter(DesktopRequest).validate_json(json.dumps(payload))


def test_real_worker_round_trip_and_sanitized_errors(tmp_path):
    path = tmp_path / DATABASE
    initialize_workspace(path).dispose()

    def request(payload):
        result = subprocess.run(  # noqa: S603 -- fixed worker and synthetic database
            [sys.executable, "-I", "-m", "app.desktop_bridge", str(path)],
            input=json.dumps(payload).encode(),
            capture_output=True,
            timeout=15,
            check=True,
        )
        assert not result.stderr
        return json.loads(result.stdout)

    initial = request({"action": "profile_get"})
    assert initial["ok"] and initial["protocol_version"] == 1
    assert initial["result"]["version"] == 0
    saved = request(
        {"action": "profile_save", "version": 0, "data": sample().model_dump(mode="json")}
    )
    assert saved["ok"] and saved["result"]["version"] == 1
    assert request({"action": "profile_get"}) == saved
    conflict = request(
        {"action": "profile_save", "version": 0, "data": {"full_name": "Stale edit"}}
    )
    assert conflict == {"protocol_version": 1, "ok": False, "error": "conflict"}
    assert request({"action": "profile_get"}) == saved
    invalid = request(
        {"action": "profile_save", "version": 1, "data": {"secret_unknown": "private sentinel"}}
    )
    assert invalid == {"protocol_version": 1, "ok": False, "error": "invalid"}


def test_previous_document_snapshot_restores_then_upgrades_without_changes(tmp_path):
    path = tmp_path / DATABASE
    initialize_workspace(path).dispose()
    snapshot_workspace(path, tmp_path / "snapshot")
    old = tmp_path / "snapshot" / DATABASE
    with sqlite3.connect(old) as connection:
        connection.execute("DROP TABLE job_listings")
        connection.execute("DROP TABLE background_tasks")
        connection.execute("DROP TABLE document_versions")
        connection.execute("DROP TABLE profile_review")
        connection.execute("DROP TABLE profile_draft")
        connection.execute("DROP TABLE document_text")
        connection.execute("DROP TABLE candidate_profile")
        connection.execute("UPDATE alembic_version SET version_num = '0003'")
    manifest_path = old.parent / MANIFEST
    manifest = json.loads(manifest_path.read_text())
    manifest["schema_revision"] = "0003"
    manifest["files"][DATABASE] = digest(old).model_dump()
    manifest_path.write_text(json.dumps(manifest))
    original = old.read_bytes()
    marker = identity_path(old).read_bytes()
    assert verify_snapshot(old.parent).schema_revision == "0003"
    assert old.read_bytes() == original
    prepare_workspace(old)
    assert identity_path(old).read_bytes() == marker
    with sqlite3.connect(old) as connection:
        assert connection.execute("SELECT version_num FROM alembic_version").fetchone() == (
            SCHEMA_VERSION,
        )
        assert connection.execute("SELECT COUNT(*) FROM candidate_profile").fetchone() == (0,)
    copies = list((old.parent / "migration-backups").glob("*.sqlite3"))
    assert len(copies) == 1
    with sqlite3.connect(copies[0]) as connection:
        assert connection.execute("SELECT version_num FROM alembic_version").fetchone() == ("0003",)
