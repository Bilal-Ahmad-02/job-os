# Installed Oracle runtime

Normal use now launches a versioned Windows executable under
`%LOCALAPPDATA%\Programs\Oracle\releases\<executable-sha256>\oracle-desktop.exe`.
Use **Oracle** in Start, its desktop shortcut, or its updated taskbar shortcut. Frontend assets are
embedded. No terminal, development server, Node, Rust, checkout or development virtual environment
is required to use the installed app.

Ubuntu WSL2, Ubuntu's Python 3.12 and the Windows WebView2 runtime remain prerequisites. This is a
managed installation for this machine, not a self-contained OS image, signed installer or updater.
The optional HTTP health service is still separate; its unavailable indicator does not mean that
the pipe-backed record runtime failed. No persistent HTTP service or new network port was added.

## Locations and boundaries

- Installed backend: `/home/lethargic/.local/share/oracle/runtime/releases/<release-id>/.venv`.
  This is a fresh virtual environment with a normally installed wheel, not an editable package.
- Each release retains `bundle/` with its wheels, hashed dependency lock and source inventory.
  Its ID is the SHA-256 of the canonical bundle manifest. Hashes detect corruption; they are not
  publisher signatures. Build/install only locally reviewed bundles.
- `%LOCALAPPDATA%\local.oracle.desktop\runtime.json` version 2 pins one exact Linux release.
  Version 1 remains supported for explicit development configurations. A missing selected release
  fails closed; there is no automatic development-runtime or Windows-database fallback.
- The active database remains `/home/lethargic/.local/share/oracle/oracle.sqlite3`. Credentials,
  the WSL selection marker and the inactive Windows rollback database retain their prior locations.
  Installing or selecting a runtime does not import, copy, replace or downgrade private records.

The environment still uses Ubuntu's system Python and shared OS libraries. Do not copy or move a
virtual environment, upgrade Python to a new minor version underneath it, or treat release files as
an off-device data backup. Rebuild/reinstall and validate for a new Python or platform.

## Build and install a reviewed backend update

Develop and test in the Linux checkout first, and perform the reviewed source handoff to Windows.
From `~/projects/oracle`, using a new output directory:

```bash
.venv/bin/python scripts/build_runtime_bundle.py .cache/runtime-bundle-UNIQUE
.venv/bin/python scripts/install_runtime.py "$PWD/.cache/runtime-bundle-UNIQUE"
```

The builder stages only backend Python source and explicit build metadata. It builds the application
wheel with existing build tools, and downloads binary dependencies at the existing locked versions
with hash verification. It never bundles personal documents, databases, credentials or a checkout.
Installation is offline, into the final versioned path, and retains its verified bundle there. It
checks dependency consistency and exercises synthetic storage, IPC and the PDF subprocess outside
the checkout. No installed release is overwritten. `release.json` is published only after checks
pass; `install.pending` identifies incomplete installations that must not be selected.

From Windows, test the installed release through the real native transport:

```powershell
.\.venv\Scripts\python.exe scripts/check_wsl_native.py --runtime-project /home/lethargic/.local/share/oracle/runtime/releases/RELEASE_ID
```

Build the Windows desktop with `npm.cmd run desktop:build` in `apps/desktop`. Close Oracle before
replacing its launch target or selecting a runtime; the owner has authorized update restarts.
Then, from the Windows repository root:

```powershell
.\.venv\Scripts\python.exe scripts/select_runtime_release.py RELEASE_ID
powershell.exe -NoProfile -File scripts/install_desktop.ps1
```

Selection validates the installed package and the existing workspace through Linux, preserves the
previous configuration, and atomically replaces only `runtime.json`. Desktop installation copies
the executable to a new hash-addressed directory, verifies its bytes, and updates Oracle shortcuts.
Existing installed executables are retained. Reopen through the new shortcut and check startup.
Record the selected release, tests and source handoff in ORACLE_CONTEXT.md.

## Recovery and limits

A failed install leaves its incomplete directory for review and never selects it. Do not rename
that directory into a different release, remove the pending marker to claim success, or retry by
overwriting it. Review the failure and create a fresh bundle/release or safely remove only that
verified incomplete install before rebuilding. No automatic release retention or pruning exists.

Selection preserves `runtime-config-before-<uuid>.json` beside the current config. If a runtime
update fails, close Oracle and review the previous configuration and schema compatibility before
restoring the selection. Changing code must never restore an old database or discard newer records.
The original Windows rollback database remains inactive. Future schema changes require the existing
migration/backup gates; a code rollback alone does not downgrade the schema.

Runtime bundles and local migration copies are not encrypted off-device backups. Continue using
the Linux backup procedures in BACKUP.md. Backup maintenance tooling (including verified restic)
is currently provisioned separately from this record-runtime release. New-machine provisioning,
signed distribution, automatic updates and scheduled backups remain future work.

Packaging follows Python's guidance to [recreate rather than relocate virtual environments](https://docs.python.org/3.12/library/venv.html)
and pip's [hash-checked installation](https://pip.pypa.io/en/stable/topics/secure-installs/) and
[offline wheelhouse installation](https://pip.pypa.io/en/stable/topics/repeatable-installs/).
