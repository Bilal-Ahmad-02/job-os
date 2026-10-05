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

Source checks: 290 Linux tests with Ruff clean; TypeScript, Biome, 100 frontend tests across 18
files and the Vite build on Windows; 33 ordinary native tests.

### Step 14 deployment — October 5, 2026

Backend release: `dd8f41728b147c3e544e4ea1e227a21fdae36c8e54327f341398867d20513c91`.
Desktop SHA-256: `1b579d1f5ea1c34bb08359563e269b8e71ca072295230fd460be3f1c3eca2734`.
Schema: `0009`. Previous backend and desktop releases are retained.

| Check | Result |
| --- | --- |
| Installed-release probe | Passed offline install, dependency check and synthetic storage/IPC/PDF probe |
| Windows/WSL native integration | Both opt-in tests passed against the new release |
| Live migration | `prepare` succeeded; integrity-checked pre-migration copy present |
| Table comparison | All 12 pre-existing data tables and the identity marker identical; `alembic_version` changed; `job_listings` added with 0 rows |
| Post-deploy read | Installed release returned 0 listings, 23 applications, 3 documents, 0 tasks (counts only) |
| Desktop | Install script verified bytes; process reopened responsive at the locked seal |

Not run: fault and cross-platform recovery probes, cold-start probe. Not verified: anything in the
unlocked app, including the INGRESS module and the chamber hub with this build. No encrypted backup
has been taken since the migration.

### Backup repository change — October 5, 2026

The owner replaced the backup repository: `OracleBackups-2026-10` is active and the earlier
`OracleBackups` is retained untouched with a lost password. See the top of BACKUP.md. The first
snapshot's restore verification, repository check and OneDrive sync are owner-reported; the coding
session confirmed only that the folder holds one snapshot file dated 2026-10-05. The pending
"corrected handoff backup" described below was aimed at the earlier repository and is superseded.

### Step 15 source state — October 5, 2026

Checks run: 309 Linux tests with Ruff clean; TypeScript, Biome, 102 frontend tests across 18 files
and the Vite build. No native code or schema changed; the ordinary native suite was not rerun.

Deployed 2026-10-05. Backend release: `b033929bb789bec11303a2e4d632a1c1b3a4fffe0c6b67be645d9e4071ea7946`.
Desktop SHA-256: `e53b70cb903ee48ee3cef13dacd28547a0edb4554bc77444fede04d237e27d84`. Schema stays `0009`;
no migration ran. The release passed its offline install probe and both Windows/WSL native
integration tests; selection verified it opens the existing workspace; the install script verified
the desktop bytes and the process reopened responsive at the locked seal. Earlier releases are
retained. Not verified: the normalized view in the unlocked app.

### Step 16 source state — October 5, 2026

Checks run: 318 Linux tests with Ruff clean; TypeScript, Biome, 104 frontend tests across 18 files
and the Vite build; 33 ordinary native tests.

Deployed 2026-10-05. Backend release: `79a4fd8ca8bdabcd59e8a48473ed9e3873a2a709b48167656ca3ba9b7a19a04a`.
Desktop SHA-256: `2abb755640b9d6952b9983aab93d04f61cd2737eb39e2d744e7fd0e6c85f7ca7`. Schema: `0010`.
Earlier releases are retained.

| Check | Result |
| --- | --- |
| Installed-release probe | Passed |
| Windows/WSL native integration | Both opt-in tests passed against the new release |
| Live migration | `prepare` succeeded; integrity-checked pre-migration copy present |
| Table comparison | 12 of 14 tables and the identity marker identical; `alembic_version` and the `job_listings` definition changed; 0 listings before and after |
| Desktop | Install script verified bytes; process reopened responsive |

This desktop also carries the chamber fix: the hub stayed visible above the console because its
grid display overrode the `hidden` attribute. The owner found it by using the app; the automated
tests passed throughout because jsdom does not apply stylesheets. The rule is confirmed present in
the built stylesheet. Not verified: the fix or any step 14-16 screen in the unlocked app. Oracle
did not exit on a normal close request while in use, so its process was stopped for this update.
The active backup repository held one snapshot, taken before the `0009` migration.

### Step 19 source state — October 5, 2026

Checks run: 333 Linux tests with Ruff clean; TypeScript, Biome, 108 frontend tests across 18 files
and the Vite build; 33 ordinary native tests.

Deployed 2026-10-05. Backend release: `4207506dadba6dd62f0c596bd234136ff8a1c5edc3f17b13944f40ada5a3cade`.
Desktop SHA-256: `768dc85091654aed4564b284ef05daa5255659d4e12e6ebf89fb2053b9409edf`. Schema: `0011`.
Earlier releases are retained.

