"""Rule-based comparison of a listing with the owner's confirmed profile and saved preferences.

Fixed, readable rules only: whole-term text matches and set comparisons. No model, no score and
no decision. A hit means the listing's wording contains the owner's term, quoted back as an
excerpt so the owner can judge it. Nothing is stored; the result is rebuilt on each read.
"""

import re
from dataclasses import dataclass

from app.schemas.listings import FitFinding, ListingFit, RequirementLine
from app.schemas.profile import CandidateData
from app.services.listing_normalizer import EMPLOYMENT_TYPES, WORK_MODES, company_key, mentions

FIT_RULES_VERSION = 1
MAX_EXCERPT = 200
MAX_REQUIREMENT_LINES = 30
MAX_FINDINGS = 200
# Wording that usually introduces what an employer asks for, in English and Swedish.
REQUIREMENT_CUES = (
    "require",
    "must have",
    "must-have",
    "qualification",
    "you have",
    "you need",
    "we expect",
    "experience with",
    "experience in",
    "experience of",
    "knowledge of",
    "proficien",
    "krav",
    "ska ha",
    "bör ha",
    "erfarenhet av",
    "kunskap",
    "meriterande",
)


@dataclass(frozen=True)
class Term:
    text: str
    source: str
    pattern: re.Pattern[str]


def term_pattern(term: str) -> re.Pattern[str] | None:
    """Whole-term and case-insensitive; spaces match any whitespace. One-character terms skip."""
    words = term.casefold().split()
    if not words or len("".join(words)) < 2:
        return None
    body = r"\s+".join(re.escape(word) for word in words)
    # "c" must not match inside "c++" or "c#", nor "net" inside ".net".
    return re.compile(rf"(?<![\w+#.]){body}(?![\w+#])")


def profile_terms(data: CandidateData) -> list[Term]:
    """Confirmed skill names, then project technologies, without repeats."""
    terms: list[Term] = []
    seen: set[str] = set()
    candidates = [(skill.name, "skill") for skill in data.skills]
    candidates += [
        (technology, "project_technology")
        for project in data.projects
        for technology in project.technologies
    ]
    for text, source in candidates:
        key = " ".join(text.casefold().split())
        pattern = term_pattern(text)
        if pattern is not None and key not in seen:
            seen.add(key)
            terms.append(Term(text, source, pattern))
    return terms


def excerpt(text: str, start: int, end: int) -> str:
    """The surrounding words on one line, so the owner can see the hit in context."""
    left = max(0, start - 70)
    right = min(len(text), end + 70)
    piece = " ".join(text[left:right].split())
    return (("…" if left else "") + piece + ("…" if right < len(text) else ""))[:MAX_EXCERPT]


def find(pattern: re.Pattern[str], text: str, folded: str) -> str | None:
    hit = pattern.search(folded)
    # Case folding can change length for a few characters; fall back to a plain search then.
    if hit is None:
        return None
    if len(folded) != len(text):
        return excerpt(folded, hit.start(), hit.end())
    return excerpt(text, hit.start(), hit.end())


def phrase_findings(
    topic: str,
    phrases: list[str],
    outcome: str,
    fields: list[str],
) -> list[FitFinding]:
    """One finding per saved phrase that appears, or one saying none appeared or none is saved."""
    if not phrases:
        return [FitFinding(topic=topic, outcome="not_set", term="", source="", excerpts=[])]
    found = []
    for phrase in phrases:
        pattern = term_pattern(phrase)
        if pattern is None:
            continue
        for field in fields:
            quote = find(pattern, field, field.casefold()) if field else None
            if quote is not None:
                found.append(
                    FitFinding(
                        topic=topic,
                        outcome=outcome,
                        term=phrase,
                        source="preference",
                        excerpts=[quote],
                    )
                )
                break
    return found or [
        FitFinding(topic=topic, outcome="not_mentioned", term="", source="", excerpts=[])
    ]


