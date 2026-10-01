# Candidate profile foundation

## Search preferences (step 13, 2026-10-01)

Open **03 / IDENTITY > Saved profile > Job preferences**. Target roles, preferred locations,
work arrangements and employment types now sit alongside explicit **Excluded employers** and
**Excluded listing phrases**. Each text list accepts up to 20 nonempty entries of 300 characters;
blank editor lines are removed and surrounding whitespace is trimmed before an explicit save.
Case-insensitive duplicates are rejected. No search criteria are guessed from documents or notes.

Empty selections mean unspecified, and multiple selections represent alternatives. A remote-work
preference does not establish eligibility in another country. Employer names and listing phrases
are stored separately for future matching; phrases are plain text, never regex or executable input.
The matching milestone must make its comparison rules and uncertain/missing listing fields visible.
Other constraints (salary, commute, eligibility and existing free-text exclusions) remain review
notes, not automatically interpreted rules. Saving does not search, contact a source or share data.

Preferences use the existing versioned profile transaction, native lock and Linux database. Reads
of older stored profiles supply empty new lists without rewriting JSON, notes, revision or evidence.
Updates to existing profiles require every preference field, preventing an incomplete/older client
from silently dropping exclusions. An explicit empty list clears that field. The usual conflict,
uncertain-save and draft retention rules below apply; evidence approval preserves these preferences.

No table migration or new dependency is required. New snapshots retain the extended profile.
After a profile containing the new fields has been saved, use this or a newer compatible runtime
for recovery: older runtimes reject the extra JSON fields despite sharing schema `0008`. Never
remove exclusions or restore an old database just to make a code rollback work. Original draft
bytes and their review hash remain unchanged.

## Current interface: saved profile (step 7, 2026-10-01)

**03 / IDENTITY** now contains **Saved profile** and **Evidence review** channels. Saved profile
edits basic details, experience, education, skills, projects, certificates, and the initial job
preferences already supported by schema `0004`. No database migration or automatic profile
population is performed. Empty fields and unspecified education completion remain explicit.

Entries retain stable IDs. Adding, editing, or removing an entry changes only the in-memory draft
until **Save profile**; removal and whole-draft discard require explicit inline confirmation.
The complete aggregate is saved with its loaded revision through the existing guarded native IPC
and Linux service. Original documents, citations, extracted proposals and review decisions remain
unchanged. Manual edits are owner-provided assertions, not independent verification.

Switching modules or identity channels preserves drafts. Lock/close discards unsaved changes.
After evidence approval, an untouched editor refreshes its saved profile; a dirty editor retains
its draft and presents the new saved revision for comparison. Editor saves similarly refresh the
review channel while retaining unsaved review corrections. Input IDs remain unique across channels.

On a conflict or unconfirmed save, the draft is retained and automatic retries are prohibited.
**Check latest saved profile** retrieves a comparison without replacing a dirty draft. A newer
revision blocks saving that old draft. **Use latest saved profile — discard my draft** is an
explicit replacement; there is no automatic merge or force-overwrite. If a save committed but its
response was lost, the comparison exposes the saved result. Review-only changes remain separate
from profile revisions; neither revision history nor a full audit log is implied.

Preferences currently cover target roles, locations, work arrangements, employment types and
free-text constraints/exclusions. These are stored intentions, not active search/matching rules.
Automatic job ingestion and matching remain future milestones.

Validation: 64 frontend tests, TypeScript/Biome checks, and 31 existing Linux profile/review tests
pass using synthetic data. No dependencies or Python/native behavior changes were needed.
The historical milestones below describe the implementation sequence.

**Runtime update, 2026-09-30:** profile data, source evidence, and review decisions now live in
`/home/lethargic/.local/share/oracle/oracle.sqlite3` inside Ubuntu. All tables were verified unchanged
during migration. Windows/AppData maintenance examples below describe the previous runtime; use the
Linux environment and active Linux database for further maintenance. See
[WSL_DEVELOPMENT.md](WSL_DEVELOPMENT.md) for ownership and recovery constraints.

Step 3 added backend storage and typed profile operations. Step 4 now adds local page extraction
and a separate, unreviewed draft; see below. Step 5 adds the owner review interface and per-entry decisions; see below. Existing
documents remain immutable, unverified source material. A new workspace and an upgraded workspace both start with no stored
profile. Reading an absent profile returns version 0 and empty fields without inserting a row.

