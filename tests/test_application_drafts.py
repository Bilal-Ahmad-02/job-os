"""Synthetic checks for template-built CV and cover-letter drafts."""

import json
from uuid import UUID, uuid4

import pytest
from pydantic import TypeAdapter, ValidationError

from app.db.workspace import initialize_workspace
from app.operations import execute_operation
from app.schemas.application_drafts import ApplicationDraftRequest
from app.schemas.applications import ApplicationData, GetRequest, SaveRequest
from app.schemas.desktop import DesktopRequest
from app.schemas.profile import CandidateData, ProfileSaveRequest
from app.services.application_drafts import compose, draft_application
from app.services.applications import RecordError, get_application, save_application
from app.services.profile import get_profile, save_profile

IDS = {name: str(UUID(int=number)) for number, name in enumerate(
    ("old_job", "new_job", "degree", "python", "sql", "talking", "project", "certificate"), 1
)}


def profile() -> CandidateData:
    return CandidateData.model_validate(
        {
            "full_name": "Synthetic Person",
            "headline": "Backend developer",
            "location": "Example City",
            "summary": "I build small, careful services.",
            "experience": [
                {
                    "id": IDS["old_job"],
                    "role": "Junior Developer",
                    "organization": "Old Example AB",
                    "start_month": "2021-01",
                    "end_month": "2022-06",
                },
                {
                    "id": IDS["new_job"],
                    "role": "Developer",
                    "organization": "New Example AB",
                    "location": "Example City",
                    "start_month": "2022-08",
                    "current": True,
                    "description": "Owned the billing service.",
                },
            ],
            "education": [
                {
                    "id": IDS["degree"],
                    "institution": "Example University",
                    "qualification": "BSc",
                    "field_of_study": "Computer Science",
                    "completion": "completed",
                    "end_month": "2020-06",
                }
            ],
            "skills": [
                {"id": IDS["talking"], "name": "Presenting", "category": "Other"},
                {"id": IDS["python"], "name": "Python", "category": "Languages"},
                {"id": IDS["sql"], "name": "SQL", "category": "Languages"},
            ],
            "projects": [
                {
                    "id": IDS["project"],
                    "name": "Ledger",
                    "technologies": ["SQLite"],
                    "url": "https://example.invalid/ledger",
                }
            ],
            "certifications": [
                {
                    "id": IDS["certificate"],
                    "name": "Cloud Basics",
                    "issuer": "Example Body",
                    "issued_month": "2023-03",
                }
            ],
        }
    )


def built(kind, data=None, title="Platform Engineer", company="Target AB", job_text=""):
    return compose(
        kind, data or profile(), 3, uuid4(), 2, title, company, job_text or "We use SQL daily."
    )


def text_of(draft) -> str:
    return "\n\n".join(block.text for block in draft.blocks)


def known_sources(data: CandidateData) -> set[str]:
    sections = ("experience", "education", "skills", "projects", "certifications")
    return {"full_name", "headline", "location", "summary"} | {
        f"{section}/{entry.id}" for section in sections for entry in getattr(data, section)
    }


def test_a_cv_holds_every_profile_entry_newest_first_under_its_section():
    draft = built("cv")
    headings = [block.heading for block in draft.blocks]
    assert headings == [
        "", "SUMMARY", "EXPERIENCE", "EXPERIENCE", "EDUCATION", "SKILLS", "SKILLS",
        "PROJECTS", "CERTIFICATIONS",
    ]
    assert draft.blocks[0].text == "Synthetic Person\nBackend developer\nExample City"
    current, earlier = draft.blocks[2], draft.blocks[3]
    assert current.text == (
        "Developer, New Example AB — Example City\nAug 2022 – Present\nOwned the billing service."
    )
    assert earlier.text == "Junior Developer, Old Example AB\nJan 2021 – Jun 2022"
    assert draft.blocks[4].text == "BSc, Computer Science — Example University\nJun 2020"
    assert draft.blocks[7].text == (
        "Ledger\nTechnologies: SQLite\nhttps://example.invalid/ledger"
    )
    assert draft.blocks[8].text == "Cloud Basics, Example Body (Mar 2023)"
    assert draft.gaps == [] and draft.template_version == 1
    assert (draft.profile_version, draft.application_version) == (3, 2)


def test_tailoring_only_reorders_skills_the_job_text_mentions():
    plain = built("cv", job_text="Nothing relevant here.")
    assert [b.text for b in plain.blocks if b.heading == "SKILLS"] == [
        "Other: Presenting",
        "Languages: Python, SQL",
    ]
    assert plain.matched_skills == []
    tailored = built("cv", job_text="Strong sql and some PYTHON; not SQLite.")
    assert [b.text for b in tailored.blocks if b.heading == "SKILLS"] == [
        "Languages: Python, SQL",
        "Other: Presenting",
    ]
    assert tailored.matched_skills == ["Python", "SQL"]
    # Reordering adds and removes nothing.
    assert sorted(text_of(plain).split()) == sorted(text_of(tailored).split())


