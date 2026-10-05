"""Synthetic review-workflow regressions: views, shortlist, tracking and saved searches."""

import hashlib
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import workspace
from app.db.store import existing_engine, open_store
from app.db.workspace import initialize_workspace, prepare_workspace
from app.models.listings import JobListing
from app.schemas.applications import GetRequest, ListRequest
from app.schemas.listings import (
    ListingCreateRequest,
    ListingFields,
    ListingGetRequest,
    ListingsListRequest,
    ListingTrackRequest,
    ListingUpdateRequest,
    SearchDeleteRequest,
    SearchSaveRequest,
)
from app.services import listing_normalizer as rules
from app.services import listings
from app.services.applications import RecordError, get_application, list_applications

TEXT = "Data Engineer\nBuild pipelines at Example AB.\nRemote."


@pytest.fixture
def store(tmp_path):
    engine = initialize_workspace(tmp_path / "oracle.sqlite3")
    try:
        yield engine
    finally:
        engine.dispose()


def create(engine, original_text="", **data):
    return listings.create_listing(
        engine,
        ListingCreateRequest(
            action="listing_create",
            id=uuid4(),
            data=ListingFields(**data),
            original_text=original_text,
        ),
    )


def update(engine, row, archived=False, closed=False, shortlisted=False):
    return listings.update_listing(
        engine,
        ListingUpdateRequest(
            action="listing_update",
            id=row.id,
            version=row.version,
            data=row.data,
            archived=archived,
            closed=closed,
            shortlisted=shortlisted,
        ),
    )


def track(engine, row, application_id=None, version=None):
    return listings.track_listing(
        engine,
        ListingTrackRequest(
            action="listing_track",
            id=row.id,
            version=row.version if version is None else version,
            application_id=application_id or uuid4(),
        ),
    )


def ids(engine, view):
    page = listings.list_listings(engine, ListingsListRequest(action="listings_list", view=view))
    assert page.total == len(page.items)
    return {item.id for item in page.items}


def save(engine, name, query="", view="incoming", identity=None):
    return listings.save_search(
        engine,
        SearchSaveRequest(
            action="listing_search_save",
            id=identity or uuid4(),
            name=name,
            query=query,
            view=view,
        ),
    )


def test_each_listing_appears_in_exactly_one_view(store):
    incoming = create(store, title="Incoming")
    liked = update(store, create(store, title="Liked"), shortlisted=True)
    dismissed = update(store, create(store, title="Dismissed"), archived=True)
    both = update(
        store, create(store, title="Liked then dismissed"), archived=True, shortlisted=True
    )
    tracked = track(store, update(store, create(store, title="Tracked"), archived=True))
    assert ids(store, "incoming") == {incoming.id}
    assert ids(store, "shortlist") == {liked.id}
    assert ids(store, "dismissed") == {dismissed.id, both.id}
    assert ids(store, "tracked") == {tracked.id}
    restored = update(store, both, shortlisted=True)
    assert restored.shortlisted and ids(store, "shortlist") == {liked.id, both.id}


def test_starting_an_application_creates_one_linked_dossier_and_keeps_the_listing(store):
    row = create(
        store,
        TEXT,
        title="Data Engineer",
        company="Example AB",
        url="https://example.test/j/1",
        source="Synthetic board",
    )
    application_id = uuid4()
    tracked = track(store, row, application_id)
    assert tracked.application_id == application_id and tracked.version == 2
    assert (tracked.original_text, tracked.original_sha256, tracked.collected_at) == (
        row.original_text,
        row.original_sha256,
        row.collected_at,
    )
    dossier = get_application(store, GetRequest(action="get", id=application_id))
    assert dossier.data.title == "Data Engineer" and dossier.data.company == "Example AB"
    assert dossier.data.website == "https://example.test/j/1"
    assert dossier.data.source == "Synthetic board"
    assert dossier.data.description == rules.normalize_text(TEXT)
    assert dossier.data.status == "Saved" and dossier.imported is None
    assert "full original text stays in INGRESS" in dossier.data.notes
    assert "first line" not in dossier.data.notes
    # A retry returns the same link; a second, different dossier is refused.
    assert track(store, row, application_id, version=1) == tracked
    with pytest.raises(RecordError, match="conflict"):
        track(store, tracked)
    assert list_applications(store, ListRequest(action="list")).total == 1


def test_tracking_states_where_the_title_came_from_and_bounds_the_description(store):
    long_text = "Senior Analyst\n" + "word " * 3000
    tracked = track(store, create(store, long_text))
    dossier = get_application(store, GetRequest(action="get", id=tracked.application_id))
    assert dossier.data.title == "Senior Analyst" and len(dossier.data.description) == 10000
    assert "taken from the first line" in dossier.data.notes
    assert "shortened to 10,000 characters" in dossier.data.notes
    assert tracked.data.title == "" and tracked.original_text == long_text