def choice_findings(topic: str, preferred: list[str], mentioned: list[str]) -> list[FitFinding]:
    """Compare what the text mentions with what the owner chose. Mentions are not facts."""
    if not preferred:
        return [FitFinding(topic=topic, outcome="not_set", term="", source="", excerpts=[])]
    if not mentioned:
        return [FitFinding(topic=topic, outcome="not_mentioned", term="", source="", excerpts=[])]
    wanted = [value for value in mentioned if value in preferred]
    # When any mentioned option is one the owner wants, the others are alternatives, not conflicts.
    return [
        FitFinding(
            topic=topic,
            outcome="match" if wanted else "conflict",
            term=value,
            source="preference",
            excerpts=[],
        )
        for value in (wanted or mentioned)
    ]


def employer_findings(excluded: list[str], company: str, text: str) -> list[FitFinding]:
    """An excluded employer is a conflict when it is the listing's company or named in its text."""
    if not excluded:
        return [
            FitFinding(
                topic="excluded_employer", outcome="not_set", term="", source="", excerpts=[]
            )
        ]
    found = []
    folded = text.casefold()
    for employer in excluded:
        quote = None
        if company and company_key(employer) == company_key(company):
            quote = company
        else:
            pattern = term_pattern(employer)
            quote = find(pattern, text, folded) if pattern is not None else None
        if quote is not None:
            found.append(
                FitFinding(
                    topic="excluded_employer",
                    outcome="conflict",
                    term=employer,
                    source="preference",
                    excerpts=[quote],
                )
            )
    return found or [
        FitFinding(
            topic="excluded_employer", outcome="not_mentioned", term="", source="", excerpts=[]
        )
    ]


def requirement_lines(text: str, terms: list[Term]) -> list[RequirementLine]:
    lines = []
    for line in text.split("\n"):
        folded = line.casefold()
        if not any(cue in folded for cue in REQUIREMENT_CUES):
            continue
        lines.append(
            RequirementLine(
                text=line[:300],
                covered_by=[term.text for term in terms if term.pattern.search(folded)][:10],
            )
        )
        if len(lines) == MAX_REQUIREMENT_LINES:
            break
    return lines


def assess(
    data: CandidateData,
    profile_version: int,
    *,
    text: str,
    title: str,
    company: str,
    location: str,
    terms: list[Term] | None = None,
) -> ListingFit:
    """`text` is the cleaned listing text; the other fields are the owner's own entries."""
    terms = profile_terms(data) if terms is None else terms
    preferences = data.preferences
    folded = text.casefold()
    findings = phrase_findings("target_role", preferences.target_roles, "match", [title, text])
    findings += phrase_findings("location", preferences.locations, "match", [location, text])
    findings += choice_findings("work_mode", preferences.work_modes, mentions(text, WORK_MODES))
    findings += choice_findings(
        "employment_type", preferences.employment_types, mentions(text, EMPLOYMENT_TYPES)
    )
    findings += employer_findings(preferences.excluded_employers, company, text)
    findings += phrase_findings(
        "excluded_keyword", preferences.excluded_keywords, "conflict", [title, text]
    )
    for term in terms:
        quote = find(term.pattern, text, folded)
        if quote is not None:
            findings.append(
                FitFinding(
                    topic="skill",
                    outcome="match",
                    term=term.text,
                    source=term.source,
                    excerpts=[quote],
                )
            )
    return ListingFit(
        rules_version=FIT_RULES_VERSION,
        profile_version=profile_version,
        terms_checked=len(terms),
        findings=findings[:MAX_FINDINGS],
        requirement_lines=requirement_lines(text, terms),
    )


def tally(fit: ListingFit) -> tuple[int, int]:
    """Matched profile terms and conflicts, for the listing index."""
    return (
        sum(f.topic == "skill" for f in fit.findings),
        sum(f.outcome == "conflict" for f in fit.findings),
    )