| Check | Result |
| --- | --- |
| Installed-release probe | Passed |
| Windows/WSL native integration | Both opt-in tests passed against the new release |
| Live migration | `prepare` succeeded; integrity-checked pre-migration copy present |
| Table comparison | 12 pre-existing tables and the identity marker identical; `alembic_version` and the `job_listings` definition changed; `listing_searches` added; 0 listings before and after |
| Desktop | Install script verified bytes; process reopened responsive |

Not verified: any step 14-19 screen in the unlocked app, including layout. After the hub bug,
styling is a known blind spot of the component tests. The active backup repository still held one
snapshot, taken before the `0009` migration; three migrations have run since.

### Step 20 part 1 source state — October 5, 2026

Checks run: 345 Linux tests with Ruff clean; TypeScript, Biome, 110 frontend tests across 18 files
and the Vite build; 33 ordinary native tests.

Deployed 2026-10-05. Backend release: `57a5d2b29dadda1e95f7a337fb8cc3d3b1166a9f9bac31fd43deaf51cc421eed`.
Desktop SHA-256: `f6fd5dade89966cb8d8bbd564c3c3c5f105dc1c9ee4ccd4ecda1c2d205e124fa`. Schema: `0012`.
Earlier releases are retained.

| Check | Result |
| --- | --- |
| Installed-release probe | Passed |
| Windows/WSL native integration | Both opt-in tests passed against the new release |
| Live migration | `prepare` succeeded; integrity-checked pre-migration copy present |
| Existing dossiers | 23 before and after; every pre-existing column value identical; none has a new date set |
| Other tables | 13 identical by typed-row hash, identity marker identical; `alembic_version` changed |
| Desktop | Install script verified bytes; process reopened responsive |

Oracle was in use and did not exit on a normal close request, so its process was stopped for this
update. Not verified: any step 14-20 screen in the unlocked app. The active backup repository still
held one snapshot, taken before the `0009` migration; four migrations have run since, this one on
the table of real dossiers.

### Chamber scene — October 5, 2026

Desktop SHA-256 is now `76e4a70e2191465bf7d7887d27691e95d8da4bbc553c99ce9c41735ba8d79652`,
a frontend-only change (see DESKTOP.md). Backend `57a5d2b2...` and schema `0012` are unchanged.
Checks: TypeScript, Biome, 113 frontend tests across 18 files, Vite and Tauri builds; installed
bytes verified and the process reopened responsive. The component was inspected in a browser
preview at two window sizes with motion off and on. Not verified: the scene in the installed,
unlocked window. Windows "Animation effects" is off on this PC, so the scene is still until the
owner uses the hub's Motion switch.

### Desktop update — approve-all and chamber camera, October 5, 2026

Desktop SHA-256 is now `555a5e17aedf25f61535c5998f9147265f842c8305ccd79df054bb1f5e6cf2d4`,
frontend only; backend `57a5d2b2...` and schema `0012` are unchanged. Checks: TypeScript, Biome,
120 frontend tests across 19 files, Vite and Tauri builds; installed bytes verified and the
process reopened responsive. The chamber camera was exercised in a browser preview. Not verified:
either feature in the installed, unlocked window, and approve-all against the real draft.

### Desktop update — Enter to unseal, October 5, 2026

Desktop SHA-256 is now `4855d897478de4662c9b42a108a3a19d01a9a324a9711cd52b865ea7ab6ff476`,
frontend only; backend `57a5d2b2...` and schema `0012` are unchanged. Checks: TypeScript, Biome,
125 frontend tests across 19 files, Vite and Tauri builds; installed bytes verified and the
process reopened responsive at the seal. Not verified: the key in the real seal window.

### Encrypted backup at schema 0012 — October 5, 2026

Snapshot `d154b193a3844b045e460e38da4b23d20aed2f86caa373f8807eaa68231b5382` was created at 18:46
in `OracleBackups-2026-10`. Evidence: the owner pasted the command's output, which reported the
snapshot created and its restore verified locally; the coding session saw the snapshot file in the
repository folder beside the earlier one; the owner's screenshot of OneDrive showed "Backed up and
synced" with that snapshot uploaded. Earlier notes in this file saying no backup had been taken
since before the `0009` migration are superseded by this entry. Not done: a restore of this
snapshot into separate staging on another machine. The earlier `OracleBackups` folder is unchanged
at four snapshots.

### Steps 17-18 source state — October 5, 2026

Checks run: 352 Linux tests with Ruff clean; TypeScript, Biome, 126 frontend tests across 19 files
and the Vite build; 33 ordinary native tests.

Deployed 2026-10-05. Backend release: `380671a6f4c9ccc082ceb08dace94761bca85693e4819fcac16f406dec017a0b`.
Desktop SHA-256: `581461f58ac6a42e645188dc5c55c445ea9b7ad0d870fe7d121923b2bf7da67e`. Schema stays `0012`;
no migration ran. The release passed its offline install probe and both Windows/WSL native
integration tests; selection verified it opens the existing workspace; afterwards it answered on
the live workspace with 0 listings, 23 applications and profile revision 29 (counts only). The
install script verified the desktop bytes and the process reopened responsive. Oracle was in use
and did not exit on a normal close request, so its process was stopped. Earlier releases are
retained. Counts read from the
live workspace for planning, numbers only: 29 approved entries (20 skills, 4 projects), all
preference lists empty, no listings stored. Not verified: the fit section on screen, and the
rules against a real listing and the owner's real skill names.

