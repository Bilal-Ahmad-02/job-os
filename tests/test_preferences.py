"""Preference evolution must preserve existing records and reject incomplete writes."""

import json
import sqlite3

import pytest
from pydantic import ValidationError

from app.db.workspace import initialize_workspace
from app.schemas.profile import CandidateData, Preferences, ProfileSaveRequest
from app.services.backup_snapshot import snapshot_workspace, verify_snapshot
from app.services.profile import get_profile, save_profile


@pytest.mark.parametrize("field", ["excluded_employers", "excluded_keywords"])
@pytest.mark.parametrize(
    "values",
    [
        [" "],
        ["A", " a "],
        ["Straße", "STRASSE"],
        ["x" * 301],
        [str(i) for i in range(21)],
        [123],
        "not a list",
    ],
)
def test_exclusions_are_bounded_distinct_nonempty_text(field, values):
    with pytest.raises(ValidationError):
        Preferences.model_validate({field: values})


def test_legacy_profile_read_and_snapshot_do_not_rewrite_stored_json(tmp_path):
    path = tmp_path / "oracle.sqlite3"
    engine = initialize_workspace(path)
    legacy = CandidateData(full_name="Synthetic owner").model_dump(mode="json")
    legacy["preferences"].pop("excluded_employers")
    legacy["preferences"].pop("excluded_keywords")
    legacy["preferences"]["constraints"] = "Keep legacy notes, including exclusions."
    raw = json.dumps(legacy)
    try:
        with sqlite3.connect(path) as connection:
            connection.execute(
                "INSERT INTO candidate_profile (id,version,updated_at,data) VALUES (1,1,?,?)",
                ("2026-01-01T00:00:00+00:00", raw),
            )
        profile = get_profile(engine)
        assert profile.version == 1
        assert profile.data.preferences.excluded_employers == []
        assert profile.data.preferences.excluded_keywords == []
        assert profile.data.preferences.constraints == legacy["preferences"]["constraints"]
        with sqlite3.connect(path) as connection:
            assert connection.execute("SELECT data FROM candidate_profile").fetchone()[0] == raw
        snapshot_workspace(path, tmp_path / "snapshot")
        verify_snapshot(tmp_path / "snapshot")
        complete = profile.data.model_dump(mode="json")
        complete["preferences"]["excluded_employers"] = [" Example Agency "]
        complete["preferences"]["excluded_keywords"] = ["commission only"]
        request = ProfileSaveRequest.model_validate(
            {"action": "profile_save", "version": 1, "data": complete}
        )
        saved = save_profile(engine, request)
        assert saved.version == 2
        assert saved.data.full_name == legacy["full_name"]
        assert saved.data.preferences.excluded_employers == ["Example Agency"]
        assert save_profile(engine, request) == saved
        snapshot_workspace(path, tmp_path / "updated-snapshot")
        verify_snapshot(tmp_path / "updated-snapshot")
        with sqlite3.connect(tmp_path / "updated-snapshot/oracle.sqlite3") as connection:
            restored = CandidateData.model_validate_json(
                connection.execute("SELECT data FROM candidate_profile").fetchone()[0]
            )
        assert restored == saved.data
    finally:
        engine.dispose()


@pytest.mark.parametrize("missing", list(Preferences.model_fields))
def test_saved_profile_updates_require_all_preference_fields(missing):
    data = CandidateData().model_dump(mode="json")
    data["preferences"].pop(missing)
    with pytest.raises(ValidationError, match="every preference field"):
        ProfileSaveRequest.model_validate({"action": "profile_save", "version": 1, "data": data})