## Data and ownership

`schemas/profile.py` defines name, headline, location, summary, experience, education, skills,
projects, certifications, and initial job preferences. Entries have stable UUIDs for future evidence
references. Education completion defaults to `unspecified`; nothing infers a completed qualification.
Months are optional `YYYY-MM` values. Unknown dates stay empty. Contradictory periods, duplicate entry
IDs, invalid types, unknown fields, and invalid preference values are rejected.

Manual data is marked `user_provided`, which is an assertion, not external verification. Document
extraction must eventually create separate reviewable proposals with document/page provenance;
it must not silently overwrite this profile or promote extracted claims to confirmed qualifications.
Contact details, salary rules, matching logic, and richer search settings can be added when needed.

The singleton `candidate_profile` table stores validated JSON, an integer revision, and update time.
The profile is a small aggregate edited atomically rather than a collection of independent partial
updates. This keeps conflict handling and backup consistent without speculative tables for future
features. Its typed shape and UUIDs allow later explicit migrations into relational tables if query
requirements justify them. Input fields and collection lengths are bounded; the entire serialized
profile must fit within 256 KiB of UTF-8, also enforced by a database constraint.

## Private transport and concurrency

`profile_get` and `profile_save` use the existing fixed Python worker and version-1 native IPC
envelope. The native unlocked-session guard covers both reads and writes. No HTTP endpoint, shell,
file selector, or arbitrary database path is added. These operations are prepared for the later
frontend profile editor; there is no new visible profile screen in this step.

`profile_save` requires a version and typed `data`; updates must include every top-level field
from the retrieved profile, so accidentally sending only a name cannot erase other sections.
Initial saves may use default empty sections. Under a SQLite writer reservation,
the service compares that version with the stored revision. A stale differing edit returns the
existing safe `conflict` error without overwriting anything. An exact retry of the immediately
preceding successful save returns the saved revision; a current-version no-op does not advance it.
Multiple sessions therefore cannot silently replace one another's edits. Removing an entry from a
complete saved profile removes it from current data; revision numbers are not a historical audit log.
Recovery of earlier content still depends on retained backups.

## Migration and verification

Schema `0004` adds the empty table. Preparation validates workspace identity and existing data,
takes a checked local recovery copy, and upgrades transactionally. It does not alter application
records or document originals. Ordinary profile access never initializes a missing workspace.

Encrypted snapshots now include profile data with the same private SQLite database. Restoring
supported `0002` or `0003` backups validates them against their original schema without modifying
them. Explicit preparation upgrades recovered workspaces to `0004`. Snapshots made before the
profile existed cannot contain later profile edits. See [BACKUP.md](BACKUP.md).

Synthetic tests cover empty reads, every profile section, invalid/oversized data, date consistency,
concurrent edits, idempotent retries, worker contracts, native locking, migration, and encrypted
backup restoration. No personal facts are fixtures or source code. No new dependency is needed.

## Draft evidence (step 4, schema 0005)

`document_text` holds page-indexed text, the original PDF SHA-256, parser/version identifier, and
extraction time. Extraction runs in a disposable process with a 15-second deadline and a 512 MiB
memory ceiling. It accepts the existing PDF limits and rejects more than 64,000 characters per page
or 512 KiB of extracted UTF-8/output (with a small JSON envelope allowance). Empty/image-only files
return `source_no_text`; OCR is not implemented. Original bytes are never rewritten. Repeat extraction
reuses the stored result; parser upgrades do not silently replace evidence already cited by a draft.
These limits reduce resource risk; the worker is not a complete OS sandbox.

`profile_draft` is separate from `candidate_profile`. Its bounded typed payload requires evidence for
every populated scalar and every section entry. Citations identify the stored document UUID, one-based
page, and excerpt. Import checks page bounds, source hashes, and excerpt presence after Unicode NFKC
and whitespace normalization. This establishes traceability, not factual truth or semantic entailment.
An excerpt can be genuine while its interpretation is mistaken. Owner review is still required.
Job preferences cannot be inferred into a document draft. Unknown completion status stays unspecified.

