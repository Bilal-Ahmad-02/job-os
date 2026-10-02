# Oracle desktop

For normal use, open **Oracle** through Start, its desktop shortcut or taskbar icon. The versioned
Windows executable starts its pinned Ubuntu record worker automatically. No development terminal,
HTTP service or Node/Rust toolchain is required for normal use.

Read [DEVELOPMENT.md](DEVELOPMENT.md) for current setup and test commands and
[RUNTIME_RELEASES.md](RUNTIME_RELEASES.md) for installing updates. Editing source or building an
executable does not update the installed copy. The app is a managed local installation, not a
signed new-machine installer or updater. WebView2 and Ubuntu WSL2 remain prerequisites.

## Current diagnostic and provider behavior

The **SYSTEM** drawer contains an explicitly requested optional HTTP diagnostic. It does not run
on unlock or window focus, and a diagnostic failure does not set a global disconnected state.
Record modules report their own failures over the separate authenticated Windows/WSL pipe.
The HTTP endpoint remains fixed at `http://127.0.0.1:8000/health`, with no personal data.

**05 / CONTROL** handles native key entry, Windows credential storage and explicit provider-test
permission. Saving a key never contacts the provider or enables inference. See
[provider settings](PROVIDER_SETTINGS.md).

## Building a Windows executable

From `apps/desktop` in PowerShell:

```powershell
npm.cmd run desktop:build
```

This produces `src-tauri/target/release/oracle-desktop.exe` with bundled frontend assets. Follow
RUNTIME_RELEASES.md to install it and update existing shortcuts. For development, `npm.cmd run desktop`
starts Vite and Tauri; that development window uses the same local application identity and private
runtime configuration. Use synthetic tests for mutations.

The behavior/security sections below include historical milestone notes. Current setup is described
above and in DEVELOPMENT.md; historical Windows Python examples are not instructions to reopen the
inactive Windows database or change production runtime ownership.

## Frontend structure and interactions

The 2026-09-28 frontend cleanup separates ACQ (applications) and VAULT (source documents) with
compact module navigation. The previous permanent decorative side panel is replaced by an
on-demand system drawer. Its health indicator describes the optional HTTP health service, not
whether private database operations are available. It never claims that an AI model is connected.

Switching modules keeps the application editor mounted so drafts survive navigation; locking the
workspace still unmounts all private views. Ctrl+K only acts in the active dossier index. Clearing
a query returns to the first page, and refresh recovers when a result set shrinks beyond the current
page. Document filtering is local; full checksums appear only inside the file-integrity disclosure.
Record editing uses named field groups, a persistent save bar, and explicit discard controls.

Frontend responsibilities are separated into workspace shell, system status, dossier index/editor,
source provenance, and document register. Component styles live under `src/styles/`, with shared
tokens and focus/error treatment in `base.css`. The unused rail icon and obsolete sidebar styles
were removed. Master icon artwork is retained intentionally for future icon regeneration.

The frontend tests cover navigation/draft preservation, query/pagination recovery, error redaction,
source filtering, and existing access/save behavior. The automated desktop/browser capture tools
were unavailable during this change; live visual review is still needed.

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

## Identity review

Open **03 / IDENTITY** after unlocking Oracle to review the extracted candidate draft. Select an
entry, compare the document/page excerpts, correct fields, and approve or reject it explicitly. Each
approval saves immediately. Pending requests disable review controls; conflicts preserve corrections
and require reloading the latest state before retrying. Approved entries remain owner assertions,
not verified credentials. See [PROFILE.md](PROFILE.md) for storage, recovery, and review limitations.

## Document version history

**02 / VAULT** now groups latest documents with earlier originals under **Version history**.
Search includes older filenames. Profile citations show their version and warn if a newer original
exists. New versions are imported through the explicit maintenance command in
[DOCUMENTS.md](DOCUMENTS.md#explicit-versions-step-6-schema-0007); an in-app import picker is not
implemented. Replacing a source never silently changes reviewed profile claims.

## WSL development boundary

The installed desktop now invokes Ubuntu workers through its explicit WSL adapter. Production
cutover completed on 2026-09-30; the live database is private to Linux, while the existing password
gate and hash remain on Windows. Windows Python remains available for legacy maintenance and tests
of the Windows transport, but it no longer owns the active records. Runtime configuration and
transition markers fail closed instead of falling back to stale Windows data.
See [WSL_DEVELOPMENT.md](WSL_DEVELOPMENT.md) for exact paths, validation, and recovery constraints.

## Circular launcher and rotation key (2026-09-30)

Oracle now starts as a 560-logical-pixel circular Windows window. Native window-region clipping
removes the corners from both drawing and mouse interaction. The existing green emblem is a dial;
the ORACLE label moves the window, and the small minus/cross controls minimize/close it. Successful
native authentication expands the same window into the normal decorated, resizable workspace.
Locking unmounts records immediately and returns to the circle. The Linux runtime is unchanged.

On first use, choose **Initialize rotation key**, enter the existing Oracle password, then choose
**Set rotation key**. Make 4–8 alternating clockwise/counterclockwise turns, releasing after each.
Each turn is a signed relative distance of 1–24 stops; 12 stops make a revolution. Starting position
and timing are not part of the key. Repeat the sequence to confirm it; Oracle then locks so the first
unlock also proves the saved key works. **Clear turns** restarts entry. With keyboard focus on the
dial, Left/Right move one stop and Space/Enter commits a turn. Cancelled drags are discarded.

The owner chooses the actual sequence privately in the application, never in chat or a fixture.
Enrollment can be postponed. **Password recovery** retains the existing password and opens the
workspace even if the rotation hash is damaged. This version creates a key once; changing an already
saved key is not yet exposed. Do not delete credentials to reset them.

The native layer checks bounds, alternating direction, confirmation, and authenticated enrollment;
it stores only a salted Argon2id hash in private Windows AppData `rotation.phc`. Password and dial
attempts share the existing session-local retry delay. Closing/reopening resets that delay. Short
or predictable sequences are weaker than long passwords; this is a local access gate, not database
encryption or protection against an attacker controlling the Windows account. Credentials stay out
of Git, Linux, and record backups. Missing password storage alongside WSL runtime markers fails
closed instead of allowing replacement-password setup.

Validation: 52 frontend tests and 24 native tests passed, along with TypeScript, Biome, Clippy and
the Windows production build. Two unchanged WSL integration probes were not rerun for this
desktop-only change. Frontend tests cover enrollment, recovery, rejected/pending unlock, keyboard and pointer
input, cancellation, and locking. Native tests cover hash persistence, throttling, enrollment
authorization, migration recovery, and actual Windows region clipping/scaling/removal on a synthetic
hidden window. The computer-use helper could not connect (`native pipe unavailable`), so visual
inspection of the live window and the complete mouse-to-native unlock transition remain unverified.
