# Linux development and the Windows desktop

The backend development **and live record runtime** now use Ubuntu 24.04 on WSL2, Python 3.12.3,
and the independent development virtual environment in `~/projects/oracle`. The Tauri/React desktop and its
password gate stay on Windows. Production cutover completed on 2026-09-30.

## Active installation and completed cutover

Since 2026-10-01, production workers use a pinned, non-editable environment under
`~/.local/share/oracle/runtime/releases/<release-id>/.venv`. The development checkout remains the
place to edit/test backend source; it no longer supplies live worker code. Normal Windows launch
uses `%LOCALAPPDATA%\Programs\Oracle\releases`. See RUNTIME_RELEASES.md for building, verifying,
selecting and recovering installed releases. Runtime config version 2 restricts the project field
to this release root plus a 64-character lowercase digest; version 1 development configs remain
explicitly supported. No fallback occurs when a selected release is missing. Reviewed source
commits now align the checkouts; generated environments remain separate. Current source/release
state and test results are recorded in HANDOFF.md and VALIDATION.md.

The 2026-10-01 task milestone upgrades the active workspace to schema `0008`; see TASKS.md. Tasks
use the same authenticated, bounded Linux request path, one document at a time. There is no new
daemon or Windows database connection. The migration recovery copy and all existing rows/source
bytes were verified locally. That milestone's source handoff covered 192 files; platform dependencies
and credentials remain in their original environments. This is a historical milestone count.

- Active database: `/home/lethargic/.local/share/oracle/oracle.sqlite3`, with its matching identity
  marker. Directory permissions are 0700; files are 0600. Access it only through Linux workers or
  explicit Linux maintenance. Do not open a live SQLite connection through Windows shared paths.
- Windows `%LOCALAPPDATA%\local.oracle.desktop\runtime.json` selects Ubuntu, the explicit Linux user,
  installed interpreter release, database path, and workspace UUID. The Windows password hash stayed in place.
- The old Windows database/marker and any SQLite sidecars were moved out of the active path into a
  read-only `rollback-before-wsl-*` directory in private AppData. `runtime-wsl.selected` identifies
  that folder and the cutover snapshot. It is an inactive rollback copy, not a second live workspace.
- The desktop refuses startup while `runtime-transition.pending` exists. Once WSL is selected,
  losing `runtime.json` also fails closed instead of silently opening a Windows database.

The fresh OneDrive encrypted backup completed at 13:01 on 2026-09-30. The owner entered the backup
password locally for creation and again for Linux restoration; neither credential was persisted or
copied into the repository. Linux staging completed at 13:08. Before activation, the live Windows
source was rechecked against the backup receipt, the complete restored manifest, and hashes of every
typed row in every table, including original PDF bytes. All 12 tables matched. After promotion and
runtime selection, the real supervised Linux worker prepared and read the workspace successfully:
23 applications and three documents remain intact, and every table still matches. Oracle was reopened.
The receipt and staged snapshot remain private; OneDrive cloud upload is still unconfirmed.

