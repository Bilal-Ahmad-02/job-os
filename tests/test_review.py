import json
import sqlite3
import subprocess
import sys
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session
from test_evidence import proposal, text_pdf

from app.db.store import SCHEMA_VERSION, open_store
from app.db.workspace import initialize_workspace, prepare_workspace
from app.models.evidence import ProfileDraft
from app.schemas.evidence import DraftEvidence
from app.schemas.profile import CandidateData, Preferences, ProfileSaveRequest, Skill
from app.schemas.review import ReviewSaveRequest
from app.services.backup_snapshot import (
    DATABASE,
    MANIFEST,
    digest,
    snapshot_workspace,
    verify_snapshot,
)
from app.services.documents import import_documents, read_document
from app.services.evidence import extract_document, store_draft
from app.services.profile import ProfileConflict, get_profile, save_profile
from app.services.review import get_review, save_review


@pytest.fixture
def workspace(tmp_path):
    engine = initialize_workspace(tmp_path / DATABASE)
    identity = import_documents(engine, [read_document("cv", text_pdf(tmp_path / "source.pdf"))])[0]
    extract_document(engine, identity)
    draft = proposal(identity)
    skill = Skill(id=uuid4(), name="Synthetic skill")
    draft.data.skills.append(skill)
    draft.evidence.append(
        DraftEvidence(target=f"skills/{skill.id}", citations=draft.evidence[0].citations)
    )
    store_draft(engine, draft)
    try:
        yield engine, skill
    finally:
        engine.dispose()


def request(state, **changes):
    fields = dict(
        action="profile_review_save",
        version=state.version,
        profile_version=state.profile.version,
        draft_sha256=state.draft_sha256,
        target="full_name",
        decision="approved",
        data=CandidateData(full_name="Corrected"),
    )
    fields.update(changes)
    return ReviewSaveRequest(**fields)


def test_approval_merges_one_entry_preserves_originals_and_survives_snapshot(workspace, tmp_path):
    engine, skill = workspace
    save_profile(
        engine,
        ProfileSaveRequest(
            action="profile_save",
            version=0,
            data=CandidateData(
                summary="Keep existing",
                preferences=Preferences(
                    target_roles=["Owner role"],
                    excluded_employers=["Synthetic agency"],
                    excluded_keywords=["commission only"],
                ),
            ),
        ),
    )
    before = get_review(engine)
    with Session(engine) as session:
        original = session.get(ProfileDraft, 1).payload
    after = save_review(engine, request(before))
    assert after.version == 1 and after.profile.version == 2
    assert after.profile.data.full_name == "Corrected"
    assert after.profile.data.summary == "Keep existing"
    assert after.profile.data.preferences == before.profile.data.preferences
    after = save_review(
        engine, request(after, target=f"skills/{skill.id}", data=CandidateData(skills=[skill]))
    )
    assert after.profile.data.skills == [skill]
    assert after.profile.evidence_status == "user_provided"
    with Session(engine) as session:
        assert session.get(ProfileDraft, 1).payload == original
    snapshot_workspace(tmp_path / DATABASE, tmp_path / "backup")
    verify_snapshot(tmp_path / "backup")
    restored = open_store(tmp_path / "backup" / DATABASE)
    try:
        assert get_review(restored) == after
    finally:
        restored.dispose()


def test_rejection_does_not_create_profile_and_can_later_be_approved(workspace):
    engine, _ = workspace
    rejected = save_review(engine, request(get_review(engine), decision="rejected", data=None))
    assert rejected.decisions[0].decision == "rejected"
    assert get_profile(engine).version == 0
    approved = save_review(engine, request(rejected))
    assert approved.decisions[0].decision == "approved"
    with pytest.raises(ValueError):
        save_review(engine, request(approved, decision="rejected", data=None))
    assert get_review(engine) == approved


