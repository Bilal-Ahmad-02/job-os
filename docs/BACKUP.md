# Backing up and restoring Oracle

Oracle's source repository is https://github.com/Bilal-Ahmad-02/job-os.
GitHub stores only files that have been committed and pushed. Editing a local file does not
automatically back it up. After each tested milestone, review the changes, commit the intended
source files, and push `main`. Confirm the remote commit matches the local one:

```powershell
git status --short
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

The last two commands should show the same commit hash. Before committing, inspect
`git diff --cached --stat` and `git diff --cached`. Never force-push as a backup procedure.
Lockfiles, source, tests, icons, and setup documentation belong in Git. Build artifacts,
installed dependencies, password hashes, `.env` files, API keys, local models, and personal
documents do not. `.gitignore` helps prevent accidents; it does not inspect file contents or
remove secrets from existing Git history.

## Restore after losing a computer

1. Sign in to the GitHub account that owns the repository. Keep GitHub recovery codes somewhere
   independent of the computer, such as your password manager's recovery kit.
2. Install Git and clone the repository:

   ```powershell
   git clone https://github.com/Bilal-Ahmad-02/job-os.git
   Set-Location job-os
   ```

3. Follow `README.md` for Python and `docs/DESKTOP.md` for the Windows/Node/Rust prerequisites.
   Use the committed dependency lockfiles, run the checks, and build the desktop executable.
4. Launch Oracle and create a new local Oracle password on the replacement computer.

The Windows executable can be rebuilt from source. GitHub does not preserve the installed
Python environment, compiler, Windows runtime, or current executable in this repository.

## Personal data is a separate backup

Oracle now stores application history at
`%LOCALAPPDATA%\local.oracle.desktop\oracle.sqlite3`. GitHub source backups **do not include this
database**, CVs, credentials, or local settings. The original imported Excel workbook is unchanged;
later edits in Oracle are stored only in the database.

To take a manual data backup, close every Oracle window and wait for any import/maintenance command
to finish, then copy both `oracle.sqlite3` and its matching `oracle.workspace-id` to a trusted private
backup location. Never publish these files in Git. To restore, close Oracle, keep a copy of the current
pair, and restore the backup pair to the same location. Reopen Oracle and verify the records.
Do not mix a database and marker from different workspaces. Keep dated versions; a sync folder alone is
insufficient protection against accidental deletion or corruption. The encrypted, versioned workflow
below is now available; it must be initialized locally and finish OneDrive sync before it protects
against loss of the PC. Oracle's access password locks the app; it does not encrypt database files.

The `0001` to `0002` upgrade creates a verified recovery copy under the private workspace's
`migration-backups` directory. This protects that migration, not loss of the computer. Those legacy
snapshots predate the identity marker and need a reviewed restore procedure. See
[workspace lifecycle](APPLICATIONS.md#workspace-lifecycle-and-recovery).

The local password hash is stored at `%LOCALAPPDATA%\local.oracle.desktop\password.phc`, outside
the repository. Keep the password in your password manager. Never upload the hash to GitHub.
There is no scheduled backup or Git push. Oracle writes encrypted repository files to the chosen local
OneDrive folder; the existing OneDrive client handles cloud sync. Oracle cannot yet verify remote sync.

## Encrypted snapshots and staged recovery

Schema `0003` stores imported original PDFs inside the database, so new encrypted snapshots include
them with application history. A snapshot taken before import does not include these documents.
Restore accepts `0002` and `0003` manifests and validates each against its declared schema; it never
silently upgrades an archive during verification. Prepare a restored `0002` workspace explicitly
before opening it with the current app. See [DOCUMENTS.md](DOCUMENTS.md).

Local setup completed successfully on 2026-09-26. The setup command reported success after creating
the first encrypted snapshot, restoring and validating it in private staging, and checking the
repository's encrypted data. On 2026-09-27 the repository contained one snapshot and no temporary
backup/restore directories remained beside the live workspace. OneDrive cloud upload status has not
yet been independently confirmed. This is a manual backup workflow, not scheduled protection.

After the three source PDFs were imported on 2026-09-27, a further encrypted snapshot completed
successfully and passed the `create` command's restore verification. It includes the new document
originals in the database. OneDrive upload of this snapshot still needs confirmation; the earlier
pre-import snapshot does not contain the documents.

The owner selected the existing OneDrive account. The intended repository is
`$env:OneDrive\OracleBackups`. The live database stays in AppData; do not move it into OneDrive.
This milestone uses the established [restic encrypted repository format](https://restic.readthedocs.io/en/stable/100_references.html),
not a custom cryptographic format. A separate backup password is required for every maintenance run.
Create a unique 20–128 character passphrase and keep it in a password manager recoverable without this
PC. Losing it means the encrypted backup cannot be recovered. Do not put it in chat, scripts, Git,
command-line arguments, or a file beside the repository. Oracle's login password is unrelated.

From the repository root, initialize and create the first verified backup:

```powershell
.\.venv\Scripts\python.exe -I -m app.backup setup --repository "$env:OneDrive\OracleBackups" --database "$env:LOCALAPPDATA\local.oracle.desktop\oracle.sqlite3"
```

The command opens no web service and requests no renderer permissions. It asks for the password in
the local terminal, confirms it, initializes a new repository, creates a snapshot, reads that exact
snapshot back, verifies the restored database/identity/manifest, and checks all encrypted data. An
existing repository directory is never reinitialized, even if empty or partially synced. After a
partially completed setup, inspect its state; use `create` for an already initialized repository.

Subsequent backups and checks:

```powershell
.\.venv\Scripts\python.exe -I -m app.backup create --repository "$env:OneDrive\OracleBackups" --database "$env:LOCALAPPDATA\local.oracle.desktop\oracle.sqlite3"
.\.venv\Scripts\python.exe -I -m app.backup list --repository "$env:OneDrive\OracleBackups"
.\.venv\Scripts\python.exe -I -m app.backup check --repository "$env:OneDrive\OracleBackups"
```

Each successful `create` prints a full snapshot ID. Retention is append-only at this stage: no automatic
deletion or pruning. Check OneDrive's sync completion and account storage separately. Operate this
repository from one computer at a time, allowing sync to complete before using it from another.
The backup tool's successful local check is not proof that OneDrive has uploaded every repository file.

To rehearse recovery, select a full ID from `list`, then restore to a **new** private directory:

```powershell
$oracleSnapshot = 'paste-the-full-64-character-snapshot-id-here'
.\.venv\Scripts\python.exe -I -m app.backup restore --repository "$env:OneDrive\OracleBackups" --snapshot $oracleSnapshot --target "$env:LOCALAPPDATA\local.oracle.desktop\recovered-workspace" --staging "$env:LOCALAPPDATA\local.oracle.desktop"
```

The target must not exist. Restore decrypts into temporary private staging, validates the files, and
then publishes the verified pair and manifest into the new directory. It does not activate that
workspace, change credentials, or overwrite the running app's records. If interrupted during final
publication, the new target may be partial; it is not reported as successful and is never overwritten
on retry. Review or keep it and use a different new target. Activating a restored pair remains an
explicit maintenance step with every Oracle instance closed; preserve the current pair first.

Implementation limits and controls:

- Snapshot scope is exactly `oracle.sqlite3`, `oracle.workspace-id`, and a versioned `manifest.json`.
  It covers application history and import provenance. Password hashes, API secrets, future CV files,
  model weights, caches, and unrelated documents are excluded.
- SQLite's backup API captures a consistent database, including WAL changes. A short writer
  reservation coordinates with existing application writes. It does not migrate or initialize data.
- The manifest contains schema/workspace identity, creation time, sizes, and SHA-256 checksums.
  Restore validates those, SQLite integrity, foreign keys, and supported schema. The manifest is
  inside restic's authenticated encryption; its checksums alone are not proof of authenticity.
- The current database limit is 256 MiB. Snapshot copying has a 10-second budget; restic operations
  are bounded to 120 seconds each, with 300 seconds for a full check. Large future document/model
  archives require a separately designed scope and resource policy.
- Only fixed files are decrypted; no archive-selected paths, symlinks, or extra payloads are applied.
  Known OneDrive roots are rejected for plaintext staging and recovered data. Choose private local
  directories for other sync providers too; their roots are not automatically detected.
- Passwords are supplied to restic via non-terminal stdin, with inherited `RESTIC_*` configuration
  removed. There is no shell, saved password file, password argument, or raw tool stderr in output.
  As with the current app, another process running as the same OS user is outside this isolation.
- Temporary plaintext exists beside the private workspace during backup/verification and is removed
  on normal completion/failure. A hard process kill can leave private temporary directories; deletion
  is not secure erasure. Original database files remain unencrypted.

## Backup tool setup and validation

The tested Windows tool is restic **0.19.1**, downloaded from its
[official release](https://github.com/restic/restic/releases/tag/v0.19.1) into the ignored directory
`.cache/tools/restic-0.19.1`. No system PATH or package dependencies were changed.

- Official archive: `restic_0.19.1_windows_amd64.zip`
- Archive SHA-256: `da948ad707ed690426473aaba2046cd61f8f90f6f0e7dab6be0d5796531de67d`
- Executable SHA-256: `b0dd1fd21eea5d8fe1325f55f7118213c21f36de8a261e04c0624a5ab9fd7830`

The archive digest was checked against official GitHub release metadata over HTTPS. The default CLI
also checks the executable digest before every run. On a replacement PC, obtain that official binary
again and verify it; `.cache` is not in Git. Follow the upstream
[installation and signature verification guidance](https://restic.readthedocs.io/en/stable/020_installation.html).
An explicit trusted `--restic` path supports another reviewed installation, including a future Linux
runtime. It is a local maintenance option, not a renderer or model-selected executable.

`tests/test_backup.py` covers synthetic encrypted round trips with multiple retained versions, wrong
passwords, tampered encrypted data/manifests, WAL snapshots, missing/mismatched sources, unavailable
destinations, interrupted writes, refusal to overwrite targets, scope/path validation, and bounded
tool output/time. Tests never use the owner's records or backup password. The restic integration
cases require the verified cache or an explicit `ORACLE_TEST_RESTIC` test executable.