The cold-start native probe passed after Ubuntu was confirmed stopped, without terminating user
workloads. Host-disconnect testing uncovered and fixed a process-lifetime defect: killing the Windows
launcher could previously kill its supervisor while leaving a Linux descendant alive. A dedicated
Linux guardian now arms [kernel parent-death notification](https://man7.org/linux/man-pages/man2/PR_SET_PDEATHSIG.2const.html)
before starting application work, handles the startup race, and enforces its own deadline. It kills
the whole process group and supplies an exit marker only after the application child exits. Real
Windows pipe-disconnect and launcher-kill probes then passed, including descendant termination,
SQLite rollback, and lock release. This is bounded trusted-worker supervision, not an arbitrary-code
sandbox; descendants must not detach from their group. Actual machine power-loss/VM suspension was
not simulated, and interrupted writes can have an unknown outcome. Never automatically replay them.

Validation at cutover: 177 Linux tests passed with no skips; Ruff and dependency checks passed.
The native suite passed 19 ordinary tests plus two separately run WSL integration tests, including
cold start and authorization/lock ordering. Clippy passed with warnings denied. The Windows production
build passed. Synthetic recovery succeeded Windows-to-Linux and Linux-to-Windows with all tables,
multiple document versions, evidence, review decisions, and credentials excluded. The final cutover
helper was also exercised against actual Windows filesystem behavior with synthetic data.

Repeat developer probes from the Windows checkout:

```powershell
.\.venv\Scripts\python.exe scripts/check_wsl_native.py --cold-start
.\.venv\Scripts\python.exe scripts/check_wsl_faults.py
.\.venv\Scripts\python.exe scripts/check_wsl_recovery.py
```

Run the cold-start probe when no other WSL work is running; it waits for natural shutdown and fails
instead of terminating unrelated work. All probes create only guarded synthetic fixtures.
The optional loopback `/health` service is separate from the pipe-backed workspace and does not
establish database/runtime ownership. No HTTP record endpoint or persistent AI daemon was introduced.

### Recovery and future maintenance

Use the Linux commands in [BACKUP.md](BACKUP.md) for future snapshots. The existing OneDrive client
syncs encrypted repository files; plaintext workspaces and staging stay in Linux. No scheduler or
automatic cloud-sync verification was added. The manifest retained in the runtime folder records
the initial restored snapshot; after edits, take a new backup rather than using that old manifest
as a checksum for the changing live database.

If a cutover is interrupted, keep Oracle closed and inspect the private pending marker, receipt,
Linux staging/runtime, and rollback directory before resuming. The helpers refuse to overwrite
existing targets. Do not delete markers just to get the app to open. If returning to Windows after
any new Linux writes, first make and verify an encrypted snapshot of the current Linux workspace,
restore it into new Windows staging, compare it, and perform a reviewed reverse cutover with all
writers stopped. The original Windows rollback folder cannot contain newer Linux edits.

The earlier checkpoints below describe the staged rollout and are historical where they say the
live runtime had not yet switched.

## Established environment

- The Linux checkout preserves the existing Git history and the reviewed current source changes,
  including untracked implementation files. Initial transfer verified 147 source-file SHA-256 values.
  Unrelated personal notes, PDFs, databases, credentials, dependencies, and build outputs were excluded.
- The existing Ubuntu distribution was used. `python3-venv` was installed from Ubuntu's signed
  repositories, including its required Python package updates. No distribution reinstall was needed.
- `requirements-dev.txt` installed successfully with hash verification on Linux/Python 3.12.3.
  The editable package was installed without dependency resolution or build isolation; `pip check`
  passed. The existing lock versions were retained, not silently regenerated for Linux.
- The RTX 3060 Ti is visible through WSL's NVIDIA interface, reporting 8192 MiB VRAM. This verifies
  driver visibility only. PyTorch, model inference, training, and CUDA allocation were not tested.
- No Linux GPU driver, AI framework, local model, Docker service, or production daemon was installed.
- Linux restic 0.19.1 is cached locally for encrypted-backup tests, with its executable checksum
  checked by the same application lookup that already protects the Windows binary.

Keep Linux project files in the Linux filesystem for performance, as recommended by
[Microsoft](https://learn.microsoft.com/en-us/windows/wsl/filesystems). NVIDIA documents that WSL
uses the Windows GPU driver; do not install a separate Linux display driver inside WSL.
[NVIDIA WSL guide](https://docs.nvidia.com/cuda/wsl-user-guide/)

## Validation checkpoint

All 153 backend tests passed on Ubuntu/Python 3.12.3 with no skips, including encrypted backup,
restore, migrations, document versions, candidate review, worker contracts, and parser limits.
Ruff and `pip check` passed. The Windows-to-WSL pipe probe passed all seven synthetic checks.
One Linux-specific test correction was required: the intentional corruption test grants write
permission only to its disposable copied restic pack, preserving production pack permissions.

## Working in Ubuntu

Open an Ubuntu terminal, or enter `wsl.exe -d Ubuntu` from PowerShell:

```bash
cd ~/projects/oracle
.venv/bin/python -m pip check
.venv/bin/ruff check backend tests scripts
.venv/bin/python -m pytest -q
```

The optional FastAPI process remains a loopback-only health service:

```bash
cd ~/projects/oracle
.venv/bin/python -m app
```

Stop it with Ctrl+C. It is not the desktop's private record transport and is not a persistent Linux
backend deployment. No auto-start or firewall changes were made. Do not start duplicate health
servers on the same port. A Linux Python environment must be recreated rather than copied from Windows.

For a clean Linux clone, after installing Ubuntu's `python3-venv` package:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install --require-hashes -r requirements-dev.txt
.venv/bin/python -m pip install --no-deps --no-build-isolation -e .
```

Linux Node/Rust frontend build environments are not set up in this milestone. The Windows build
checkout retains its existing Node/Rust toolchains. Never accidentally use Windows npm from the WSL
PATH as a substitute for a Linux Node installation.

## Source ownership and handoff

Backend development and its test execution should happen in the Linux checkout from now on.
The Windows checkout is still needed to build the native Windows app and support its current runtime.
Both checkouts currently retain uncommitted project changes atop the same original commit; no source
was pushed during setup. A second checkout is not an off-device backup.

Inspect `git status` and diffs in both places before transferring changes. Prefer reviewed local
commits and Git transfer for subsequent work; do not commit private notes or runtime files. If changes
are still uncommitted, transfer only explicitly reviewed files and verify the destination matches its
known baseline first. Do not use an automatic bidirectional sync or copy an entire working directory.
All future source work must preserve existing changes and keep Windows releases reproducible.

## Windows-to-Linux boundary: selected direction, not production cutover

The first integration target is the current bounded JSON request/response contract over inherited
pipes, launched with fixed `wsl.exe --distribution Ubuntu --exec ...` arguments. This avoids adding an
HTTP data service simply to cross the OS boundary. No shell command construction or renderer-selected
executable, distribution, database path, or module should be introduced. The native unlocked-session
guard remains the authority for desktop reads and writes.

The development probe is repeatable from Windows:

```powershell
.\.venv\Scripts\python.exe scripts/check_wsl_bridge.py --distribution Ubuntu --project /home/YOUR-UBUNTU-USER/projects/oracle
```

This creates a disposable synthetic Linux workspace, checks real worker reads/writes and safe errors,
then removes only that workspace. It does not use the owner's records or bypass the desktop lock.
Its developer-supplied paths are not a proposed renderer API. The probe verifies transport feasibility,
not native authentication integration, cold-start guarantees, cancellation, or deployment reliability.

Before changing the installed desktop runtime:

1. Implement a fixed native runtime adapter with explicit distribution/user/path configuration.
   Test unavailable/stopped WSL, bounded startup, shutdown, timeout cancellation of Linux descendants,
   partial responses, lock races, and retries. Never silently fall back to a different data store.
2. Select one database owner. For a Linux-owned runtime, use a private Linux directory with owner-only
   permissions; all access goes through its worker. Do not share a writable SQLite file over `/mnt/c`
   or `\\wsl.localhost`, and do not keep two independently writable copies of the live workspace.
3. Make and verify a fresh encrypted backup, stop live writers, restore into private Linux staging,
   then compare workspace identity, every application, source bytes, evidence, profile, and decisions.
   Rebind the desktop only after native integration tests and the data comparison succeed.
4. Keep the Windows source workspace as a stopped rollback copy until cutover is verified. Rollback
   after new Linux writes requires a reviewed reverse transfer; do not discard newer records.
5. Keep Windows app credentials on Windows. Keep plaintext staging and live data in Linux, and send
   only encrypted repository files to the chosen OneDrive destination. Test recovery from both sides.
   The existing Windows OneDrive client remains responsible for upload; sync status is unconfirmed.

The current private AppData database, password hash, and backup repository were not moved in this
milestone. Production migration is the next infrastructure step, before persistent ingestion/AI workers.

## Initial adapter checkpoint before activation - 2026-09-30

The Windows executable now contains an explicit WSL runtime adapter. It is **not activated** for the
owner's workspace. With no `runtime.json` in the Windows app-local-data directory, the existing
Windows Python/database arrangement remains in use. No configuration or private data was migrated.

The adapter reads a bounded, strict local configuration once at startup. Version 1 requires exactly
`version`, `runtime`, `distribution`, `user`, `project`, `database`, and `workspace_id`. The only
supported runtime/distribution values are `wsl` and `Ubuntu`. Project and database paths must be
`/home/<user>/projects/oracle` and `/home/<user>/.local/share/oracle/oracle.sqlite3`; the canonical
workspace UUID is pinned. This is a deployment file, not a renderer API. Invalid configuration fails
closed; a selected Linux runtime never falls back to a Windows workspace. Do not create this file
manually as a shortcut around the cutover gates above. At cutover the old Windows database must be
retired from its active path, so deleting configuration cannot accidentally reopen a stale live copy.

The native process launches the fixed system `wsl.exe` with explicit distribution/user and an
isolated Python module. It passes a four-byte request length followed by at most 512 KiB of JSON.
The input pipe stays open as a cancellation signal. The Linux supervisor:

- permits only existing-workspace `prepare` and application `request` operations;
- checks the expected identity, owner-only directory/files, and rejects symlink/mounted Windows paths;
- gives framing and execution a combined 15-second deadline, bounds responses to 2 MiB, and discards
  malformed/partial output;
- terminates the worker's process group and reaps its direct child before returning a reply;
- cancels on parent pipe closure or unexpected additional input, and creates worker files with a
  private umask. Trusted descendants must remain in that process group; this is not an arbitrary-code
  sandbox or a replacement for the separate PDF parser resource limits.

The native transport allows up to 40 seconds for startup/response and a bounded cleanup grace. It
retains the existing native authorization mutex through the operation. Transport failures disable
further requests for that app session, requiring a restart; there are no automatic write retries.
An interrupted response can have an unknown commit outcome. Inspect/reload after recovery rather
than treating a transport error as proof that nothing was saved. Host/VM suspension and abrupt host
termination still require end-to-end fault validation before activation.

Validation: 166 Linux backend tests passed with no skips, including 13 supervisor tests for real
requests, framing, deadlines, malformed/oversized output, descendant cancellation, SQLite rollback
and lock release, identity/path permissions, and private file creation. The Windows native suite
passed 18 ordinary tests. Both opt-in WSL native tests passed separately, covering real reads/writes,
idempotent creation, invalid requests, wrong identity, unavailable distribution, the locked-session
gate, and lock ordering around a real mutation. Linux Ruff and dependency checks passed; the Windows
production desktop build passed. No additional dependency was installed.

Repeat the opt-in integration tests from Windows:

```powershell
.\.venv\Scripts\python.exe scripts/check_wsl_native.py
```

This developer probe targets this owner's Ubuntu user/check-out and creates/removes only a guarded
synthetic fixture under the Linux checkout's `.cache`. The ordinary Rust suite marks these tests
ignored because they need that fixture; an ignored result is not a successful integration check.

Remaining activation gates: a stopped-distribution/cold-start test, host-disconnect/crash validation,
fresh encrypted backup and cross-platform recovery, a full-table/source-byte/identity comparison in
private Linux staging, and an explicit single-owner cutover with rollback handling. An existing Linux
shell was left undisturbed; the distribution was not terminated merely to claim a cold-start test.
The live database, Windows password, and existing OneDrive repository remain unchanged.

## Verified Linux backup binary

Source: [official restic 0.19.1 release](https://github.com/restic/restic/releases/tag/v0.19.1).
The archive digest was checked against official GitHub release metadata before decompression.

- Archive: `restic_0.19.1_linux_amd64.bz2`
- Archive SHA-256: `f415415624dcc452f2a02b8c33641791a8c6d6d3b65bbb3543fcf9a25151585c`
- Executable SHA-256: `20d4142678d0d95ec11a4759def1b73fd9190abc9ca19e4b62d067c0b387e639`
- Local path: `.cache/tools/restic-0.19.1/restic_0.19.1_linux_amd64`

The binary is ignored by Git and must be provisioned and verified again on a new checkout. Linux
encrypted-backup tests require it or an explicitly trusted `ORACLE_TEST_RESTIC` path. Test runs must
report skipped backup checks honestly; missing tooling is not equivalent to successful recovery tests.
