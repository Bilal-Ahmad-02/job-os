# Application history

**Runtime update, 2026-09-30:** the active database is now
`/home/lethargic/.local/share/oracle/oracle.sqlite3` inside Ubuntu. The Windows desktop accesses it
through supervised Linux workers. The AppData paths and Windows maintenance examples below describe
the earlier runtime; do not use them to create or reopen a second active workspace. Run future
maintenance with the Linux environment and database path. See [WSL_DEVELOPMENT.md](WSL_DEVELOPMENT.md).

Oracle is the master record after the one-time spreadsheet import. The **ACQ** console opens the
**DOSSIER.INDEX**. Enter a company or job title in the query and press **EXEC** (or Enter) to filter;
**SYNC** reloads the current results. **Ctrl+K** focuses the query while the index is open. Open a
numbered row to edit its fields and **Save application**. **NEW.DOSSIER** creates a new entry.
Row numbers are positions in the current results, not persistent record identifiers. The archive
count becomes the matching count when filtered; "in view" counts the current page only.
Blank title/company fields are preserved, but at least one is required.
Search results are paginated in groups of 50. Unsaved changes require confirmation when returning
to the list; closing or locking Oracle discards the in-memory draft.

All 13 spreadsheet columns have editable counterparts. Dates recognized by Excel are converted to
ISO dates; mixed date/note columns remain text so ambiguous information is not guessed or lost.
The structured status starts as **Unspecified** on import, even when a resume-sent date exists.
Choose a status yourself. The original status/date text remains a separate field.

An imported entry has an **Original spreadsheet entry** section with the original field values,
sheet/row number, and embedded hyperlinks. This snapshot does not change when the entry is edited.
Links and text are displayed as plain text; the app does not fetch or execute them.

## Storage and access boundary

- Database: `%LOCALAPPDATA%\local.oracle.desktop\oracle.sqlite3`, outside the repository.
- SQLAlchemy owns persistence. Revision `0001` creates application data; revision `0002` adds a
  workspace identity matched against `oracle.workspace-id` beside the database. Schema changes use
  new reviewed migrations. Ordinary requests never create databases or run Alembic.
- The first data operation in each desktop process performs startup validation/maintenance once.
  Recognized `0001` databases get a verified local recovery snapshot before upgrading. Missing,
  mismatched, malformed, or unsupported workspaces produce recovery errors rather than an empty list.
- The native `applications` command checks the unlocked session and holds its session guard for
  the operation. The renderer cannot choose the database, interpreter, module, or command line.
- Each request starts the repository's `.venv\Scripts\python.exe -I -m app.desktop_bridge` using
  inherited stdin/stdout pipes and no shell. Data is not passed in process arguments or environment
  variables. Python validates inputs before opening storage. The worker has request/response bounds
  and a 15-second native deadline; Windows cleanup includes the virtual-environment child process.
- `/health` remains the only HTTP endpoint. There are no application-data HTTP routes. Tracking
  works without manually starting the health server. Domain services are transport-independent
  so a future authenticated FastAPI API can reuse them.
- The present developer build locates `.venv` through its compile-time repository path. Moving the
  repository requires rebuilding; copying the executable alone is not a portable installation.
  A bundled Python runtime remains future packaging work.
- Version checks reject stale edits. Creation IDs make retries safe. Writes/imports acquire an
  explicit SQLite writer reservation before checking versions. Reads use ordinary transactions,
  allowing another connection to reserve the writer slot. Default SQLite journal semantics still
  apply: a short active reader can delay a writer's commit. SQL parameters bind user text.
- Errors never return SQL, filesystem paths, or private record contents to the renderer. Records
  are not written to browser storage, application logs, fixtures, or frontend build assets.

The password gates Oracle's interface; it does not encrypt SQLite or defend against software already
running as your Windows user. Local maintenance tools run with your Windows account's file access.
See [backup and recovery](BACKUP.md). No cloud upload or automatic backup is configured.

## One-time spreadsheet import

The importer supports the existing single-sheet **Job Application Log** format, headers on row 2
and fields in columns B–N. It preserves partial rows, all column values, and hyperlinks (including
links hidden behind job/company text). It leaves the workbook byte-for-byte unchanged.

```powershell
.\.venv\Scripts\python.exe -m app.import_history "C:\path\Job application log.xlsx" --database "$env:LOCALAPPDATA\local.oracle.desktop\oracle.sqlite3"
```