### Desktop update — slot figures, October 5, 2026

Desktop SHA-256 is now `c5d526506a1c5377953bcab8dc6cd923241e0a6ab5e374a48e2fdfc3da1e4b92`,
frontend only; backend `380671a6...` and schema `0012` are unchanged. Checks: TypeScript, Biome,
127 frontend tests across 19 files, Vite and Tauri builds; installed bytes verified and the
process reopened responsive. Viewed in a browser preview. Not verified in the unlocked window.

### Desktop update — cat tower and local figures, October 5, 2026

Desktop SHA-256 is now `b85d5d0b2c222c315e0ca5ee2d8bc994d76d63f5a22efa6e29a6a6a720c72704`,
frontend only; backend `380671a6...` and schema `0012` are unchanged. This build bundles two
Git-ignored local images, so the hash cannot be reproduced from the repository alone. Checks:
TypeScript, Biome, 128 frontend tests across 19 files, Vite and Tauri builds; installed bytes
verified and the process reopened responsive. Not verified in the unlocked window.

### Desktop update — roaming figure and cat tree, October 5, 2026

Desktop SHA-256 is now `49bbe82657d560271d9e7b122d639c9a862417cb3ee8e16d169a47fdea90e596`,
frontend only; backend `380671a6...` and schema `0012` are unchanged. The build bundles three
Git-ignored local images and cannot be reproduced from the repository alone. Checks: TypeScript,
Biome, 129 frontend tests across 19 files, Vite and Tauri builds; installed bytes verified and the
process reopened responsive. Not verified in the unlocked window.

### Desktop update — rooms and larger platform, October 5, 2026

Desktop SHA-256 is now `4ae455ab11550a054e274871fbb9c8ff5a7254cc49fadf88596933d40874fd66`,
frontend only; backend `380671a6...` and schema `0012` are unchanged. The build bundles
Git-ignored local images. Checks: TypeScript, Biome, 133 frontend tests across 19 files, Vite and
Tauri builds; installed bytes verified and the process reopened responsive. The hub and all four
rooms were viewed in a browser preview. Not verified in the unlocked window. The new rooms make
no native or backend call; a test asserts that opening one triggers none.

### Desktop update — swimmer under the floor, October 5, 2026

Desktop SHA-256 is now `aad0bae068b79d3f381a88dadb4d09f9643d30098f877f478709895b5a34b893`,
frontend only; backend `380671a6...` and schema `0012` are unchanged. The build bundles
Git-ignored local images. Checks: TypeScript, Biome, 133 frontend tests across 19 files, Vite and
Tauri builds; installed bytes verified and the process reopened responsive. Viewed in a browser
preview. Not verified in the unlocked window.

### Desktop update — figure acts and pressable core, October 5, 2026

Desktop SHA-256 is now `2b563ae11256fe02a5e3fb7a93e0caf85292daefc5ba45e6216b85b2ce18eb7a`,
frontend only; backend `380671a6...` and schema `0012` are unchanged. The build bundles
Git-ignored local images. Checks: TypeScript, Biome, 139 frontend tests across 19 files, Vite and
Tauri builds; installed bytes verified and the process reopened responsive. Still frames of each
act were viewed in a browser preview; no act was watched running in real time, and the cat
routine was seen only at small size. Not verified in the unlocked window.

### Desktop update — routines, pose strips, floor and sixth figure, October 5, 2026

Desktop SHA-256 is now `9d121010213bfbb7def3a3659ec5e67dccf9ebec62c9c36c1b68bba3837f0601`,
frontend only; backend `380671a6...` and schema `0012` are unchanged. The build bundles
Git-ignored local images. Checks: TypeScript, Biome, 143 frontend tests across 19 files, Vite and
Tauri builds; installed bytes verified and the process reopened responsive. Single moments of
each animation were viewed in a browser preview. Not verified: any of it running in real time,
and the chamber in the installed, unlocked window.

### Desktop update — figures kept clear of each other, October 5, 2026

Desktop SHA-256 is now `c813bd8fe9d000f31d30f3ac429491acd12ddeceba2ca7ee92a83f04adf2f9ee`,
frontend only; backend `380671a6...` and schema `0012` are unchanged. The build bundles
Git-ignored local images. Checks: TypeScript, Biome, 144 frontend tests across 19 files (one
checks every routine's swept area against everything that stands and against the other mover),
Vite and Tauri builds; installed bytes verified and the process reopened responsive. Not
verified: the chamber running in the installed, unlocked window.

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
