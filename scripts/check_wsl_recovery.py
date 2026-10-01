"""Prove encrypted Windows/Linux recovery using a disposable synthetic repository."""

import inspect
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from uuid import uuid4

from prepare_wsl_backup import prepare
from workspace_fingerprint import fingerprint

from app.backup import default_tool
from app.db.workspace import initialize_workspace
from app.schemas.applications import ApplicationData, SaveRequest
from app.schemas.profile import CandidateData
from app.schemas.review import ReviewSaveRequest
from app.services.applications import execute
from app.services.backup_snapshot import DATABASE, FILES, verify_snapshot
from app.services.documents import import_documents, read_document
from app.services.encrypted_backup import ResticBackup
from app.services.evidence import extract_document, store_draft
from app.services.review import get_review, save_review

ROOT = Path(__file__).resolve().parents[1]
PASSWORD = "synthetic cross-platform recovery only"  # noqa: S105 -- disposable test secret


LINUX = '''
import hashlib,json,os,sqlite3,sys,tempfile
from pathlib import Path
from contextlib import closing
from app.backup import default_tool
from app.services.encrypted_backup import ResticBackup
from app.services.backup_snapshot import DATABASE,FILES,verify_snapshot
os.umask(0o077)
'''
LINUX_STAGE = '''
sys.path.insert(0,str(Path.home()/'projects/oracle/scripts'))
from stage_wsl_restore import stage
repository=Path(sys.argv[1])
snapshot=sys.argv[2]
receipt=json.loads(Path(sys.argv[3]).read_text())
backup=ResticBackup(default_tool(),repository,"synthetic cross-platform recovery only")
with tempfile.TemporaryDirectory(prefix='oracle-recovery-test-',
                                 dir=Path.home()/'projects/oracle/.cache') as temporary:
    root=Path(temporary)
    restored=stage(receipt,backup,root)
    manifest=verify_snapshot(restored)
    if set(p.name for p in restored.iterdir())!=set(FILES):
        raise RuntimeError('Unexpected restored file')
    if restored.stat().st_mode & 0o077 or any(p.stat().st_mode & 0o077 for p in restored.iterdir()):
        raise RuntimeError('Restored permissions are not private')
    result={'tables':fingerprint(restored/DATABASE),'manifest':manifest.model_dump(mode='json')}
    result['linux_snapshot']=backup.create(restored/DATABASE)
    backup.check()
    print(json.dumps(result))
'''


def populate(root: Path) -> Path:
    # Reuse existing synthetic PDF/citation builders; no owner data or source PDFs.
    sys.path.insert(0, str(ROOT / "tests"))
    from test_evidence import proposal, text_pdf

    source = root / "source"
    source.mkdir()
    database = source / DATABASE
    engine = initialize_workspace(database)
    try:
        execute(engine, SaveRequest(action="create", id=uuid4(), version=0,
                                    data=ApplicationData(company="Synthetic recovery candidate")))
        original = import_documents(
            engine, [read_document("cv", text_pdf(root / "synthetic.pdf"))]
        )[0]
        extract_document(engine, original)
        store_draft(engine, proposal(original))
        state = get_review(engine)
        save_review(engine, ReviewSaveRequest(
            action="profile_review_save", version=state.version,
            profile_version=state.profile.version, draft_sha256=state.draft_sha256,
            target="full_name", decision="approved",
            data=CandidateData(full_name="Synthetic approved candidate"),
        ))
        import_documents(engine, [read_document(
            "cv", text_pdf(root / "synthetic-revised.pdf", "Synthetic Candidate revised")
        )], replaces=original)
    finally:
        engine.dispose()
    (source / "password.phc").write_text("synthetic sentinel: must never be backed up")
    return database


def main() -> None:
    if os.name != "nt":
        raise SystemExit("Run this recovery probe on Windows")
    cache = (ROOT / ".cache").resolve(strict=True)
    if not cache.is_relative_to(ROOT.resolve()):
        raise RuntimeError("Unexpected temporary root")
    with tempfile.TemporaryDirectory(prefix="oracle-recovery-test-", dir=cache) as temporary:
        root = Path(temporary)
        database = populate(root)
        original = fingerprint(database)
        backup = ResticBackup(default_tool(), root / "encrypted", PASSWORD)
        backup.initialize()
        receipt_path = prepare(database, backup.repository, PASSWORD)
        receipt = json.loads(receipt_path.read_text())
        if receipt["tables"] != original:
            raise RuntimeError("Migration receipt comparison failed")
        snapshot = receipt["snapshot"]
        first = root / "windows-verification"
        backup.restore(snapshot, first, root)
        manifest = verify_snapshot(first).model_dump(mode="json")
        if receipt["manifest"] != manifest:
            raise RuntimeError("Migration receipt manifest differs")
        repository = backup.repository.resolve()
        linux_repository = "/mnt/" + repository.drive[0].lower() + repository.as_posix()[2:]
        linux_receipt = "/mnt/" + receipt_path.drive[0].lower() + receipt_path.as_posix()[2:]
        code = LINUX + inspect.getsource(fingerprint) + LINUX_STAGE
        result = subprocess.run(  # noqa: S603 -- fixed synthetic recovery code, argv only
            [str(Path(os.environ["SystemRoot"]) / "System32/wsl.exe"),
             "--distribution", "Ubuntu", "--user", "lethargic", "--exec",
             "/home/lethargic/projects/oracle/.venv/bin/python", "-I", "-c", code,
             linux_repository, snapshot, linux_receipt], capture_output=True,
            timeout=180, check=True,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        linux = json.loads(result.stdout)
        if linux["tables"] != original or linux["manifest"] != manifest:
            raise RuntimeError("Windows-to-Linux recovery comparison failed")
        returned = root / "returned-from-linux"
        backup.restore(linux["linux_snapshot"], returned, root)
        if fingerprint(returned / DATABASE) != original:
            raise RuntimeError("Linux-to-Windows recovery comparison failed")
        if set(p.name for p in returned.iterdir()) != set(FILES):
            raise RuntimeError("Unexpected reverse-restored file")
        backup.check()
        print(json.dumps({"ok": True, "directions": 2, "tables": len(original),
                          "document_versions": original["document_versions"]["rows"],
                          "credentials_excluded": True, "data": "synthetic-only"}))


if __name__ == "__main__":
    main()
