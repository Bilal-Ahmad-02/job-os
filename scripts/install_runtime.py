"""Offline Linux runtime installation. Does not activate a release or open live data."""

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import venv
from pathlib import Path

HEX = re.compile(r"[0-9a-f]{64}")
SMOKE = """
import json,sys,tempfile
from pathlib import Path
import app
from app.db.workspace import initialize_workspace,prepare_workspace
from app.db.store import open_store,read_identity
from app.desktop_bridge import handle_request
from pypdf import PdfWriter
from uuid import uuid4
from app.services.documents import read_document,import_documents
root=Path(sys.prefix).resolve()
assert Path(app.__file__).resolve().is_relative_to(root)
assert not any('projects/oracle' in item for item in sys.path)
with tempfile.TemporaryDirectory(prefix='oracle-runtime-probe-') as folder:
    database=Path(folder)/'oracle.sqlite3'
    initialize_workspace(database).dispose()
    prepare_workspace(database)
    result=handle_request(database,b'{"action":"tasks_list"}')
    assert result.ok and result.result.items==[]
    result=handle_request(database,b'{"action":"listings_list"}')
    assert result.ok and result.result.total==0
    pdf=Path(folder)/'synthetic.pdf'
    writer=PdfWriter(); writer.add_blank_page(width=72,height=72); writer.write(pdf)
    engine=open_store(database)
    try: source=import_documents(engine,[read_document('cv',pdf)])[0]
    finally: engine.dispose()
    created=handle_request(database,json.dumps({'action':'task_create','id':str(uuid4()),'document_ids':[str(source)]}).encode())
    assert created.ok
    result=handle_request(database,json.dumps({'action':'task_advance','id':str(created.result.id),'version':1}).encode())
    assert result.ok and result.result.state=='failed' and result.result.error=='source_no_text'
print(json.dumps({'ok':True,'schema':'0010','installed_package':True}))
"""


def verify_bundle(bundle: Path) -> tuple[dict, str]:
    if bundle.resolve() != bundle or not bundle.is_dir():
        raise ValueError("Bundle must be a canonical directory")
    raw = (bundle / "manifest.json").read_bytes()
    if len(raw) > 256 * 1024:
        raise ValueError("Manifest too large")
    manifest = json.loads(raw)
    if (
        set(manifest) != {"format", "python", "platform", "application", "files", "sources"}
        or manifest["format"] != 1
        or manifest["python"] != list(sys.version_info[:2])
        or manifest["platform"] != "linux"
    ):
        raise ValueError("Incompatible runtime bundle")
    inventory = manifest["files"]
    if not isinstance(inventory, dict) or not 2 <= len(inventory) <= 100:
        raise ValueError("Invalid inventory")
    actual = set()
    for path in bundle.rglob("*"):
        if path.is_symlink() or not (path.is_file() or path.is_dir()):
            raise ValueError("Non-regular bundle entry")
        if path.is_file() and path != bundle / "manifest.json":
            actual.add(path.relative_to(bundle).as_posix())
    if actual != set(inventory):
        raise ValueError("Incomplete bundle")
    for name, expected in inventory.items():
        if name != "requirements.txt" and not re.fullmatch(r"wheels/[A-Za-z0-9_.+!-]+\.whl", name):
            raise ValueError("Unexpected bundle path")
        if not isinstance(expected, str) or not HEX.fullmatch(expected):
            raise ValueError("Invalid digest")
        if hashlib.sha256((bundle / name).read_bytes()).hexdigest() != expected:
            raise ValueError("Bundle digest mismatch")
    application = manifest["application"]
    if (
        not isinstance(application, str)
        or not re.fullmatch(r"job_os_backend-[A-Za-z0-9_.+!-]+\.whl", application)
        or f"wheels/{application}" not in inventory
    ):
        raise ValueError("Invalid application wheel")
    return manifest, hashlib.sha256(raw).hexdigest()


def private_directory(path: Path) -> None:
    if path.resolve() != path:
        raise ValueError("Symlinked runtime directory")
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    info = path.stat()
    if info.st_uid != os.getuid() or not stat.S_ISDIR(info.st_mode) or info.st_mode & 0o077:
        raise ValueError("Runtime directory must be owner-only")


def install(bundle: Path, releases: Path) -> Path:
    if sys.platform != "linux":
        raise RuntimeError("Install the runtime inside Linux")
    os.umask(0o077)
    manifest, identity = verify_bundle(bundle)
    private_directory(releases)
    target = releases / identity
    target.mkdir(mode=0o700)  # Never reuse, mutate or move an existing virtual environment.
    (target / "install.pending").write_text(identity + "\n")
    shutil.copytree(bundle, target / "bundle", symlinks=True)
    bundle = target / "bundle"
    if verify_bundle(bundle)[1] != identity:
        raise ValueError("Bundle changed while staging")
    environment = target / ".venv"
    venv.EnvBuilder(with_pip=True, symlinks=True).create(environment)
    python = environment / "bin/python"
    subprocess.run(  # noqa: S603 -- fixed interpreter and offline hashed requirements
        [
            str(python),
            "-I",
            "-m",
            "pip",
            "--isolated",
            "install",
            "--no-index",
            "--no-cache-dir",
            "--only-binary=:all:",
            "--require-hashes",
            "--find-links",
            str(bundle / "wheels"),
            "-r",
            str(bundle / "requirements.txt"),
        ],
        check=True,
        timeout=180,
    )
    app_wheel = bundle / "wheels" / manifest["application"]
    app_lock = target / "application.txt"
    app_digest = manifest["files"]["wheels/" + manifest["application"]]
    app_lock.write_text(f"{app_wheel.as_uri()} --hash=sha256:{app_digest}\n")
    subprocess.run(  # noqa: S603 -- exact reviewed application wheel; no dependency resolution
        [
            str(python),
            "-I",
            "-m",
            "pip",
            "--isolated",
            "install",
            "--no-index",
            "--no-deps",
            "--no-cache-dir",
            "--require-hashes",
            "-r",
            str(app_lock),
        ],
        check=True,
        timeout=120,
    )
    subprocess.run([str(python), "-I", "-m", "pip", "check"], check=True, timeout=30)  # noqa: S603
    with tempfile.TemporaryDirectory(prefix="oracle-runtime-cwd-") as cwd:
        subprocess.run([str(python), "-I", "-c", SMOKE], cwd=cwd, check=True, timeout=30)  # noqa: S603
    # Completion is published only after offline install and synthetic storage/IPC validation.
    with (target / "release.json").open("x") as stream:
        json.dump({"release": identity, "manifest": manifest}, stream, sort_keys=True)
        stream.flush()
        os.fsync(stream.fileno())
    (target / "install.pending").unlink()
    return target


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    args = parser.parse_args()
    releases = Path.home() / ".local/share/oracle/runtime/releases"
    private_directory(releases.parent)
    print(json.dumps({"installed": str(install(args.bundle.absolute(), releases))}))
