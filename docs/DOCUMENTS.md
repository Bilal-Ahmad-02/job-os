# Private source documents

Oracle stores original PDFs in the `source_documents` table of its private AppData SQLite
workspace. Each immutable row includes the original bytes, SHA-256, basename, document kind,
byte size, page count, and import time. Absolute source paths are not persisted. The original
files are never modified. Identical bytes imported again with the same kind reuse the existing
record; a conflicting kind fails the entire batch.

The locked desktop's **EVIDENCE / SOURCE VAULT** register shows metadata only. Documents are
`source_only`: storing a CV, certificate, or transcript does not verify its claims. There is no
text extraction, OCR, qualification inference, AI upload, embedded PDF viewer, or export command
in this milestone. A later profile module should link reviewed facts to this evidence.

## Import boundary

Imports are explicit local administrative operations, not renderer-provided file paths:

```powershell
.\.venv\Scripts\python.exe -I -m app.import_documents --database "$env:LOCALAPPDATA\local.oracle.desktop\oracle.sqlite3" --cv "C:\private\cv.pdf" --certificate "C:\private\certificate.pdf" --transcript "C:\private\transcript.pdf"
```

Close Oracle and finish other maintenance before import. The CLI parses all inputs before
opening the workspace and imports a batch transactionally. It does not create a missing workspace.
Only the filename, kind, and inspection metadata reach normal desktop queries; PDF bytes stay
in storage. The existing native unlocked-session check applies to `documents_list`.

The pinned pypdf reader inspects PDFs in a separate, fixed Python process with a 15-second
deadline. Files must start with a PDF header, be at most 10 MiB, and contain 1–100 pages.
Encrypted PDFs that open with an empty password are accepted without changing their original
encrypted bytes; PDFs requiring another password are rejected. The parser does not follow links
or execute embedded PDF actions. This is process isolation and input limiting, not an OS security
sandbox or a general malware scanner. The register is limited to 100 files and 100 MiB in total.

## Recovery and privacy

Schema `0003` adds document storage to `0002`. Explicit preparation first takes a checked recovery
copy beside the private workspace, then upgrades transactionally while retaining its identity and
application records. Original PDFs are SQLite BLOBs so the existing consistent database backup
includes them atomically. Old `0002` encrypted snapshots remain verifiable and restorable without
changing their bytes; explicit preparation upgrades a recovered workspace when needed.

Create a fresh encrypted backup after an import. Earlier snapshots cannot contain later documents.
OneDrive must finish syncing for off-device protection. See [BACKUP.md](BACKUP.md). The local database
is not encrypted by the Oracle login password; Windows account and disk protection remain relevant.
Never put personal documents, extracted text, database files, or private import logs in Git.

Tests use synthetic PDFs, including empty-password and password-protected cases. They check
exact-byte preservation, idempotency, transaction rollback, metadata-only transport, schema upgrade,
and encrypted backup/restore. Personal files are not test fixtures.

On 2026-09-27, OSV returned no known advisories for the added pypdf 6.19.0 dependency. This is a
point-in-time check, not a guarantee; keep reviewing the pinned parser when updating dependencies.