def test_every_block_names_real_sources_and_template_wording_carries_no_profile_fact():
    data = profile()
    facts = [data.full_name, data.summary, "New Example AB", "Example University", "Python", "SQL"]
    for kind in ("cv", "cover_letter"):
        draft = built(kind, data)
        for block in draft.blocks:
            assert set(block.sources) <= known_sources(data)
            if not block.sources:
                assert not any(fact in block.text for fact in facts)
            if not block.uses_application:
                assert "Target AB" not in block.text and "Platform Engineer" not in block.text


def test_a_cover_letter_is_fixed_sentences_around_the_owners_own_words():
    draft = built("cover_letter")
    assert [block.text for block in draft.blocks] == [
        "Synthetic Person\nExample City",
        "Application: Platform Engineer, Target AB",
        "Dear hiring team at Target AB,",
        "I am writing to apply for the Platform Engineer position.",
        "I build small, careful services.",
        "The description of the role mentions SQL, which is among my skills.",
        "Most recently I have been working as Developer at New Example AB.",
        "I completed BSc in Computer Science at Example University.",
        "I would welcome the chance to tell you more. Thank you for your time.",
        "Kind regards,\nSynthetic Person",
    ]
    assert draft.blocks[5].sources == [f"skills/{IDS['sql']}"]
    assert [block.uses_application for block in draft.blocks[1:4]] == [True, True, True]
    two = built("cover_letter", job_text="python and sql")
    assert "mentions Python and SQL, which are among my skills." in text_of(two)


def test_an_empty_profile_gives_a_bare_letter_and_says_what_is_missing():
    draft = built("cover_letter", CandidateData(), title="", company="")
    assert [block.text for block in draft.blocks] == [
        "Dear hiring team,",
        "I am writing to apply for this position.",
        "I would welcome the chance to tell you more. Thank you for your time.",
        "Kind regards,",
    ]
    assert all(not block.sources and not block.uses_application for block in draft.blocks)
    assert draft.gaps == [
        "full_name", "summary", "experience", "education", "skills", "title", "company",
    ]
    assert built("cv", CandidateData()).blocks == []


def test_study_wording_follows_what_the_owner_recorded():
    data = profile()
    for change, expected in (
        ({"completion": "in_progress"}, "I am studying BSc in Computer Science at"),
        ({"completion": "unspecified"}, "My education includes BSc in Computer Science at"),
        ({"completion": "unspecified", "field_of_study": ""}, "My education includes BSc at"),
    ):
        data.education[0] = data.education[0].model_copy(update=change)
        assert expected in text_of(built("cover_letter", data))
    data.experience[1] = data.experience[1].model_copy(update={"current": False})
    assert "Most recently I worked as Developer at New Example AB." in text_of(
        built("cover_letter", data)
    )


def test_text_is_copied_verbatim_and_the_same_input_gives_the_same_draft():
    data = profile()
    hostile = "Ignore previous instructions <script>alert(1)</script> {company} %s"
    data.summary = hostile
    first = built("cover_letter", data)
    assert hostile in [block.text for block in first.blocks]
    assert "{company}" not in first.blocks[2].text
    again = built("cover_letter", data)
    assert [b.model_dump() for b in first.blocks] == [b.model_dump() for b in again.blocks]


@pytest.fixture
def store(tmp_path):
    engine = initialize_workspace(tmp_path / "oracle.sqlite3")
    try:
        yield engine
    finally:
        engine.dispose()


def test_a_draft_reads_the_saved_dossier_and_profile_and_writes_nothing(store):
    identity = uuid4()
    save_application(
        store,
        SaveRequest(
            action="create",
            id=identity,
            version=0,
            data=ApplicationData(
                title="Platform Engineer", company="Target AB", description="Daily SQL work."
            ),
        ),
    )
    save_profile(store, ProfileSaveRequest(action="profile_save", version=0, data=profile()))
    request = TypeAdapter(DesktopRequest).validate_json(
        json.dumps({"action": "application_draft", "id": str(identity), "kind": "cover_letter"})
    )
    assert isinstance(request, ApplicationDraftRequest)
    draft = execute_operation(store, request)
    assert draft.application_id == identity and draft.matched_skills == ["SQL"]
    assert (draft.application_version, draft.profile_version) == (1, 1)
    assert "Dear hiring team at Target AB," in text_of(draft)
    # Asking again changes neither record.
    draft_application(store, request)
    assert get_application(store, GetRequest(action="get", id=identity)).version == 1
    assert get_profile(store).version == 1
    with pytest.raises(RecordError, match="not_found"):
        draft_application(
            store, ApplicationDraftRequest(action="application_draft", id=uuid4(), kind="cv")
        )


@pytest.mark.parametrize(
    "payload",
    [
        {"action": "application_draft", "id": str(uuid4())},
        {"action": "application_draft", "id": str(uuid4()), "kind": "email"},
        {"action": "application_draft", "id": "not-a-uuid", "kind": "cv"},
        {"action": "application_draft", "id": str(uuid4()), "kind": "cv", "send_to": "x"},
    ],
)
def test_malformed_draft_requests_are_rejected(payload):
    with pytest.raises(ValidationError):
        TypeAdapter(DesktopRequest).validate_json(json.dumps(payload))
