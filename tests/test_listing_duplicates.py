"""Synthetic duplicate-detection and closed-flag regressions. Nothing is merged or deleted."""

from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.db.workspace import initialize_workspace
from app.models.listings import JobListing
from app.schemas.listings import (
    ListingCreateRequest,
    ListingFields,
    ListingGetRequest,
    ListingsListRequest,
    ListingUpdateRequest,
)
from app.services import listing_normalizer as rules
from app.services import listings

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


def update(engine, row, archived=False, closed=False, shortlisted=False, **data):
    return listings.update_listing(
        engine,
        ListingUpdateRequest(
            action="listing_update",
            id=row.id,
            version=row.version,
            data=ListingFields(**data),
            archived=archived,
            closed=closed,
            shortlisted=shortlisted,
        ),
    )


def get(engine, row):
    return listings.get_listing(engine, ListingGetRequest(action="listing_get", id=row.id))


def page(engine, archived=False, **options):
    view = "dismissed" if archived else options.pop("view", "incoming")
    return listings.list_listings(
        engine, ListingsListRequest(action="listings_list", view=view, **options)
    )


def test_comparison_keys_ignore_case_spacing_punctuation_and_legal_suffixes():
    assert rules.text_key(TEXT) == rules.text_key(
        "  data ENGINEER \r\n\n build   pipelines at Example AB. remote.​"
    )
    assert rules.text_key(TEXT) != rules.text_key(TEXT + " Hybrid.")
    assert rules.text_key("") == "" and rules.text_key(" \n\t") == ""
    assert rules.label_key("  Senior Data-Engineer (m/f) ") == "senior data engineer m f"
    assert rules.company_key("Example, AB") == rules.company_key("EXAMPLE") == "example"
    assert rules.company_key("AB") == "ab"
    assert rules.company_key("Example Inc. Ltd") == "example"
    assert rules.label_key("Ｅxample") == "example"


def test_same_text_is_flagged_on_both_listings_and_nothing_is_merged(store):
    first = create(store, TEXT, title="Data Engineer")
    second = create(store, TEXT.upper().replace("\n", "  \r\n"))
    assert first.matches == [] and len(second.matches) == 1
    match = second.matches[0]
    assert (match.id, match.reasons, match.title) == (first.id, ["same_text"], "Data Engineer")
    assert [item.id for item in get(store, first).matches] == [second.id]
    listed = page(store)
    assert listed.total == 2 and all(item.possible_duplicate for item in listed.items)
    assert get(store, first).original_text == TEXT


def test_changed_text_with_the_same_link_or_title_and_company_is_reported_separately(store):
    original = create(
        store, TEXT, title="Data Engineer", company="Example AB", url="https://example.test/j/1"
    )
    by_link = create(
        store, TEXT + "\nSalary updated.", url="https://EXAMPLE.test/j/1?utm_source=mail#apply"
    )
    by_label = create(store, "Different wording.", title="data  engineer", company="Example")
    assert [(m.id, m.reasons) for m in by_link.matches] == [(original.id, ["same_link"])]
    assert [(m.id, m.reasons) for m in by_label.matches] == [(original.id, ["same_title_company"])]
    reasons = {m.id: m.reasons for m in get(store, original).matches}
    assert reasons == {by_link.id: ["same_link"], by_label.id: ["same_title_company"]}


def test_unrelated_and_incomplete_listings_are_not_flagged(store):
    create(store, TEXT, title="Data Engineer", company="Example AB")
    for row in (
        create(store, title="Data Engineer"),
        create(store, company="Example AB"),
        create(store, "Unrelated role text.", title="Analyst", company="Example AB"),
        create(store, title="Data Engineer", company="Other AB"),
    ):
        assert row.matches == []
    listed = page(store)
    assert listed.total == 5 and not any(item.possible_duplicate for item in listed.items)


def test_archived_and_closed_listings_still_identify_previously_reviewed_roles(store):
    reviewed = create(store, TEXT, title="Data Engineer")
    reviewed = update(store, reviewed, title="Data Engineer", archived=True, closed=True)
    assert reviewed.closed and reviewed.archived and reviewed.version == 2
    again = create(store, TEXT)
    assert [(m.id, m.archived, m.closed) for m in again.matches] == [(reviewed.id, True, True)]
    assert page(store).items[0].possible_duplicate
    archived = page(store, archived=True).items[0]
    assert archived.closed and archived.possible_duplicate
    reopened = update(store, reviewed, title="Data Engineer", archived=True, closed=False)
    assert not reopened.closed and reopened.original_text == TEXT


def test_owner_edits_change_matches_without_touching_other_listings(store):
    first = create(store, "First text.", title="Engineer", company="Example AB")
    second = create(store, "Second text.", title="Analyst", company="Example AB")
    assert second.matches == []
    second = update(store, second, title="ENGINEER", company="example ab")
    assert [m.id for m in second.matches] == [first.id]
    untouched = get(store, first)
    assert (untouched.version, untouched.data.title) == (1, "Engineer")
    second = update(store, second, title="Analyst", company="Example AB")
    assert second.matches == [] and get(store, first).matches == []


def test_match_lists_are_bounded_and_prefer_identical_text(store):
    target = create(store, TEXT, title="Data Engineer", company="Example AB")
    for _ in range(11):
        create(store, title="Data Engineer", company="Example AB")
    twin = create(store, TEXT)
    matches = get(store, target).matches
    assert len(matches) == 10
    assert matches[0].id == twin.id and matches[0].reasons == ["same_text"]


def test_keys_from_another_rules_version_are_ignored_for_text_matching(store):
    first = create(store, TEXT)
    second = create(store, TEXT)
    with Session(store.execution_options(oracle_write=True)) as session, session.begin():
        session.get(JobListing, str(first.id)).keys_version = 0
    assert get(store, second).matches == []
    assert not any(item.possible_duplicate for item in page(store).items)
