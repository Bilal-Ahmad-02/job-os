"""Synthetic checks for deterministic listing normalization. No network or private data."""

from uuid import uuid4

import pytest

from app.schemas.listings import (
    ListingCreateRequest,
    ListingFields,
    ListingGetRequest,
    ListingsListRequest,
    ListingUpdateRequest,
)
from app.services import listing_normalizer as rules
from app.services import listings

RAW = (
    "﻿  Senior Data   Engineer​ \r\n\r\n\r\n\r\n"
    "Hybrid role, full-time.\tApply at https://jobs.example.test/role/1?utm_source=x).\r"
    "Café team \x00\x07 works på plats in Stockholm.  \n\n"
)


def test_text_normalization_is_stable_and_removes_only_formatting_noise():
    text = rules.normalize_text(RAW)
    assert text == (
        "Senior Data Engineer\n\n"
        "Hybrid role, full-time. Apply at https://jobs.example.test/role/1?utm_source=x).\n"
        "Café team works på plats in Stockholm."
    )
    assert rules.normalize_text(text) == text
    assert rules.normalize_text("") == ""
    assert rules.normalize_text(" \t\r\n​") == ""


def test_derived_fields_report_mentions_links_and_a_bounded_title():
    result = rules.normalize(
        RAW, "HTTPS://Jobs.Example.TEST:443/role/1?utm_source=x&id=7&gclid=1#top"
    )
    assert result.rules_version == 1
    assert result.suggested_title == "Senior Data Engineer"
    assert result.links == ["https://jobs.example.test/role/1?utm_source=x"]
    assert result.canonical_url == "https://jobs.example.test/role/1?id=7"
    assert result.mentioned_work_modes == ["hybrid", "onsite"]
    assert result.mentioned_employment_types == ["full_time"]
    long_first_line = rules.normalize("x" * 121 + "\nSecond line", "")
    assert long_first_line.suggested_title == "" and long_first_line.canonical_url == ""


@pytest.mark.parametrize(
    "text,modes,kinds",
    [
        (
            "Arbete på distans, deltid eller heltid. Vikariat.",
            ["remote"],
            ["full_time", "part_time", "temporary"],
        ),
        (
            "Work remotely or on-site. Part time internship.",
            ["remote", "onsite"],
            ["part_time", "internship"],
        ),
        (
            "Trainee programme, fixed-term, contract position.",
            [],
            ["contract", "temporary", "traineeship"],
        ),
        ("We sign an employment contract. Internal tools. Remoteness matters.", [], []),
        ("", [], []),
    ],
)
def test_keyword_mentions_use_whole_terms(text, modes, kinds):
    result = rules.normalize(text, "")
    assert result.mentioned_work_modes == modes
    assert result.mentioned_employment_types == kinds


@pytest.mark.parametrize(
    "url,expected",
    [
        ("", ""),
        ("http://Example.test:80/a/?b=1&UTM_Medium=x", "http://example.test/a/?b=1"),
        ("https://example.test:8443/a b", "https://example.test:8443/a b"),
        ("https://user:secret@example.test/x", "https://example.test/x"),
        ("https://[::1]:443/x", "https://[::1]/x"),
        ("https://example.test:99999/x", ""),
        ("https://[bad/x", ""),
        ("javascript:alert(1)", ""),
        ("https:///nohost", ""),
    ],
)
def test_canonical_links_drop_credentials_tracking_and_invalid_values(url, expected):
    assert rules.canonical_url(url) == expected


def test_links_are_bounded_unique_and_never_fetched():
    text = " ".join(f"https://example.test/{index}," for index in range(15))
    text += " https://example.test/0 ftp://example.test/x http://" + "a" * 2100
    assert rules.find_links(text) == [f"https://example.test/{index}" for index in range(10)]


def test_adversarial_text_stays_within_bounds():
    hostile = ("क़" * 20000) + ("https://" * 3000) + ("‮" * 2000)
    result = rules.normalize(hostile, "")
    assert len(result.text) <= 150000 and len(result.links) <= 10
    assert "‮" not in result.text


def test_records_carry_derived_data_without_changing_stored_or_owner_fields(tmp_path):
    from app.db.workspace import initialize_workspace

    engine = initialize_workspace(tmp_path / "oracle.sqlite3")
    try:
        row = listings.create_listing(
            engine,
            ListingCreateRequest(
                action="listing_create", id=uuid4(), data=ListingFields(), original_text=RAW
            ),
        )
        assert row.original_text == RAW and row.data.title == ""
        assert row.normalized == rules.normalize(RAW, "")
        page = listings.list_listings(engine, ListingsListRequest(action="listings_list"))
        assert page.items[0].title == "" and page.items[0].suggested_title == "Senior Data Engineer"
        changed = listings.update_listing(
            engine,
            ListingUpdateRequest(
                action="listing_update",
                id=row.id,
                version=1,
                data=ListingFields(title="Owner title", url="https://Example.test/a#x"),
                archived=False,
                closed=False,
            ),
        )
        assert changed.data.title == "Owner title"
        assert changed.normalized.suggested_title == "Senior Data Engineer"
        assert changed.normalized.canonical_url == "https://example.test/a"
        assert changed.normalized.text == row.normalized.text
        manual = listings.create_listing(
            engine,
            ListingCreateRequest(
                action="listing_create", id=uuid4(), data=ListingFields(company="Example AB")
            ),
        )
        assert manual.normalized.text == "" and manual.normalized.suggested_title == ""
        assert (
            listings.get_listing(engine, ListingGetRequest(action="listing_get", id=row.id))
            == changed
        )
    finally:
        engine.dispose()
