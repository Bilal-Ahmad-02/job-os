"""Synthetic checks for owner-entered application dates and the link back to a listing."""

from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import text
from test_listing_review import workspace_at

from app.db.store import existing_engine, open_store
from app.db.workspace import initialize_workspace, prepare_workspace
from app.schemas.applications import (
    ApplicationData,
    GetRequest,
    ImportedProvenance,
    ListRequest,
    SaveRequest,
)
from app.schemas.listings import ListingCreateRequest, ListingFields, ListingTrackRequest
from app.services import listings
from app.services.applications import get_application, list_applications, save_application


@pytest.fixture
def store(tmp_path):
    engine = initialize_workspace(tmp_path / "oracle.sqlite3")
    try:
        yield engine
    finally:
        engine.dispose()


def save(engine, identity, version, **data):
    return save_application(
        engine,
        SaveRequest(
            action="update" if version else "create",
            id=identity,
            version=version,
            data=ApplicationData(company="Example AB", **data),
        ),
    )


def test_dates_round_trip_appear_in_the_index_and_can_be_cleared(store):
    identity = uuid4()
    created = save(store, identity, 0, deadline_date="2026-10-20")
    assert created.data.deadline_date == "2026-10-20" and created.data.follow_up_date == ""
    assert created.listing_id is None
    changed = save(store, identity, 1, deadline_date="2026-10-20", follow_up_date="2026-11-01")
    assert changed.version == 2 and changed.data.follow_up_date == "2026-11-01"
    item = list_applications(store, ListRequest(action="list")).items[0]
    assert (item.deadline_date, item.follow_up_date) == ("2026-10-20", "2026-11-01")
    cleared = save(store, identity, 2)
    assert (cleared.data.deadline_date, cleared.data.follow_up_date) == ("", "")
    assert get_application(store, GetRequest(action="get", id=identity)) == cleared


@pytest.mark.parametrize(
    "value",
    ["2026-02-30", "2026-13-01", "20-10-2026", "2026-10-5", "tomorrow", "2026-10-05T10:00", " "],
)
def test_impossible_or_unstructured_dates_are_rejected(value):
    for name in ("deadline_date", "follow_up_date"):
        with pytest.raises(ValidationError):
            ApplicationData(company="Example AB", **{name: value})


def test_spreadsheet_provenance_never_includes_the_later_date_fields():
    original = {name: "" for name in ApplicationData.model_fields if name != "status"}
    with pytest.raises(ValidationError):
        ImportedProvenance(sheet="Sheet", row=2, original=original, links={})
    for name in ("deadline_date", "follow_up_date"):
        del original[name]
    assert ImportedProvenance(sheet="Sheet", row=2, original=original, links={}).row == 2


def test_a_dossier_started_from_a_listing_points_back_to_it(store):
    listing = listings.create_listing(
        store,
        ListingCreateRequest(
            action="listing_create", id=uuid4(), data=ListingFields(title="Synthetic role")
        ),
    )
    application_id = uuid4()
    listings.track_listing(
        store,
        ListingTrackRequest(
            action="listing_track", id=listing.id, version=1, application_id=application_id
        ),
    )
    dossier = get_application(store, GetRequest(action="get", id=application_id))
    assert dossier.listing_id == listing.id
    assert (dossier.data.deadline_date, dossier.data.follow_up_date) == ("", "")
    edited = save_application(
        store,
        SaveRequest(
            action="update",
            id=application_id,
            version=1,
            data=dossier.data.model_copy(update={"deadline_date": "2026-12-01"}),
        ),
    )
    assert edited.listing_id == listing.id and edited.data.deadline_date == "2026-12-01"


def test_migration_from_0011_keeps_every_application_value_and_adds_empty_dates(tmp_path):
    database = tmp_path / "oracle.sqlite3"
    workspace_at(database, "0011")
    application, job = str(uuid4()), str(uuid4())
    engine = existing_engine(database)
    try:
        with engine.connect().execution_options(oracle_write=True) as connection:
            with connection.begin():
                connection.execute(
                    text(
                        "INSERT INTO jobs (id, title, company, website, source, learning, "
                        "description) VALUES (:job, 'Engineer', 'Example AB', '', '', '', 'Text')"
                    ),
                    {"job": job},
                )
                connection.execute(
                    text(
                        "INSERT INTO applications (id, job_id, resume_sent, how_sent, "
                        "references_sent, status_notes, interview, follow_up, notes, status, "
                        "version, updated_at) VALUES (:id, :job, '2026-09-01', '', '', '', '', "
                        "'Call in two weeks', 'Owner note', 'Applied', 4, "
                        "'2026-10-01T00:00:00+00:00')"
                    ),
                    {"id": application, "job": job},
                )
    finally:
        engine.dispose()
    prepare_workspace(database)
    assert list((tmp_path / "migration-backups").glob("before-0012-*.sqlite3"))
    upgraded = open_store(database)
    try:
        row = get_application(upgraded, GetRequest(action="get", id=application))
        assert row.version == 4 and row.updated_at == "2026-10-01T00:00:00+00:00"
        assert (row.data.status, row.data.follow_up, row.data.notes, row.data.resume_sent) == (
            "Applied",
            "Call in two weeks",
            "Owner note",
            "2026-09-01",
        )
        assert (row.data.deadline_date, row.data.follow_up_date, row.listing_id) == ("", "", None)
    finally:
        upgraded.dispose()
