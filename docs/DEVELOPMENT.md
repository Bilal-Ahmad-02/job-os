# Current development and verification

This is the current setup guide. Historical milestone text elsewhere is retained for context.
Read `AGENTS.md` first. Existing environments are already provisioned; do not reinstall them simply
to start a session. Production uses installed releases, not either development checkout.

## Platform ownership

| Responsibility | Environment |
| --- | --- |
| Python development and primary tests | Ubuntu WSL2, `~/projects/oracle`, Python 3.12 |
| React, Rust/Tauri and Windows executable | Windows, `C:\Personal projects\Job-os` |
| Record data | Private Linux directory `~/.local/share/oracle` |
| Password/rotation hashes, runtime selection, provider credentials | Windows AppData / Credential Manager |
| Routine app launch | Installed Oracle shortcut; no HTTP service |

Do not share virtual environments, Node modules or Rust build output between platforms.
`.gitattributes` keeps source in LF across operating systems; PowerShell scripts use CRLF and
icons remain binary. Do not override that policy with a global editor conversion.
Windows Python 3.11 remains a developer prerequisite for the cross-platform probes/legacy native
tests. It is not the production record backend.

## Clean Python development setup (Ubuntu)

Use a new clone when testing these instructions; never overwrite an existing checkout or virtualenv.
Prerequisites are Git, Ubuntu Python 3.12 and `python3-venv`.

```bash
git clone https://github.com/Bilal-Ahmad-02/job-os.git oracle
cd oracle
python3 -m venv .venv
.venv/bin/python -m pip install --require-hashes -r requirements-dev.txt
.venv/bin/python -m pip install --no-deps --no-build-isolation -e .
.venv/bin/python -m pip check
.venv/bin/ruff check backend/app tests scripts
.venv/bin/python -m pytest -q
```

Encrypted-backup tests require the reviewed restic executable at the path checked by
`app.backup.default_tool`. Read BACKUP.md for provisioning/checksums. A clean environment without
that tool can skip those tests; a skipped run does not establish recovery readiness. On this machine
the Linux and Windows tools are already provisioned. Do not install a random restic version to
satisfy the test suite. Tests use temporary synthetic records, never the live database.

## Windows desktop development

Prerequisites: Node.js 24, Rust 1.98.1 (pinned in `src-tauri/rust-toolchain.toml`), Visual Studio 2022
C++ build tools/Windows SDK, and WebView2. In PowerShell at `apps/desktop`:

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run check
npm.cmd test
npm.cmd run desktop
```

The development asset server listens only on `127.0.0.1:1420`. It is not a hosted product.
`desktop` uses the same local app identity and selected workspace as the installed app: do not use
it to experiment with private records. Use synthetic tests for mutations. Starting it does not
switch production to Python source from the development checkout.

From the Windows repository root, native checks are:

```powershell
cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml -- --check
cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo clippy --locked --manifest-path apps/desktop/src-tauri/Cargo.toml -- -D warnings
```

Two native tests are intentionally opt-in. Run their real WSL fixtures with:

```powershell
.\.venv\Scripts\python.exe scripts/check_wsl_native.py --runtime-project /home/lethargic/.local/share/oracle/runtime/releases/RELEASE_ID
.\.venv\Scripts\python.exe scripts/check_wsl_faults.py
.\.venv\Scripts\python.exe scripts/check_wsl_recovery.py
```

Replace `RELEASE_ID` with the installed digest from runtime configuration/HANDOFF.md. These probes
are deliberately tied to this owner's Ubuntu distribution and Linux account. Porting to another
account needs a reviewed adjustment; it is not an arbitrary renderer-configurable path.
Use `--cold-start` only when no other WSL work is running. It waits for natural shutdown and does
not authorize terminating the distribution or other applications.

If Windows developer Python must be recreated, use Python 3.11 at the Windows repository root:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --use-feature=truststore --require-hashes -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pip install --no-deps --no-build-isolation -e .
```

Modern pip already uses system certificate trust; never disable TLS verification. A fresh clone
is source, not a populated personal installation. Follow BACKUP.md for staged private-data recovery.

## Deploying changes

Follow RUNTIME_RELEASES.md. Build/install backend changes in a new immutable Linux release, test it
through the Windows transport, stop only Oracle, select the release, install the desktop build and
reopen it. Frontend-only changes do not require a new backend release. Retain previous releases.
Validate private data via Linux maintenance when a migration or runtime selection warrants it.

For source handoffs: inspect both trees; commit reviewed files; preserve local changes before
fast-forwarding the other checkout. A stash is a recovery copy, not permission to drop changes.
Never copy generated directories. Normal line endings may differ; compare Git blob content or
explicitly normalized text when appropriate, and compare binary assets byte-for-byte.

## Optional HTTP diagnostic

`python -m app` starts only the loopback FastAPI `/health` service, not the record worker.
It is unnecessary for normal use. The system drawer runs its diagnostic only after an explicit
click; unavailable means that diagnostic did not respond. Module errors describe record failures.
The public local health endpoint has no record data; do not add private HTTP routes without
designing authentication and lifecycle ownership. Never expose it through a public tunnel.

`JOB_OS_PORT` defaults to 8000 (1024-65535), `JOB_OS_LOG_LEVEL` to `info`, and
`JOB_OS_ALLOW_DESKTOP_DEV_ORIGIN` to false. `.env` files are not loaded automatically. The desktop
diagnostic uses fixed port 8000. Do not start another process on an occupied port.

## Dependencies

Keep all three ecosystems' lockfiles. `requirements*.txt` use hashes and are exercised on Windows
3.11 and Ubuntu 3.12; `package-lock.json` and `Cargo.lock` retain reviewed versions.
Do not regenerate everything merely because a coding assistant changed. See SECURITY_REVIEW.md
for outstanding upstream advisories and their actual platform applicability.

When intentionally changing Python dependencies, compile the runtime lock first with
`piptools compile --generate-hashes --strip-extras --no-emit-index-url --no-build-isolation
--output-file requirements.txt pyproject.toml`; then compile the dev lock with `--extra dev
--allow-unsafe --constraint requirements.txt --output-file requirements-dev.txt` and the same
hash/index/build flags. Review the delta and verify fresh environments on both supported platforms.