This is an explicit local maintenance command, not a renderer file-access capability. It accepts
only the known header mapping, rejects formulas/errors/comments requiring interpretation, and
limits compressed size, expanded size, rows and cells. XML protection uses defusedxml as advised
by [openpyxl's security guidance](https://openpyxl.readthedocs.io/en/stable/#security). Print-header
format warnings are ignored because printing layout is not imported; source cells are preserved.

All rows validate before insertion; any failure rolls back the batch. A SHA-256 fingerprint prevents
importing the **same file** twice. A modified workbook has a new fingerprint and would be a new import;
this is not bidirectional Excel synchronization or cross-file deduplication. Maintain records in
Oracle going forward. The command reports counts and a fingerprint, not personal record contents.

## Workspace lifecycle and recovery

Creating the first password in a genuinely new desktop workspace initializes its database explicitly.
Unlocking an existing workspace never authorizes replacement of a missing database. A legacy install
with credentials but no database is ambiguous: determine whether it was an unused installation or a
lost database before intentionally initializing anything. The app offers no automatic reset button.

Maintenance commands, from the repository root:

```powershell
# Validate an existing workspace and apply a supported upgrade, if needed.
.\.venv\Scripts\python.exe -m app.workspace prepare "$env:LOCALAPPDATA\local.oracle.desktop\oracle.sqlite3"

# ONLY for an intentionally new, empty workspace. Existing database/identity files are refused.
.\.venv\Scripts\python.exe -m app.workspace initialize "C:\path\to\new-workspace\oracle.sqlite3"
```

These commands return fixed error codes and exit nonzero on failure; they do not expose record
contents. They are local administrative tools, not extra renderer commands. No new shell, arbitrary
path, or migration permission was granted to the UI.

The database and `oracle.workspace-id` belong together. A missing/mismatched marker is a recovery
condition, not permission to adopt another database automatically. Opening uses SQLite `mode=rw`
(no-create), and each new transaction checks identity and schema. Keep both files in backups. The
marker detects mistakes; it is not encryption or protection against an attacker running as your user.

Startup checks include SQLite `quick_check`, foreign keys, required tables/columns, schema version,
and identity. Maintenance and writes coordinate using SQLite locks across app instances. No database
transaction is held while interacting with a cloud provider. Unknown versions are not downgraded.

Before upgrading a legacy `0001` database, Oracle writes a SQLite snapshot under the private workspace's
`migration-backups` directory and checks it before applying transactional DDL. A failed snapshot stops
the upgrade. Interrupted `.sqlite3.partial` files are not usable backups. A migration failure rolls
back schema changes. An interruption between database commit and marker publication fails closed;
it requires recovery rather than automatic deletion/reinitialization. This local recovery copy is
not an encrypted or off-device backup service.

An old `0001` snapshot has no identity marker. Restoring one requires a separately reviewed legacy
restore procedure; do not pair it with the active `0002` marker or overwrite a live workspace.

Migration startup follows [Alembic's connection-sharing pattern](https://alembic.sqlalchemy.org/en/latest/cookbook.html#sharing-a-connection-across-one-or-more-programmatic-migration-commands).
Explicit SQLite transaction control follows the [SQLAlchemy SQLite documentation](https://docs.sqlalchemy.org/en/20/dialects/sqlite.html#enabling-non-legacy-sqlite-transactional-modes-with-the-sqlite3-or-aiosqlite-driver).

## Verification

Application queries and mutations now have separate typed service functions and Pydantic result
contracts. Desktop responses use a version-1 envelope checked by Rust, and the frontend validates
result fields at runtime. Unknown request fields remain rejected. `documents_list` returns bounded
metadata for the private [source document register](DOCUMENTS.md), never PDF bytes or source paths.
Schema `0003` adds that register; upgrading `0002` also creates a checked local recovery copy.

Run `python -m pytest`, `python -m ruff check .`, and `python -m ruff format --check .` using `.venv`.
In `apps/desktop`, run `npm run check` and `npm test`. In `src-tauri`, run `cargo test --locked` and
`cargo clippy --locked --all-targets -- -D warnings`. Rust integration tests require the repository
Python environment; all use temporary databases and synthetic credentials. Python spreadsheet
fixtures are synthetic OOXML; no personal workbook is required for tests.

On 2026-09-25, OSV queries for the eight added Python packages returned no known advisories:
SQLAlchemy 2.0.54, Alembic 1.20.0, openpyxl 3.1.5, defusedxml 0.7.1, greenlet 3.5.6,
Mako 1.4.3, MarkupSafe 3.0.3, and et-xmlfile 2.0.0. This is a point-in-time dependency check;
the existing Tauri findings remain documented in [desktop security](DESKTOP.md).

## Deadlines, follow-up dates and source listings (step 20, part 1)

Status on 2026-10-05: implemented, tested and deployed on the owner's instruction as backend
`57a5d2b29dadda1e95f7a337fb8cc3d3b1166a9f9bac31fd43deaf51cc421eed` and desktop
`f6fd5dade89966cb8d8bbd564c3c3c5f105dc1c9ee4ccd4ecda1c2d205e124fa`. The live workspace is at
schema `0012`. With Oracle closed, the release's explicit `prepare` took the integrity-checked
local copy (`migration-backups/before-0012-*.sqlite3`) and migrated. All 23 existing dossiers kept
every stored value (compared column by column over the pre-existing columns), no dossier has a new
date set, and the 13 other tables and the identity marker were identical by typed-row hash. Both
Windows/WSL native integration tests passed against the release. Not seen in the unlocked app by
the coding session. No encrypted backup was taken before this migration.

- A dossier has two optional dates the owner sets: **Application deadline** and **Follow up on**.
  They are real calendar days in ISO form or empty; impossible days are rejected. The existing
  free-text follow-up and interview fields are unchanged and nothing is parsed out of them.
- The dossier index shows the dates, marking a deadline before today as "(passed)" and a follow-up
  on or before today as "(due)". That is a label computed when the list is drawn. Oracle does not
  remind, notify, schedule or change a status because of a date; that belongs to step 28.
- A dossier started from a collected listing reports that listing. **Open source listing** switches
  to 06 / INGRESS and opens it. If another listing is already open there, Oracle asks before
  leaving it, so unsaved listing edits are never replaced silently.

Storage: schema `0012` adds `deadline_date` and `follow_up_date` to `applications`, empty for every
existing dossier. No existing column or row value changes. The two fields are not part of
spreadsheet import provenance, which still records exactly the imported columns. The link to a
listing is read from `job_listings.application_id`; nothing new is stored for it. Application
records gained `listing_id` and the date fields, so backend and desktop must be deployed together.

Not in this part: tasks and reminders, interview preparation, and links from an application to the
exact documents used. Those remain open under step 20.

Verification: 345 Linux tests (12 more), 110 frontend tests (2 more) and 33 native tests pass. They
cover round-trip and clearing of dates, rejected dates, unchanged import provenance, the listing
link surviving edits, a real migration from `0011` that preserves an existing dossier's values,
an updated legacy-upgrade test that writes its 2026-09 row as that release stored it, strict
response validation, save-on-request, the index labels and guarded navigation to the listing.
Not seen in the running app.

## To-do items, preparation notes and documents used (step 20, part 2)

Built on 2026-10-06. **Not deployed**: it needs schema `0013`, so the backend and desktop must be
installed together after the owner approves the migration.

What the owner gets in a dossier:

- **05 / TO DO**: up to 30 items, each with a title, an optional due date and a tick. The index
  shows how many are unticked ("2 to do"). Oracle never adds or ticks an item, and a due date is
  only displayed. Nothing reminds or notifies; that belongs to step 28.
- **06 / INTERVIEW PREPARATION**: one free-text note, up to 10,000 characters, written by the
  owner. Nothing is generated or suggested.
- **07 / DOCUMENTS USED**: ticks against stored document versions, up to 10. A tick records the
  owner's statement that this exact file was used. It is not evidence that anything was sent. A
  link names one immutable stored version, so adding a newer version later does not move it; the
  list marks each as current or superseded.

How it is stored and saved: `applications.preparation`, and two small tables,
`application_todos` and `application_documents`, each keyed by dossier and position. They travel
inside the existing dossier record, so there is no new desktop operation: a save replaces the
dossier's whole to-do list and link list under the same version check as its other fields, and a
stale save changes nothing. A link to a document that is not stored is refused with `invalid` and
nothing is saved. Unticking removes only the link. The spreadsheet import's provenance never
includes these fields.

Verification: 366 Linux tests (14 more) and 148 frontend tests (3 more) pass. They cover order
and state of items, replacement and clearing, isolation between dossiers, stale saves, every
malformed item, the limits, a link surviving a newer version, refusal of an unknown document
without partial writes, the JSON request shape, a real migration from `0012` that preserves an
existing dossier's values, strict response validation in the desktop, and the screen's wording
and behaviour. Not run: the native tests, the two Windows/WSL integration tests, the migration on
the real workspace, and the running app.