The initial semantic draft was prepared with coding-session assistance and is labeled
`assisted_import` / `unreviewed`. Oracle currently extracts page text; it does not yet automatically
convert arbitrary documents into reliable structured profiles. There is no AI provider, remote upload,
credential verification, or approval workflow in this milestone. `profile_draft_get` is a read-only
native IPC operation under the existing unlocked-session guard. The frontend review screen is now implemented in step 5 below.

Maintenance operations (close Oracle and finish other maintenance first):

```powershell
.\.venv\Scripts\python.exe -I -m app.profile_draft extract --database "$env:LOCALAPPDATA\local.oracle.desktop\oracle.sqlite3"
.\.venv\Scripts\python.exe -I -m app.profile_draft import --database "$env:LOCALAPPDATA\local.oracle.desktop\oracle.sqlite3" --input "C:\private\draft.json"
```

Draft JSON must match `DraftPayload` and remain outside source control and plaintext sync folders.
An exact repeat is idempotent; a differing existing draft is rejected, never silently replaced.
Extraction commits each document independently, so a later failure can leave earlier successful
extractions. Retrying safely reuses them. Draft import is atomic and never writes the active profile.
Errors print fixed codes; parser stderr and private excerpts are not logged.

Migration `0005` takes a checked private recovery copy before adding the two tables. Encrypted
snapshots include both tables with originals and application history. Restores of `0002`, `0003`, and
`0004` retain their original schema during verification; explicit preparation upgrades them.
The live workspace was migrated on 2026-09-29 with existing rows and workspace identity verified
unchanged. Three documents yielded four pages; 29 source-cited draft entries were saved. The active
profile remains empty. Review notes flag uncertain dates and credential interpretation without
claiming verification. No private document text or candidate facts belong in this documentation.

## Owner review interface (step 5, schema 0006)

Open **03 / IDENTITY** in the unlocked desktop. The index lists the original draft entries and
shows unreviewed, approved, rejected, or locally edited state. Each entry includes editable fields,
its original proposal, document filename/page excerpts, and caution notes. Text and URLs are rendered
as text, never HTML or automatically opened links. Source originals and extraction data stay unchanged.

**Approve entry** saves that one corrected entry to the active candidate profile. Other profile
fields, preferences, and entries are preserved. Existing entries with the same stable UUID are updated;
new entries are appended. Profile validation still enforces bounds, unique identities, and consistent
dates/completion. Approval records the owner's assertion; it does not verify a credential, degree,
claim, or proficiency. The profile remains labeled `user_provided`. An approved entry can be corrected
and saved again. **Reject entry** records exclusion without adding or deleting active profile data.
Rejected entries can subsequently be approved. Deleting an already approved profile entry is outside
this review screen; its reject button is disabled to avoid disguising deletion as a review decision.

`profile_review_get` returns a consistent read of the profile, immutable draft, draft hash, and latest
review decisions. `profile_review_save` requires both review/profile revisions and the original draft
hash. It accepts exactly one known target and, for approval, a `CandidateData` containing only that
entry or scalar. It rejects unrelated edits, changed IDs, missing data, unknown targets, and stale
versions. Profile changes and the decision ledger commit together under the workspace writer lock.
The native unlocked-session guard covers both operations; no new network endpoint is added.

The UI never approves on load. Reload after a conflict to compare the latest saved profile value;
local corrections are retained, and resubmission requires another explicit action. Navigation between
entries/modules retains unsaved corrections in memory; locking or closing clears them. Pending saves
disable duplicate actions. A lost save response may mean the transaction committed; reload to inspect
the decision before retrying. No automatic replay overwrites a newer revision.

`profile_review` stores the latest decision and timestamp for each target, plus a revision. It is not
an append-only audit history. The draft's original `unreviewed` label describes that immutable artifact;
current progress comes from this separate ledger. Correction values live in the active profile, linked
by the same entry IDs. Later manual profile edits remain user assertions and do not re-verify sources.
Full approval history, profile entry deletion, and richer profile editing are later work.
Document version history is now available; citations retain their exact original version and the
review UI warns when a newer one exists. See [DOCUMENTS.md](DOCUMENTS.md). New encrypted backups include this ledger; older snapshots predate subsequent owner decisions.

Schema `0006` creates the empty ledger using the existing checked migration-recovery mechanism.
Verification/restoration accepts older `0002` through `0005` snapshots without upgrading their bytes;
explicit preparation migrates recovered workspaces. No live draft entry is approved by installation.