def test_tracking_refuses_unnamed_stale_missing_and_colliding_requests(store):
    unnamed = create(store, "x" * 200 + "\nNo usable first line.")
    with pytest.raises(RecordError, match="invalid"):
        track(store, unnamed)
    row = create(store, title="Role")
    with pytest.raises(RecordError, match="conflict"):
        track(store, row, version=5)
    other = track(store, create(store, title="Other"))
    with pytest.raises(RecordError, match="conflict"):
        track(store, row, other.application_id)
    with pytest.raises(RecordError, match="not_found"):
        listings.track_listing(
            store,
            ListingTrackRequest(
                action="listing_track", id=uuid4(), version=1, application_id=uuid4()
            ),
        )
    assert list_applications(store, ListRequest(action="list")).total == 1
    assert listings.get_listing(store, ListingGetRequest(action="listing_get", id=row.id)) == row
    with Session(store) as session:
        assert session.get(JobListing, str(unnamed.id)).application_id is None


def test_saved_searches_are_bounded_idempotent_and_removal_touches_no_listing(store, monkeypatch):
    row = create(store, title="Kept listing")
    identity = uuid4()
    page = save(store, "  Remote data roles ", "data", "shortlist", identity)
    assert [(s.id, s.name, s.query, s.view) for s in page.items] == [
        (identity, "Remote data roles", "data", "shortlist")
    ]
    assert save(store, "Remote data roles", "data", "shortlist", identity) == page
    with pytest.raises(RecordError, match="conflict"):
        save(store, "Renamed", "data", "shortlist", identity)
    monkeypatch.setattr(listings, "MAX_SEARCHES", 2)
    save(store, "Second")
    with pytest.raises(RecordError, match="invalid"):
        save(store, "Third")
    assert len(listings.list_searches(store).items) == 2
    request = SearchDeleteRequest(action="listing_search_delete", id=identity)
    assert [s.name for s in listings.delete_search(store, request).items] == ["Second"]
    assert [s.name for s in listings.delete_search(store, request).items] == ["Second"]
    assert listings.get_listing(store, ListingGetRequest(action="listing_get", id=row.id)) == row


@pytest.mark.parametrize(
    "changes",
    [
        {"name": "   "},
        {"name": "x" * 81},
        {"query": "x" * 201},
        {"view": "everything"},
        {"path": "/x"},
    ],
)
def test_invalid_saved_searches_are_rejected(changes):
    from pydantic import ValidationError

    payload = {
        "action": "listing_search_save",
        "id": str(uuid4()),
        "name": "Search",
        "query": "",
        "view": "incoming",
    }
    with pytest.raises(ValidationError):
        SearchSaveRequest.model_validate({**payload, **changes})


def workspace_at(database: Path, revision: str) -> None:
    """Build a real workspace at an earlier schema by running only the earlier migrations."""
    database.touch()
    config = Config()
    config.set_main_option("script_location", str(Path(workspace.__file__).parent / "migrations"))
    engine = existing_engine(database)
    try:
        with engine.connect().execution_options(oracle_write=True) as connection:
            with connection.begin():
                config.attributes["connection"] = connection
                command.upgrade(config, revision)
                identity = connection.execute(
                    text("SELECT workspace_id FROM workspace_metadata")
                ).scalar_one()
    finally:
        engine.dispose()
    database.with_suffix(".workspace-id").write_bytes((identity + "\n").encode("ascii"))


@pytest.mark.parametrize("revision", ["0009", "0010"])
def test_migration_from_earlier_listing_schemas_keeps_rows_and_defaults(tmp_path, revision):
    database = tmp_path / "oracle.sqlite3"
    workspace_at(database, revision)
    identity = str(uuid4())
    engine = existing_engine(database)
    try:
        with engine.connect().execution_options(oracle_write=True) as connection:
            with connection.begin():
                connection.execute(
                    text(
                        "INSERT INTO job_listings (id, origin, title, company, location, url, "
                        "source, notes, original_text, original_sha256, collected_at, archived, "
                        "version, updated_at) VALUES (:id, 'pasted', 'Data Engineer', '', '', "
                        "'', '', 'Owner note', :text, :sha, '2026-10-05T00:00:00+00:00', 1, 3, "
                        "'2026-10-05T01:00:00+00:00')"
                    ),
                    {
                        "id": identity,
                        "text": TEXT,
                        "sha": hashlib.sha256(TEXT.encode()).hexdigest(),
                    },
                )
    finally:
        engine.dispose()
    prepare_workspace(database)
    assert list((tmp_path / "migration-backups").glob("before-0011-*.sqlite3"))
    upgraded = open_store(database)
    try:
        row = listings.get_listing(upgraded, ListingGetRequest(action="listing_get", id=identity))
        assert (row.original_text, row.data.notes, row.version, row.archived) == (
            TEXT,
            "Owner note",
            3,
            True,
        )
        assert not row.shortlisted and row.application_id is None and not row.closed
        if revision == "0009":  # 0010 backfilled its text key from the stored original.
            assert [m.id for m in create(upgraded, TEXT).matches] == [row.id]
        assert listings.list_searches(upgraded).items == []
        assert ids(upgraded, "dismissed") == {row.id}
    finally:
        upgraded.dispose()
