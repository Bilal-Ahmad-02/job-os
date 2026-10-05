"""Synthetic checks for rule-based listing fit. No model, score or private data."""

from uuid import uuid4

import pytest

from app.db.workspace import initialize_workspace
from app.schemas.listings import (
    ListingCreateRequest,
    ListingFields,
    ListingGetRequest,
    ListingsListRequest,
)
from app.schemas.profile import CandidateData, ProfileSaveRequest
from app.services import listing_fit as fit
from app.services import listings
from app.services.profile import save_profile

TEXT = (
    "Senior Data Engineer\n"
    "Example AB in Stockholm builds pipelines. Hybrid, full-time.\n"
    "Requirements: Python and SQL, experience with Apache Spark.\n"
    "You have worked with C++ or C#.\n"
    "Meriterande: erfarenhet av Kubernetes.\n"
    "We offer a pension and a bike."
)


def profile(**preferences) -> CandidateData:
    return CandidateData.model_validate(
        {
            "skills": [
                {"id": str(uuid4()), "name": name}
                for name in ("Python", "SQL", "C", "C#", "Machine Learning", "Go", "R")
            ],
            "projects": [
                {
                    "id": str(uuid4()),
                    "name": "Synthetic project",
                    "technologies": ["Apache  Spark", "python", ".NET"],
                }
            ],
            "preferences": preferences,
        }
    )


def assess(data: CandidateData, text=TEXT, title="Senior Data Engineer", company="Example AB"):
    return fit.assess(data, 3, text=text, title=title, company=company, location="Stockholm")


def by_topic(result, topic):
    return [(f.outcome, f.term, f.source) for f in result.findings if f.topic == topic]


def test_whole_terms_only_and_every_hit_is_quoted_from_the_listing():
    result = assess(profile())
    assert result.rules_version == 1 and result.profile_version == 3
    # "R" is one character, "python" repeats a skill, so 7 of the 10 names are checked.
    assert result.terms_checked == 7
    assert by_topic(result, "skill") == [
        ("match", "Python", "skill"),
        ("match", "SQL", "skill"),
        ("match", "C#", "skill"),
        ("match", "Apache  Spark", "project_technology"),
    ]
    for finding in result.findings:
        if finding.topic == "skill":
            assert finding.term.casefold().split()[0] in finding.excerpts[0].casefold()
    # "C" must not match inside "C++"/"C#", "Go" inside "Google", ".NET" inside "internet".
    other = assess(profile(), text="We use C++ at Google on the internet. Good R&D.")
    assert by_topic(other, "skill") == []


def test_unset_preferences_are_reported_as_unset_not_as_matches_or_conflicts():
    result = assess(profile())
    for topic in (
        "target_role",
        "location",
        "work_mode",
        "employment_type",
        "excluded_employer",
        "excluded_keyword",
    ):
        assert by_topic(result, topic) == [("not_set", "", "")]


def test_saved_preferences_match_conflict_or_go_unmentioned():
    result = assess(
        profile(
            target_roles=["data engineer", "Product Manager"],
            locations=["Stockholm", "Uppsala"],
            work_modes=["remote", "hybrid"],
            employment_types=["part_time"],
            excluded_employers=["Example", "Other Corp"],
            excluded_keywords=["bike", "unpaid"],
        )
    )
    assert by_topic(result, "target_role") == [("match", "data engineer", "preference")]
    assert by_topic(result, "location") == [("match", "Stockholm", "preference")]
    assert by_topic(result, "work_mode") == [("match", "hybrid", "preference")]
    assert by_topic(result, "employment_type") == [("conflict", "full_time", "preference")]
    assert by_topic(result, "excluded_employer") == [("conflict", "Example", "preference")]
    assert by_topic(result, "excluded_keyword") == [("conflict", "bike", "preference")]
    assert fit.tally(result) == (4, 3)
    quiet = assess(
        profile(
            target_roles=["Nurse"],
            work_modes=["remote"],
            excluded_employers=["Other Corp"],
            excluded_keywords=["unpaid"],
        ),
        text="A short text with nothing relevant.",
        title="",
        company="",
    )
    assert by_topic(quiet, "target_role") == [("not_mentioned", "", "")]
    assert by_topic(quiet, "work_mode") == [("not_mentioned", "", "")]
    assert by_topic(quiet, "excluded_employer") == [("not_mentioned", "", "")]
    assert by_topic(quiet, "excluded_keyword") == [("not_mentioned", "", "")]
    assert fit.tally(quiet) == (0, 0)


def test_an_excluded_employer_named_only_in_the_text_is_still_a_conflict():
    result = assess(profile(excluded_employers=["Example AB"]), company="")
    assert by_topic(result, "excluded_employer") == [("conflict", "Example AB", "preference")]


def test_requirement_like_lines_show_which_confirmed_terms_they_contain():
    lines = assess(profile()).requirement_lines
    assert [(line.text.split(":")[0].split(" ")[0], line.covered_by) for line in lines] == [
        ("Requirements", ["Python", "SQL", "Apache  Spark"]),
        ("You", ["C#"]),
        ("Meriterande", []),
    ]
    assert all("pension" not in line.text for line in lines)


def test_results_are_bounded_for_hostile_or_huge_input():
    data = CandidateData.model_validate(
        {"skills": [{"id": str(uuid4()), "name": f"skill{index}"} for index in range(100)]}
    )
    text = "\n".join(f"Requirements: skill{index} " + "x" * 400 for index in range(100))
    result = fit.assess(data, 1, text=text, title="", company="", location="")
    assert len(result.requirement_lines) == 30
    assert all(
        len(line.text) <= 300 and len(line.covered_by) <= 10 for line in result.requirement_lines
    )
    assert len(result.findings) <= 200
    assert all(len(e) <= 200 for f in result.findings for e in f.excerpts)
    assert fit.term_pattern("   ") is None and fit.term_pattern("a") is None
    # Regular-expression characters in a term are literal.
    assert fit.term_pattern("c++ (x)").search("uses c++ (x) daily")


@pytest.fixture
def store(tmp_path):
    engine = initialize_workspace(tmp_path / "oracle.sqlite3")
    try:
        yield engine
    finally:
        engine.dispose()


def test_records_and_pages_use_only_the_saved_profile_and_never_store_the_result(store):
    row = listings.create_listing(
        store,
        ListingCreateRequest(
            action="listing_create", id=uuid4(), data=ListingFields(), original_text=TEXT
        ),
    )
    assert row.fit.profile_version == 0 and row.fit.terms_checked == 0
    assert [f.outcome for f in row.fit.findings] == ["not_set"] * 6
    page = listings.list_listings(store, ListingsListRequest(action="listings_list"))
    assert (page.items[0].matched_terms, page.items[0].conflicts) == (0, 0)
    save_profile(
        store,
        ProfileSaveRequest(
            action="profile_save", version=0, data=profile(excluded_keywords=["pension"])
        ),
    )
    again = listings.get_listing(store, ListingGetRequest(action="listing_get", id=row.id))
    # Same stored listing, same revision: only the comparison changed with the profile.
    assert (again.version, again.original_sha256, again.updated_at) == (
        row.version,
        row.original_sha256,
        row.updated_at,
    )
    assert again.fit.profile_version == 1
    assert by_topic(again.fit, "skill")[0] == ("match", "Python", "skill")
    assert by_topic(again.fit, "excluded_keyword") == [("conflict", "pension", "preference")]
    page = listings.list_listings(store, ListingsListRequest(action="listings_list"))
    assert (page.items[0].matched_terms, page.items[0].conflicts) == (4, 1)
