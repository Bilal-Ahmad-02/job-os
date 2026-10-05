# Handoff validation — October 2, 2026

This record distinguishes completed checks from outstanding verification. Source/release checks
are complete for the current scope; the private backup and manual UI limitations below remain explicit.

## Completed checks

| Check | Result |
| --- | --- |
| Fresh GitHub Linux clone | 264 passed with no skips in a new Python 3.12 virtualenv; hash-locked install, editable package, Ruff and pip check passed |
| Fresh GitHub Windows clone | Locked npm install with lifecycle scripts disabled, TypeScript/Biome, 83 tests across 15 files and Vite production build passed |
| Windows native suite | 33 passed; both opt-in WSL tests separately passed against the installed backend |
| Rust lint | Clippy passed with warnings denied |
| Python lint | Ruff passed for backend/app, tests and scripts |
| Dependency consistency | Linux `pip check` passed |
| Worker fault probes | Pipe disconnect and killed Windows launcher recovered; synthetic descendants/transactions checked |
| Cross-platform encrypted recovery | Both directions passed; 13 tables, multiple document versions, credentials excluded |
| npm advisories | Zero findings |
| Python/Rust advisories | Findings and applicability recorded in SECURITY_REVIEW.md |
| Source checkpoint | Local and remote main matched `f031b314293270ee1405e98f08557d454fae3971` |
| Source privacy/link check | 217 final tracked files reviewed; no detected token/private-artifact patterns or broken relative Markdown links; original PROJECT_CONTEXT.md blob unchanged |
| Windows release | Tauri production build passed; installed bytes verified and Oracle reopened with a responsive window |

Linux clean-clone verification used `f898181996d863f23a144c944c2cea9c6d0c9292` and the existing,
SHA-256-verified Linux restic binary copied into that clone's tool directory. Its virtualenv was
created independently; no installed production package supplied its app source. Subsequent changes
were documentation and the line-ending policy, with no Python changes.

Windows clean-clone verification used `24b6329` in a new temporary directory outside the original
repository, with new `node_modules`. The first attempt found CRLF conversion errors; `.gitattributes`
fixed them. A clone nested inside the ignored `.cache` also produced false unused-suppression
warnings; the independent clone passed without warnings. Keep justified effect-refresh suppressions:
removing them causes real lint errors in a normal checkout and does not improve application behavior.

## Installed handoff state

Backend release: `bda6f25fbb0f4fdf1efa25b47ebeb0f16b29de16930d6c0086276c1844ef6f25`.
Desktop SHA-256: `513469062a82adda5932f87a0eae9ce3271c265ae6467ad3d704f7e2366d4636`.
Schema: `0008`. This stabilization changes the optional diagnostic UI and documentation, not the
backend contract or database. No personal profile entry, provider key or external connection is
created by the stabilization work.

### Desktop update — October 5, 2026

Desktop SHA-256 is now `1884702bbf449641b0d04ac43a898724f0122b708809c744074009696f97189e`,
built from the chamber hub change (see DESKTOP.md). Backend release and schema are unchanged. The
previous desktop release `51346906...` is retained. Checks run for this update: TypeScript, Biome,
89 frontend tests across 16 files, Vite build and the Tauri production build; installed bytes were
hash-verified by the install script and the installed process reopened responsive at the locked
seal. Not rerun: native Rust tests and WSL probes (no native or backend change), Python tests.
Not verified: the hub and console as they appear in the installed window after a real unlock, which
only the owner can perform, and the hub's narrow-window layout.

### Step 14 source state — October 5, 2026

Manual listing intake is committed locally in both checkouts and is not deployed. Checks run:
290 Linux tests with Ruff clean; TypeScript, Biome, 100 frontend tests across 18 files and the Vite
build on Windows. Not run: native Rust tests (no native change) and the WSL native probes, which
need an installed `0009` release. Not done: backend release build/install, live migration to
`0009`, release selection, desktop install. The installed desktop above and backend `bda6f25...`
with schema `0008` are still what runs. The new module has not been seen in a running app.

## Private backup and remaining manual evidence

The owner initially reported backup success and OneDrive Up to date, but no new handoff receipt was
present. Investigation found the one-off terminal had used the installed record environment, which
does not contain the separately provisioned restic tool. The corrected terminal uses the documented
Linux development/maintenance environment; its tool checksum was verified before opening it. Fresh
snapshot/receipt and cloud-sync confirmation remain pending local password entry/completion. Do not
count the initial report as independent verification of a new snapshot. Earlier verified local
backups and cross-platform restore checks remain recorded in BACKUP.md/WSL_DEVELOPMENT.md.

No real provider key/live account request was used. Native credential-dialog appearance and the
unlocked UI have not received a complete visual walkthrough in this audit. Automated UI tests,
real native credential tests and a responsive process are useful but do not substitute for those
checks. A real destructive power-loss test and new-machine full installation are also unperformed.
