import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("installer", ROOT / "scripts/install_runtime.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


@pytest.fixture
def bundle(tmp_path):
    folder = tmp_path / "bundle"
    (folder / "wheels").mkdir(parents=True)
    application = "job_os_backend-0.1.0-py3-none-any.whl"
    (folder / "wheels" / application).write_bytes(b"synthetic wheel")
    (folder / "requirements.txt").write_text("synthetic==1\n")
    files = {
        p.relative_to(folder).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in folder.rglob("*")
        if p.is_file()
    }
    manifest = {
        "format": 1,
        "python": list(sys.version_info[:2]),
        "platform": "linux",
        "application": application,
        "files": files,
        "sources": {},
    }
    (folder / "manifest.json").write_text(json.dumps(manifest))
    return folder


def test_verifies_every_bundle_byte_before_creating_a_release(bundle, tmp_path):
    _, identity = installer.verify_bundle(bundle)
    assert len(identity) == 64
    (bundle / "requirements.txt").write_text("modified")
    with pytest.raises(ValueError, match="digest"):
        installer.install(bundle, tmp_path / "releases")
    assert not (tmp_path / "releases").exists()


@pytest.mark.parametrize("change", ["extra", "missing", "symlink", "traversal", "python"])
def test_malformed_bundles_fail_closed(bundle, tmp_path, change):
    path = bundle / "manifest.json"
    manifest = json.loads(path.read_text())
    if change == "extra":
        (bundle / "unexpected").write_text("extra")
    elif change == "missing":
        (bundle / "requirements.txt").unlink()
    elif change == "symlink":
        (bundle / "requirements.txt").unlink()
        target = tmp_path / "external"
        target.write_text("synthetic==1\n")
        (bundle / "requirements.txt").symlink_to(target)
    elif change == "traversal":
        manifest["files"]["../external"] = "a" * 64
    else:
        manifest["python"] = [0, 0]
    path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError):
        installer.verify_bundle(bundle)


def test_install_never_overwrites_a_release_or_selects_an_incomplete_one(
    bundle, tmp_path, monkeypatch
):
    releases = tmp_path / "releases"
    _, identity = installer.verify_bundle(bundle)

    def interrupted(*args, **kwargs):
        raise RuntimeError("simulated interrupted installation")

    monkeypatch.setattr(installer.venv.EnvBuilder, "create", interrupted)
    with pytest.raises(RuntimeError, match="interrupted"):
        installer.install(bundle, releases)
    target = releases / identity
    assert (target / "install.pending").is_file()
    assert not (target / "release.json").exists()
    with pytest.raises(FileExistsError):
        installer.install(bundle, releases)


def test_runtime_root_rejects_symlinks_and_shared_permissions(tmp_path):
    real = tmp_path / "real"
    real.mkdir(mode=0o700)
    linked = tmp_path / "linked"
    linked.symlink_to(real, target_is_directory=True)
    with pytest.raises(ValueError, match="Symlinked"):
        installer.private_directory(linked)
    real.chmod(0o755)
    with pytest.raises(ValueError, match="owner-only"):
        installer.private_directory(real)


selection_spec = importlib.util.spec_from_file_location(
    "selection", ROOT / "scripts/select_runtime_release.py"
)
selection = importlib.util.module_from_spec(selection_spec)
selection_spec.loader.exec_module(selection)


@pytest.fixture
def selected_workspace(tmp_path):
    config = {
        "version": 1,
        "runtime": "wsl",
        "distribution": "Ubuntu",
        "user": "synthetic",
        "project": "/home/synthetic/projects/oracle",
        "database": "/home/synthetic/.local/share/oracle/oracle.sqlite3",
        "workspace_id": "11111111-1111-4111-8111-111111111111",
    }
    (tmp_path / "runtime.json").write_text(json.dumps(config))
    (tmp_path / "runtime-wsl.selected").write_text("preserve rollback marker")
    (tmp_path / "password.phc").write_text("synthetic credential; never copied")
    return tmp_path, config


def test_selects_verified_release_atomically_and_preserves_prior_config(selected_workspace):
    directory, previous = selected_workspace
    raw = (directory / "runtime.json").read_bytes()
    checked = []
    backup = selection.select_release(directory, "a" * 64, checked.append)
    current = json.loads((directory / "runtime.json").read_text())
    assert checked == [current]
    assert current["version"] == 2 and current["project"].endswith("/" + "a" * 64)
    assert current["database"] == previous["database"]
    assert current["workspace_id"] == previous["workspace_id"]
    assert backup.read_bytes() == raw
    assert (directory / "password.phc").read_text() == "synthetic credential; never copied"
    assert (directory / "runtime-wsl.selected").read_text() == "preserve rollback marker"
    selection.select_release(directory, "a" * 64, checked.append)
    assert len(list(directory.glob("runtime-config-before-*"))) == 1


def test_failed_verification_and_pending_cutover_never_switch_runtime(selected_workspace):
    directory, _ = selected_workspace
    raw = (directory / "runtime.json").read_bytes()

    def failure(config):
        raise RuntimeError("synthetic failed probe")

    with pytest.raises(RuntimeError, match="failed probe"):
        selection.select_release(directory, "a" * 64, failure)
    assert (directory / "runtime.json").read_bytes() == raw
    assert not list(directory.glob("runtime-config-before-*"))
    (directory / "runtime-transition.pending").touch()
    with pytest.raises(RuntimeError, match="pending"):
        selection.select_release(directory, "a" * 64, lambda config: None)


def test_selection_detects_concurrent_configuration_change(selected_workspace):
    directory, _ = selected_workspace

    def changed(config):
        (directory / "runtime.json").write_text("changed during verification")

    with pytest.raises(RuntimeError, match="changed"):
        selection.select_release(directory, "a" * 64, changed)
    assert (directory / "runtime.json").read_text() == "changed during verification"
    assert not list(directory.glob("runtime-config-before-*"))


@pytest.mark.parametrize("release", ["../outside", "current", "a" * 63, "A" * 64])
def test_selection_rejects_unpinned_or_escaping_releases(selected_workspace, release):
    directory, _ = selected_workspace
    with pytest.raises(ValueError):
        selection.select_release(directory, release, lambda config: pytest.fail("must not probe"))
