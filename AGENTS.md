# Oracle development environments

Read `docs/ORACLE_CONTEXT.md` and `docs/WSL_DEVELOPMENT.md` before backend work.

- The owner authorized the transition to Ubuntu WSL2 development on 2026-09-29.
- Use the Linux checkout at `~/projects/oracle` inside the `Ubuntu` distribution for backend
  development and Python tests. Its virtual environment is `.venv/bin/python`.
- `C:\Personal projects\Job-os` remains the Windows desktop build checkout. Its current
  uncommitted source was copied and hash-verified into Linux; both preserve the original Git history.
- Inspect both working trees before editing or synchronizing. They contain important uncommitted
  work. Do not overwrite divergent files, discard changes, blindly sync directories, or reset either
  checkout. Transfer reviewed source changes only, with content checks or reviewed Git commits.
- Build and test the Windows Tauri executable on Windows. Do not reuse `.venv`, `node_modules`,
  Rust `target`, or other platform-specific generated directories across operating systems.
- Production cutover completed on 2026-09-30. The Windows desktop now invokes Ubuntu workers;
  the active database is `/home/lethargic/.local/share/oracle/oracle.sqlite3`. Access it through
  Linux workers/maintenance only, never through a shared Windows SQLite connection. Tests use
  synthetic data. Windows credentials remain in AppData; never copy them into Linux.
- AppData `runtime.json` pins the WSL workspace; `runtime-wsl.selected` records the rollback folder.
  The old Windows database is an inactive read-only rollback copy. Never reopen it as a second live
  workspace or remove runtime markers to force fallback. Recovery after new Linux writes must
  preserve those writes. See `docs/WSL_DEVELOPMENT.md` for cutover and recovery details.
- Do not modify `docs/PROJECT_CONTEXT.md`. Private records and source PDFs never belong in Git.
- The owner permits necessary Oracle update restarts without asking again about saved edits.
- Since 2026-10-01, normal execution uses pinned installed releases: Windows under
  `%LOCALAPPDATA%\Programs\Oracle\releases` and Linux under
  `~/.local/share/oracle/runtime/releases`. Editing either checkout does not update those copies.
  Follow `docs/RUNTIME_RELEASES.md` to build, test, install and select an update, then reopen the
  installed executable. Never silently redirect production to the development environment.
