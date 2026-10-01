# Private source documents

**Runtime update, 2026-09-30:** originals now reside in the active Ubuntu database at
`/home/lethargic/.local/share/oracle/oracle.sqlite3`. All original bytes and version history were
verified unchanged during cutover. AppData paths and Windows maintenance commands below are historical;
use Linux Python and the active Linux database for future imports. Never create a second live copy.
See [WSL_DEVELOPMENT.md](WSL_DEVELOPMENT.md) and [BACKUP.md](BACKUP.md).

Oracle stores original PDFs in the `source_documents` table of its private Linux SQLite
workspace. Each immutable row includes the original bytes, SHA-256, basename, document kind,
byte size, page count, and import time. Absolute source paths are not persisted. The original
files are never modified. Identical bytes imported again with the same kind reuse the existing
record; a conflicting kind fails the entire batch.

The unlocked desktop's **EVIDENCE / SOURCE VAULT** register shows metadata only. Documents are
`source_only`: storing a CV, certificate, or transcript does not verify its claims. There is no
OCR, automatic qualification inference, AI upload, embedded PDF viewer, or export command.
Step 4 adds private page text extraction and a separate unreviewed profile draft with document/page
citations; it does not change the source-only status. See [PROFILE.md](PROFILE.md).

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
deadline and a 512 MiB worker memory limit. Files must start with a PDF header, be at most 10 MiB, and contain 1–100 pages.
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

## Explicit versions (step 6, schema 0007)

**02 / VAULT** groups each document's revisions under the latest stored version. Expand an entry
for its metadata, then **Version history** for earlier originals. Search also matches earlier
filenames. **File integrity and document ID** exposes the exact immutable ID and checksum.
**03 / IDENTITY** labels each citation with its version and warns when a newer original is stored.
A newer file does not move, invalidate, or re-approve an existing citation automatically.

New files are still imported through the local maintenance command, not an in-app file picker.
To append a version, first obtain the current document ID from the Vault. Close Oracle and finish
other maintenance, then specify exactly one PDF and its predecessor:

```powershell
.\.venv\Scripts\python.exe -I -m app.import_documents --database "$env:LOCALAPPDATA\local.oracle.desktop\oracle.sqlite3" --cv "C:\private\updated-cv.pdf" --replaces "CURRENT-DOCUMENT-UUID"
```

Use `--certificate` or `--transcript` instead of `--cv` for the corresponding kind. The replacement
must have the same kind. The command returns its document ID without printing source paths or text.
Without `--replaces`, new bytes start an independent document family; filenames do not imply a link.
Different versions of a certificate must be linked explicitly, never grouped merely by document kind.

Every stored version remains a separate immutable `source_documents` row. `document_versions` adds
its family/root ID, sequential revision, and predecessor. Existing documents migrate to independent
version-1 roots with unchanged IDs, bytes, metadata, extracted pages, and profile evidence. Unique
family/revision and predecessor constraints prevent branches; imports serialize under the existing
workspace writer reservation. A stale predecessor, missing ID, different kind, conflicting duplicate,
or multi-file replacement fails without partially importing anything.

An exact retry returns its existing version, even if later revisions have since been appended.
Reimporting the current identical file creates no new version. Global byte deduplication means an
original already belonging to another family or an older revision cannot be relinked as a new copy.
Renaming a file alone does not create a revision or change stored metadata. There is no deletion,
merging, rollback-to-old-bytes, or implicit promotion of a historical version in this milestone.
The existing 100-file / 100-MiB workspace limit counts all versions, not only the latest ones.

Importing a newer source does not regenerate the structured draft, replace approved profile entries,
or claim its contents are verified. Page extraction can be run explicitly afterward. Creating another
semantic review draft remains a separate workflow; the existing draft is immutable and is not replaced.
The source register is metadata-only, with no arbitrary renderer paths or PDF execution capability.

The checked private migration copy precedes schema `0007`. New encrypted snapshots include every
original and its lineage atomically. Older `0002` through `0006` snapshots are verified against their
own schema before explicit preparation upgrades them. Workspace validation rejects missing or broken
lineage. Take a new encrypted backup after importing new versions; older snapshots cannot contain them.
Synthetic tests cover retries, stale/concurrent replacements, exact original preservation, retained
citations and approvals, migration, and encrypted restoration of multiple versions.