@pytest.mark.parametrize(
    "change", ["stale", "profile", "digest", "unrelated", "target", "id", "null", "rejected-data"]
)
def test_invalid_or_stale_decisions_are_atomic(workspace, change):
    engine, skill = workspace
    before = get_review(engine)
    updates = {
        "stale": {"version": 9},
        "profile": {"profile_version": 9},
        "digest": {"draft_sha256": "0" * 64},
        "unrelated": {"data": CandidateData(full_name="Correction", summary="Smuggled edit")},
        "target": {"target": "summary"},
        "id": {
            "target": f"skills/{skill.id}",
            "data": CandidateData(skills=[Skill(id=uuid4(), name="Wrong")]),
        },
        "null": {"data": None},
        "rejected-data": {"decision": "rejected"},
    }[change]
    with pytest.raises((ValueError, ProfileConflict)):
        save_review(engine, request(before, **updates))
    assert get_review(engine) == before


def test_concurrent_review_and_manual_profile_edit_cannot_overwrite(workspace):
    engine, _ = workspace
    stale = get_review(engine)
    saved = save_review(engine, request(stale))
    with pytest.raises(ProfileConflict):
        save_review(engine, request(stale))
    save_profile(
        engine,
        ProfileSaveRequest(
            action="profile_save",
            version=saved.profile.version,
            data=CandidateData.model_validate_json(saved.profile.data.model_dump_json()),
        ),
    )
    edited = saved.profile.data.model_copy(deep=True)
    edited.full_name = "New manual edit"
    save_profile(
        engine,
        ProfileSaveRequest(action="profile_save", version=saved.profile.version, data=edited),
    )
    with pytest.raises(ProfileConflict):
        save_review(engine, request(saved))
    assert get_profile(engine).data.full_name == "New manual edit"


def test_previous_draft_snapshot_verifies_without_mutation_then_upgrades(tmp_path):
    database = tmp_path / DATABASE
    initialize_workspace(database).dispose()
    target = tmp_path / "snapshot"
    snapshot_workspace(database, target)
    old = target / DATABASE
    with sqlite3.connect(old) as connection:
        connection.execute("DROP TABLE listing_searches")
        connection.execute("DROP TABLE job_listings")
        connection.execute("DROP TABLE background_tasks")
        connection.execute("DROP TABLE document_versions")
        connection.execute("DROP TABLE profile_review")
        connection.execute("UPDATE alembic_version SET version_num = '0005'")
    manifest_path = target / MANIFEST
    manifest = json.loads(manifest_path.read_text())
    manifest["schema_revision"] = "0005"
    manifest["files"][DATABASE] = digest(old).model_dump()
    manifest_path.write_text(json.dumps(manifest))
    before = old.read_bytes()
    assert verify_snapshot(target).schema_revision == "0005"
    assert old.read_bytes() == before
    prepare_workspace(old)
    with sqlite3.connect(old) as connection:
        assert connection.execute("SELECT version_num FROM alembic_version").fetchone() == (
            SCHEMA_VERSION,
        )


def test_real_worker_review_contract_and_sanitized_failures(workspace, tmp_path):
    engine, _ = workspace

    def call(payload):
        result = subprocess.run(  # noqa: S603 -- fixed worker and synthetic records
            [sys.executable, "-I", "-m", "app.desktop_bridge", str(tmp_path / DATABASE)],
            input=json.dumps(payload).encode(),
            capture_output=True,
            timeout=15,
            check=True,
        )
        assert not result.stderr
        return json.loads(result.stdout)

    initial = call({"action": "profile_review_get"})
    assert initial["ok"]
    assert initial["result"] == get_review(engine).model_dump(mode="json")
    payload = request(get_review(engine)).model_dump(mode="json")
    saved = call(payload)
    assert saved["ok"] and saved["result"]["profile"]["data"]["full_name"] == "Corrected"
    assert call(payload) == {"protocol_version": 1, "ok": False, "error": "conflict"}
    payload = request(get_review(engine), target="private sentinel").model_dump(mode="json")
    assert call(payload) == {"protocol_version": 1, "ok": False, "error": "invalid"}
