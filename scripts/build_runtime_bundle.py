"""Build a Linux runtime wheelhouse from explicit source and hashed dependency locks."""

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build(destination: Path) -> str:
    if sys.platform != "linux":
        raise RuntimeError("Build the backend bundle on Linux")
    destination = destination.absolute()
    destination.mkdir(parents=True, exist_ok=False)
    wheels = destination / "wheels"
    wheels.mkdir()
    # Stage only code and build metadata. Never walk private data or copy a checkout wholesale.
    with tempfile.TemporaryDirectory(prefix="oracle-build-") as folder:
        stage = Path(folder)
        sources = {}
        paths = [ROOT / name for name in ("pyproject.toml", "README.md", "requirements.txt")]
        paths.extend(sorted((ROOT / "backend/app").rglob("*.py")))
        for source in paths:
            if source.is_symlink() or source.resolve() != source:
                raise RuntimeError("Symlinked build input")
            relative = source.relative_to(ROOT)
            target = stage / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            sources[relative.as_posix()] = digest(target)
        subprocess.run(  # noqa: S603 -- fixed packaging command, reviewed local source
            [
                sys.executable,
                "-I",
                "-m",
                "pip",
                "--isolated",
                "wheel",
                "--no-deps",
                "--no-build-isolation",
                "--no-index",
                "--wheel-dir",
                str(wheels),
                str(stage),
            ],
            check=True,
            timeout=120,
        )
        shutil.copyfile(stage / "requirements.txt", destination / "requirements.txt")
    subprocess.run(  # noqa: S603 -- pinned, hash-checked binary dependencies only
        [
            sys.executable,
            "-I",
            "-m",
            "pip",
            "--isolated",
            "download",
            "--require-hashes",
            "--only-binary=:all:",
            "--index-url",
            "https://pypi.org/simple",
            "--dest",
            str(wheels),
            "-r",
            str(destination / "requirements.txt"),
        ],
        check=True,
        timeout=300,
    )
    app_wheels = list(wheels.glob("job_os_backend-*.whl"))
    if len(app_wheels) != 1:
        raise RuntimeError("Expected one application wheel")
    inventory = {
        path.relative_to(destination).as_posix(): digest(path)
        for path in sorted(destination.rglob("*"))
        if path.is_file()
    }
    manifest = {
        "format": 1,
        "python": list(sys.version_info[:2]),
        "platform": "linux",
        "application": app_wheels[0].name,
        "files": inventory,
        "sources": sources,
    }
    raw = (json.dumps(manifest, sort_keys=True, indent=2) + "\n").encode()
    (destination / "manifest.json").write_bytes(raw)
    return hashlib.sha256(raw).hexdigest()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path)
    print(json.dumps({"release": build(parser.parse_args().destination)}))
