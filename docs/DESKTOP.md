# Oracle desktop foundation

Oracle is the Windows desktop app for the Job OS project. This milestone provides a password-protected local
window, application tracking, and a connection check. See [application storage and import](APPLICATIONS.md).

## Prerequisites

- Complete the Python setup in the root README.
- Node.js 24 LTS and npm.
- Rust through rustup; `src-tauri/rust-toolchain.toml` pins the compiler and components.
- Microsoft Visual Studio 2022 Build Tools with **Desktop development with C++** and a Windows SDK.
- Microsoft Edge WebView2 Runtime.

See the [official Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/#windows).
After installing Rust or the build tools, open a new terminal to refresh PATH.

## Run during development

First terminal, from the repository root:

```powershell
.\.venv\Scripts\python.exe -m app
```

Second terminal:

```powershell
Set-Location apps/desktop
npm.cmd ci --ignore-scripts
npm.cmd run desktop
```

Dependency lifecycle scripts are not needed by this scaffold. Keep them disabled during installation.
The first native build downloads crates and may take several minutes. Vite runs on
`127.0.0.1:1420` only and fails if that port is occupied. It is a development asset server for
the desktop window; no frontend server is required by the built executable.

The native shell checks the fixed endpoint `http://127.0.0.1:8000/health` after unlock. Use backend
port 8000 for this milestone. The renderer cannot directly contact the HTTP backend; its CSP permits
only Tauri IPC (plus the Vite WebSocket in development). The backend CORS development opt-in is
no longer needed by Oracle, although it remains available for explicitly authorized browser testing.

Close the desktop window and use `Ctrl+C` to stop development processes. Backend and desktop
lifecycles are separate for now.

## Build a native executable

From `apps/desktop`:

```powershell
npm.cmd run desktop:build
```

This produces `src-tauri/target/release/oracle-desktop.exe` with bundled frontend assets.
Open that executable; application tracking starts Python workers automatically. Start the HTTP
backend separately only if you need its health check. The artifact is unsigned and
requires WebView2; it is not yet a self-contained installer. Do not publish it as a complete app.

The next packaging work is to choose how to bundle Python and manage startup/shutdown, readiness,
port conflicts for future HTTP features, and an authenticated HTTP channel. The current application
tracker uses password-gated native pipes. An installer, auto-start, and updater remain future work.

## Windows icon maintenance

The black-and-green icon master is `src-tauri/icons/oracle.png`; `oracle-emblem.png` preserves
the transparent emblem. Generate `icons/icon.ico` with the installed Tauri icon command when
changing the artwork. `build.rs` explicitly watches that ICO so Cargo refreshes the executable's
Windows resource as well as the title-bar icon. The frontend uses `public/oracle.png`.

On Windows, `src/windows_icon.rs` explicitly sets `ICON_BIG` from the executable's embedded icon
group (32512). The current Tauri/Tao window-icon path sets only `ICON_SMALL`; relying on it alone
can leave the taskbar using a stale shell fallback. The shared native icon is owned by Windows
for the process lifetime. A native test verifies the large-icon registration on a hidden window.
Reassess this workaround when upgrading Tauri/Tao. No renderer permission is added.

## Checks

From `apps/desktop`:

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd audit
Set-Location src-tauri
cargo fmt --check
cargo test --locked
cargo clippy --locked --all-targets -- -D warnings
```

Run the Python checks from the root README after changing the backend. Frontend tests cover password setup, denied access, locking, error handling, connection status,
and stale replies. Rust tests cover credential persistence, restart locking, unique salts, password
validation, throttling, corrupt settings, health responses, and navigation restrictions. Python tests
cover health, configuration, host validation, CORS, and startup.
Commit `package-lock.json` and `Cargo.lock`; generated build output remains ignored.

## Security boundaries

- The window loads local assets only. A Rust navigation handler rejects other origins, popup
  windows are denied, and downloads are denied. Development navigation is allowed only in debug builds.
- The sole Tauri capability names the `main` window and explicitly permits six app commands:
  password status, setup, unlock, lock, a guarded health check, and guarded application operations.
  Commands are registered in the
  build manifest for capability enforcement. No general filesystem, shell, opener, or HTTP plugin
  is exposed to the renderer. New privileged commands must check native access state.
- A [Content Security Policy](https://v2.tauri.app/security/csp/) limits renderer connections to
  Tauri's internal IPC transport. Production has no remote scripts,
  wildcard sources, `unsafe-eval`, or `unsafe-inline`. Development permits inline scripts/styles
  for React refresh and Vite's local WebSocket. Those exceptions are not in the production policy.
- Camera, microphone, geolocation, and screen-capture access are denied by Permissions-Policy.
  Drag/drop is disabled; the UI does not read arbitrary files or render arbitrary HTML.
- Native health requests send no passwords or cookies, bypass proxy settings, reject redirects,
  cap responses at 1 KiB, and time out after three seconds. The fixed destination is not configurable
  through IPC. Locking discards in-flight results. Cancelling renderer checks discards replies; it
  does not interrupt the native request, which is bounded by its timeout.
  Failed requests expose a generic message rather than raw network errors. No background polling
  occurs; the displayed result is from the last check, not continuous service monitoring.
- The backend allows only the packaged Windows origin, plus the development origin when explicitly
  enabled. CORS controls browser response access; it does not authenticate clients or block every
  possible request. A forged Origin header from another process is not proof of identity.
- The endpoint remains public to local processes and reports liveness only. Its response does not
  prove the responding process is Oracle. Before adding HTTP personal data or actions, implement and
  test authentication, origin validation for writes, and lifecycle/port ownership together.

The display name is Oracle. Existing `JOB_OS_*` backend environment variables and the Python
distribution name remain unchanged so the earlier setup continues to work. The historical
`PROJECT_CONTEXT.md` is preserved.

## Local password

First launch asks you to create and confirm a 15-128 character password. Use a long, unique
passphrase and keep it in a password manager. Every new app process starts locked. The **Lock Oracle**
button also locks the current process. Minimizing or changing focus does not lock it automatically.
Each app instance has its own session; there is no remembered login or browser storage token.

Rust verifies the password through Tauri IPC. Passwords never enter the HTTP health request.
The only persisted credential is a randomly salted Argon2id v19 PHC hash at
`%LOCALAPPDATA%\local.oracle.desktop\password.phc`. Parameters are 19 MiB memory, two iterations,
one lane, and a 32-byte output, following the [OWASP password storage minimum](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
The implementation uses [RustCrypto Argon2](https://docs.rs/argon2/latest/argon2/).
Password hashing runs off the UI thread and credential operations are serialized. Failed attempts
have an increasing 2-30 second cooldown within the process. Restarting the process resets the cooldown;
the hash's cost is the protection against offline guessing. Rust password buffers are zeroized when
released; JavaScript/IPC temporary copies cannot be guaranteed to be wiped by the garbage collector.
Passwords and hashes are never logged or returned to the renderer.

Creation uses exclusive file creation and flushes the hash to disk before unlocking. An unreadable,
truncated, oversized, or unsupported hash file fails closed; Oracle does not overwrite it or silently
reset the password. If settings are damaged, restore them from a trusted local backup. There is no
email recovery, password-change UI, or recovery secret in this milestone.

Successful first password creation explicitly initializes a new application workspace. Existing
passwords never trigger automatic database recreation. Database identity and lifecycle checks are
documented in [application storage](APPLICATIONS.md#workspace-lifecycle-and-recovery). If initial
database creation fails after the password was stored, retain the password and reopen Oracle for
recovery; do not delete the hash or retry setup as if the workspace were new.

This is an **application access lock**, not disk encryption or an authenticated Python API. The only
backend endpoint remains public liveness. Future personal-data endpoints require their own protected
desktop/backend channel before implementation. Windows account isolation protects the settings folder;
someone able to modify your files, delete the hash, patch the executable, or run code as you can bypass
this local lock. A missing hash is treated as first-run setup only when no application database
exists. With an existing database, missing credentials fail closed. Do not delete the hash to
reset a workspace; restore the original hash from a private backup. On a replacement PC, initialize
a new password in an empty workspace before restoring a database backup. Never copy credentials
into the source repository. See [backup and restore](BACKUP.md).

## Dependency review (2026-09-24)

The npm installation audit reported no known vulnerabilities. An OSV query of all 446 registry
packages in `Cargo.lock` returned these upstream findings:

- `glib 0.18.5`: [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html),
  an unsound iterator implementation. `cargo tree --target x86_64-pc-windows-msvc -i glib`
  confirms it is not in this Windows build. Reassess before supporting Linux.
- `proc-macro-error 1.0.4`: [RUSTSEC-2024-0370](https://rustsec.org/advisories/RUSTSEC-2024-0370.html),
  an unmaintained dependency, also absent from the Windows dependency tree.
- The `unic-* 0.9.0` crates used by `urlpattern 0.3.0` through `tauri-utils 2.9.3` have
  unmaintained advisories: [0075](https://rustsec.org/advisories/RUSTSEC-2025-0075.html),
  [0080](https://rustsec.org/advisories/RUSTSEC-2025-0080.html),
  [0081](https://rustsec.org/advisories/RUSTSEC-2025-0081.html),
  [0098](https://rustsec.org/advisories/RUSTSEC-2025-0098.html), and
  [0100](https://rustsec.org/advisories/RUSTSEC-2025-0100.html). These are present in the Windows
  dependency tree. The advisories list no patched versions; replacing them requires an upstream
  dependency migration rather than a compatible patch-version update.

These findings are not silently suppressed or resolved by the app's CSP. Track Tauri dependency
updates and recheck before distribution or adding sensitive capabilities. The checks above are
a point-in-time advisory review, not a penetration test or a guarantee of security.
