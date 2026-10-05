"""Deterministic, offline normalization of a stored listing. No network, model or guessing.

Everything here is derived on request from the immutable original text and the owner's link.
Nothing is written back, so derived values can never replace owner-entered fields and a rule
change cannot leave stale stored results. Keyword hits mean "the text mentions this", not a fact.
"""

import re
import unicodedata
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from app.schemas.listings import NormalizedListing

RULES_VERSION = 1
MAX_LINKS = 10
MAX_TITLE = 120
TRACKING = ("utm_", "gclid", "fbclid", "mc_cid", "mc_eid", "msclkid")
LINK = re.compile(r"https?://[^\s<>\"'\\^`{|}]+")
# Format, surrogate, private-use and control characters carry no listing content.
DROPPED = {"Cc", "Cf", "Co", "Cs"}

WORK_MODES = {
    "remote": (r"\bremote\b", r"\bremotely\b", r"\bwork from home\b", r"\bwfh\b", r"\bdistans"),
    "hybrid": (r"\bhybrid",),
    "onsite": (r"\bon[- ]?site\b", r"\bin[- ]office\b", r"\bpå plats\b"),
}
EMPLOYMENT_TYPES = {
    "full_time": (r"\bfull[- ]?time\b", r"\bheltid"),
    "part_time": (r"\bpart[- ]?time\b", r"\bdeltid"),
    "contract": (r"\bcontractor\b", r"\bfreelance", r"\bcontract (?:role|position|basis)\b"),
    "temporary": (r"\btemporary\b", r"\bfixed[- ]term\b", r"\bvikariat", r"\bvisstid"),
    "internship": (r"\binternship", r"\bpraktik"),
    "traineeship": (r"\btrainee",),
}


def normalize_text(original: str) -> str:
    """Canonical composition, plain spaces and newlines, no invisible characters."""
    text = unicodedata.normalize("NFC", original).replace("\r\n", "\n").replace("\r", "\n")
    lines = []
    for line in text.split("\n"):
        cleaned = "".join(
            " " if character == "\t" or unicodedata.category(character) == "Zs" else character
            for character in line
            if character == "\t" or unicodedata.category(character) not in DROPPED
        )
        lines.append(re.sub(r" {2,}", " ", cleaned).strip())
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip("\n")


def suggested_title(text: str) -> str:
    first = text.split("\n", 1)[0]
    return first if len(first) <= MAX_TITLE else ""


def find_links(text: str) -> list[str]:
    links: list[str] = []
    for match in LINK.finditer(text):
        link = match.group().rstrip(".,;:!?)]")
        if len(link) <= 2000 and "://" in link[:8] and link not in links:
            links.append(link)
            if len(links) == MAX_LINKS:
                break
    return links


def canonical_url(url: str) -> str:
    """Lower-case scheme and host, no fragment, default port or tracking parameters."""
    try:
        parts = urlsplit(url)
        host = (parts.hostname or "").lower()
        if parts.scheme.lower() not in ("http", "https") or not host:
            return ""
        port = parts.port
    except ValueError:
        return ""
    scheme = parts.scheme.lower()
    if ":" in host:
        host = f"[{host}]"
    if port is not None and port != {"http": 80, "https": 443}[scheme]:
        host = f"{host}:{port}"
    query = urlencode(
        [
            (name, value)
            for name, value in parse_qsl(parts.query, keep_blank_values=True)
            if not name.lower().startswith(TRACKING)
        ]
    )
    result = urlunsplit((scheme, host, parts.path, query, ""))
    return result if len(result) <= 2000 else ""


def mentions(text: str, vocabulary: dict[str, tuple[str, ...]]) -> list[str]:
    folded = text.casefold()
    return [
        name
        for name, patterns in vocabulary.items()
        if any(re.search(pattern, folded) for pattern in patterns)
    ]


def normalize(original_text: str, url: str) -> NormalizedListing:
    text = normalize_text(original_text)
    return NormalizedListing(
        rules_version=RULES_VERSION,
        text=text,
        suggested_title=suggested_title(text),
        canonical_url=canonical_url(url),
        links=find_links(text),
        mentioned_work_modes=mentions(text, WORK_MODES),
        mentioned_employment_types=mentions(text, EMPLOYMENT_TYPES),
    )
