"""Synthetic ZIP/XML fixtures: no personal spreadsheet data lives in tests."""

import hashlib
from io import BytesIO
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.workspace import initialize_workspace
from app.models.applications import Application, ImportBatch, ImportedRow, Job
from app.schemas.applications import ApplicationData, GetRequest, ListRequest, SaveRequest
from app.services.applications import execute
from app.services.spreadsheet_import import HEADERS, import_workbook, parse


def workbook(*, formula=False, bad_header=False, invalid_last=False):
    """Minimal OOXML with a company-only row, numeric date and hidden hyperlink."""

    def cell(coordinate, value):
        return f'<c r="{coordinate}" t="inlineStr"><is><t>{escape(value)}</t></is></c>'

    headers = list(HEADERS)
    if bad_header:
        headers[0] = "Unexpected"
    heading = "".join(cell(f"{chr(66 + i)}2", value) for i, value in enumerate(headers))
    data = cell("B3", "Engineer Å") + cell("C3", "Example")
    data += '<c r="G3" s="1"><v>46288</v></c>'
    if formula:
        data += '<c r="N3"><f>HYPERLINK("file:///secret")</f><v>0</v></c>'
    else:
        data += cell("N3", "Keep this note")
    last = cell("N4" if invalid_last else "C4", "Company only")
    files = {
        "[Content_Types].xml": """<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
          <Override PartName="/xl/workbook.xml"
          ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
          </Types>""",
        "xl/workbook.xml": """<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <sheets><sheet name="Job Application Log" sheetId="1" r:id="rId1"/></sheets>
          </workbook>""",
        "xl/_rels/workbook.xml.rels": """<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1"
          Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"
          Target="worksheets/sheet1.xml"/>
          </Relationships>""",
        "xl/styles.xml": """<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <fonts count="1"><font><name val="Calibri"/><sz val="11"/></font></fonts>
          <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
          <borders count="1"><border/></borders>
          <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
          </cellStyleXfs>
          <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
          <xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
          <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
          </styleSheet>""",
        "xl/worksheets/sheet1.xml": f"""<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <sheetData><row r="2">{heading}</row><row r="3">{data}</row><row r="4">{last}</row>
          </sheetData>
          <hyperlinks><hyperlink ref="C3" r:id="rId1"/></hyperlinks></worksheet>""",
        "xl/worksheets/_rels/sheet1.xml.rels": """<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"
          Target="https://example.test/company" TargetMode="External"/></Relationships>""",
    }
    output = BytesIO()
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        for name, value in files.items():
            archive.writestr(name, value)
    return output.getvalue()


def test_preserves_partial_rows_dates_notes_and_embedded_links():
    rows = parse(workbook())
    assert len(rows) == 2
    assert rows[0].data.title == "Engineer Å"
    assert rows[0].data.resume_sent == "2026-09-23"
    assert rows[0].data.status == "Unspecified"
    assert rows[0].original["notes"] == "Keep this note"
    assert rows[0].links == {"C3": "https://example.test/company"}
    assert rows[1].number == 4 and rows[1].data.title == ""


@pytest.mark.parametrize(
    "options", [{"formula": True}, {"bad_header": True}, {"invalid_last": True}]
)
def test_invalid_import_never_partially_commits(tmp_path, options):
    source = tmp_path / "log.xlsx"
    source.write_bytes(workbook(**options))
    engine = initialize_workspace(tmp_path / "test.sqlite3")
    try:
        with pytest.raises(ValueError):
            import_workbook(engine, source)
        with Session(engine) as session:
            for model in (Job, Application, ImportBatch, ImportedRow):
                assert session.scalar(select(func.count()).select_from(model)) == 0
    finally:
        engine.dispose()


def test_import_idempotency_and_provenance_survive_edits(tmp_path):
    source = tmp_path / "log.xlsx"
    raw = workbook()
    source.write_bytes(raw)
    engine = initialize_workspace(tmp_path / "test.sqlite3")
    try:
        assert import_workbook(engine, source)["imported"] == 2
        listed = execute(engine, ListRequest(action="list", query="Engineer"))["items"]
        record = execute(engine, GetRequest(action="get", id=listed[0]["id"]))
        changed = execute(
            engine,
            SaveRequest(
                action="update",
                id=record["id"],
                version=1,
                data=ApplicationData(**{**record["data"], "notes": "Updated in Oracle"}),
            ),
        )
        assert changed["imported"]["original"]["notes"] == "Keep this note"
        assert import_workbook(engine, source)["already_imported"] == 2
        assert execute(engine, ListRequest(action="list"))["total"] == 2
        assert source.read_bytes() == raw
        assert import_workbook(engine, source)["sha256"] == hashlib.sha256(raw).hexdigest()
    finally:
        engine.dispose()


def test_zip_expansion_is_bounded():
    output = BytesIO()
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        archive.writestr("xl/worksheets/sheet1.xml", b" " * (21 * 1024 * 1024))
    with pytest.raises(ValueError, match="limits"):
        parse(output.getvalue())
