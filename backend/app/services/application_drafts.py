"""Assemble CV and cover-letter drafts from the owner's profile with fixed templates.

Rules only. Template sentences are written here; everything else is copied from the profile or
the dossier without rewording. The one piece of tailoring is order: skills the dossier's job text
mentions come first. Nothing is stored and nothing leaves the process.
"""

from uuid import UUID

from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.models.applications import Application, Job
from app.models.profile import Profile
from app.schemas.application_drafts import (
    TEMPLATE_VERSION,
    ApplicationDraft,
    ApplicationDraftRequest,
    DraftBlock,
    DraftKind,
)
from app.schemas.profile import CandidateData, Education, Experience, Period
from app.services.applications import RecordError
from app.services.listing_fit import term_pattern
from app.services.profile import record

MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
MAX_LETTER_SKILLS = 8


def month(value: str) -> str:
    return f"{MONTHS[int(value[5:]) - 1]} {value[:4]}" if value else ""


def period(entry: Period) -> str:
    end = "Present" if entry.current else month(entry.end_month)
    return " – ".join(part for part in (month(entry.start_month), end) if part)


def newest_first(entries: list) -> list:
    """Current entries, then by when they ended or began, latest first. Ties keep their order."""
    return sorted(
        entries,
        key=lambda entry: (entry.current, entry.end_month or entry.start_month),
        reverse=True,
    )


def listed(words: list[str]) -> str:
    return words[0] if len(words) == 1 else ", ".join(words[:-1]) + " and " + words[-1]


def lines(*parts: str) -> str:
    return "\n".join(part for part in parts if part.strip())


def block(
    heading: str, text: str, sources: list[str], uses_application: bool = False
) -> DraftBlock:
    return DraftBlock(
        heading=heading, text=text, sources=sources, uses_application=uses_application
    )


def mentioned_skills(data: CandidateData, job_text: str) -> list:
    """The owner's skills whose names appear as whole terms in the dossier's job text."""
    folded = job_text.casefold()
    found = []
    for skill in data.skills:
        pattern = term_pattern(skill.name)
        if pattern is not None and pattern.search(folded):
            found.append(skill)
    return found


def header(data: CandidateData, fields: tuple[str, ...]) -> list[DraftBlock]:
    present = [name for name in fields if getattr(data, name).strip()]
    text = lines(*(getattr(data, name) for name in present))
    return [block("", text, present)] if present else []


def cv(data: CandidateData, matched: list) -> list[DraftBlock]:
    blocks = header(data, ("full_name", "headline", "location"))
    if data.summary.strip():
        blocks.append(block("SUMMARY", data.summary, ["summary"]))
    for entry in newest_first(data.experience):
        place = f" — {entry.location}" if entry.location.strip() else ""
        text = lines(f"{entry.role}, {entry.organization}{place}", period(entry), entry.description)
        blocks.append(block("EXPERIENCE", text, [f"experience/{entry.id}"]))
    for entry in newest_first(data.education):
        field = f", {entry.field_of_study}" if entry.field_of_study.strip() else ""
        state = " (in progress)" if entry.completion == "in_progress" else ""
        text = lines(
            f"{entry.qualification}{field} — {entry.institution}",
            period(entry) + state,
            entry.details,
        )
        blocks.append(block("EDUCATION", text, [f"education/{entry.id}"]))
    # One line per category in the order categories first appear; mentioned skills lead each.
    first = {skill.id for skill in matched}
    categories: dict[str, list] = {}
    for skill in sorted(data.skills, key=lambda skill: skill.id not in first):
        categories.setdefault(skill.category.strip(), []).append(skill)
    for category, skills in categories.items():
        names = ", ".join(skill.name for skill in skills)
        text = f"{category}: {names}" if category else names
        blocks.append(block("SKILLS", text, [f"skills/{skill.id}" for skill in skills]))
    for entry in newest_first(data.projects):
        role = f" — {entry.role}" if entry.role.strip() else ""
        used = "Technologies: " + ", ".join(entry.technologies) if entry.technologies else ""
        text = lines(f"{entry.name}{role}", period(entry), entry.description, used, entry.url)
        blocks.append(block("PROJECTS", text, [f"projects/{entry.id}"]))
    for entry in data.certifications:
        dates = ", ".join(
            part
            for part in (
                month(entry.issued_month),
                f"expires {month(entry.expires_month)}" if entry.expires_month else "",
            )
            if part
        )
        title = f"{entry.name}, {entry.issuer}" + (f" ({dates})" if dates else "")
        text = lines(title, entry.credential_reference, entry.details)
        blocks.append(block("CERTIFICATIONS", text, [f"certifications/{entry.id}"]))
    return blocks


def work_sentence(entry: Experience) -> str:
    verb = "have been working" if entry.current else "worked"
    return f"Most recently I {verb} as {entry.role} at {entry.organization}."


def study_sentence(entry: Education) -> str:
    what = entry.qualification + (
        f" in {entry.field_of_study}" if entry.field_of_study.strip() else ""
    )
    if entry.completion == "completed":
        return f"I completed {what} at {entry.institution}."
    if entry.current or entry.completion == "in_progress":
        return f"I am studying {what} at {entry.institution}."
    return f"My education includes {what} at {entry.institution}."


def cover_letter(data: CandidateData, matched: list, title: str, company: str) -> list[DraftBlock]:
    title, company = title.strip(), company.strip()
    blocks = header(data, ("full_name", "location"))
    subject = ", ".join(part for part in (title, company) if part)
    if subject:
        blocks.append(block("", f"Application: {subject}", [], True))
    greeting = f"Dear hiring team at {company}," if company else "Dear hiring team,"
    blocks.append(block("", greeting, [], bool(company)))
    if title:
        opening = f"I am writing to apply for the {title} position."
    elif company:
        opening = f"I am writing to apply for a position at {company}."
    else:
        opening = "I am writing to apply for this position."
    blocks.append(block("", opening, [], bool(title or company)))
    if data.summary.strip():
        blocks.append(block("", data.summary, ["summary"]))
    if matched:
        chosen = matched[:MAX_LETTER_SKILLS]
        names = listed([skill.name for skill in chosen])
        blocks.append(
            block(
                "",
                f"The description of the role mentions {names}, which "
                f"{'is' if len(chosen) == 1 else 'are'} among my skills.",
                [f"skills/{skill.id}" for skill in chosen],
            )
        )
    for entry in newest_first(data.experience)[:1]:
        blocks.append(block("", work_sentence(entry), [f"experience/{entry.id}"]))
    for entry in newest_first(data.education)[:1]:
        blocks.append(block("", study_sentence(entry), [f"education/{entry.id}"]))
    blocks.append(
        block("", "I would welcome the chance to tell you more. Thank you for your time.", [])
    )
    name = data.full_name.strip()
    blocks.append(
        block("", lines("Kind regards,", data.full_name), ["full_name"] if name else [])
    )
    return blocks


def compose(
    kind: DraftKind,
    data: CandidateData,
    profile_version: int,
    application_id: UUID,
    application_version: int,
    title: str,
    company: str,
    job_text: str,
) -> ApplicationDraft:
    matched = mentioned_skills(data, job_text)
    blocks = (
        cv(data, matched) if kind == "cv" else cover_letter(data, matched, title, company)
    )
    missing = {
        "full_name": not data.full_name.strip(),
        "summary": not data.summary.strip(),
        "experience": not data.experience,
        "education": not data.education,
        "skills": not data.skills,
        "title": not title.strip(),
        "company": not company.strip(),
    }
    return ApplicationDraft(
        kind=kind,
        template_version=TEMPLATE_VERSION,
        application_id=application_id,
        application_version=application_version,
        profile_version=profile_version,
        blocks=blocks,
        gaps=[name for name, absent in missing.items() if absent],
        matched_skills=[skill.name for skill in matched],
    )


def draft_application(engine: Engine, request: ApplicationDraftRequest) -> ApplicationDraft:
    """Read the dossier and the profile, and build the draft. Writes nothing."""
    with Session(engine) as session, session.begin():
        application = session.get(Application, str(request.id))
        if application is None:
            raise RecordError("not_found")
        job = session.get(Job, application.job_id)
        profile = record(session.get(Profile, 1))
        return compose(
            request.kind,
            profile.data,
            profile.version,
            UUID(application.id),
            application.version,
            job.title,
            job.company,
            lines(job.title, job.description),
        )
