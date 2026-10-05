# Manual job-listing intake (step 14)

Status on 2026-10-05: implemented, tested and deployed. The live workspace is at schema `0009`.
The module has not been seen in the unlocked installed app by the coding session; see "Verification".

## What it does

Open **06 / INGRESS** in the Job OS console and choose **NEW.LISTING**. Paste a job description, or
enter a job title or company by hand. Saving stores the listing in the private Linux workspace.

- The pasted text is stored exactly as entered, with its SHA-256 and the time Oracle collected it.
  None of the three can be changed afterwards, by the interface or by an update request.
- Your own fields can be edited later: job title, company, location, link, where you found it and
  notes. Each save checks the stored revision, so a stale editor cannot overwrite a newer one.
- **Archive listing** hides a listing from the active view and **Restore listing** brings it back.
  Nothing is deleted. Deletion and retention controls are not implemented.
- The list shows active or archived listings, newest first, 50 per page, with a company/title filter.

## What it does not do

No website is contacted and no link is opened. Oracle does not parse the text, fill fields from it,
detect duplicates, rank, match against the profile or preferences, or call a model. Those are steps
15 onward. A link is stored as text and shown as text.

Pasted listings are untrusted source material. Their content is displayed as plain text, is never
interpreted as markup or instructions, and grants no permission. Nothing in a listing is treated as
a verified fact about the employer or the role.

## Limits

| Item | Limit |
| --- | --- |
| Pasted text | 50,000 characters |
| Title, company, location, source | 300 characters each, surrounding whitespace removed |
| Link | 2,000 characters, must start with `http://` or `https://`, no whitespace |
| Notes | 4,000 characters |
| Listings per workspace | 2,000, archived included |

A new listing needs pasted text, a title or a company. A listing entered by hand must keep a title
or company. Whitespace-only pasted text is treated as no pasted text.

## Storage and requests

Schema `0009` adds the `job_listings` table and changes no existing table. Database checks enforce
the origin values, that `pasted` listings have text and `manual` ones do not, the text bound, the
archive flag and a positive revision. The downgrade path refuses to run; restore a verified backup
instead of dropping collected listings.

Four operations use the existing authenticated desktop pipe: `listings_list`, `listing_get`,
`listing_create` and `listing_update`. Creation is idempotent for the same listing ID: a retry
returns the stored listing, and a retry with different text is a conflict. An update request has no
field for the original text, hash, origin or collection time. No native command or capability was
added; the existing unlocked-session guard covers these requests.

New encrypted workspace backups include listings once the workspace is at `0009`. Older snapshots
cannot contain them.

## Deployment

Deployed on 2026-10-05 on the owner's instruction, after the owner confirmed a new encrypted backup
repository (see BACKUP.md). Backend release `dd8f41728b147c3e544e4ea1e227a21fdae36c8e54327f341398867d20513c91`
was built and installed offline from hash-checked wheels, passed its synthetic install probe and
both Windows/WSL native integration tests, and is now selected. Oracle was closed, the release's
explicit Linux `prepare` step took an integrity-checked local copy
(`migration-backups/before-0009-*.sqlite3`) and migrated the workspace. Typed-row hashes of all 12
pre-existing data tables and the workspace identity marker were identical before and after; only
`alembic_version` changed and `job_listings` was added empty. Desktop
`1b579d1f5ea1c34bb08359563e269b8e71ca072295230fd460be3f1c3eca2734` was installed and reopened.

The previous backend release `bda6f25...` cannot open a `0009` workspace. A code rollback therefore
means restoring the pre-migration copy and losing later writes; prefer fixing forward. The
encrypted snapshot the owner took earlier on 2026-10-05 predates the migration, so take a new one
to protect listings and the upgraded schema.

## Normalized view (step 15)

Status on 2026-10-05: implemented and tested in source, **not deployed**. The installed app shows
step 14 only until a new backend release and matching desktop build are installed together. No
schema change or live migration is involved: nothing derived is stored.

Each listing record now carries a `normalized` object computed on request from the stored original
text and the owner's link by `app/services/listing_normalizer.py` (rules version 1):

| Field | Rule |
| --- | --- |
| `text` | The same wording in Unicode NFC with plain spaces and newlines; control, format, private-use and zero-width characters removed; runs of spaces collapsed; at most one blank line in a row |
| `suggested_title` | The first line of that text if it is at most 120 characters, otherwise empty |
| `links` | Up to 10 distinct `http(s)` links found in the text, trailing punctuation trimmed |
| `canonical_url` | The owner's link with lower-case scheme and host and without fragment, default port, embedded credentials or common tracking parameters |
| `mentioned_work_modes` | `onsite`, `hybrid`, `remote` when fixed English or Swedish terms appear |
| `mentioned_employment_types` | The step-13 employment vocabulary when fixed English or Swedish terms appear |

The list also shows a listing's first line when the owner has given no title, marked as coming from
the pasted text. In the editor, **04 / NORMALIZED VIEW** shows these observations for pasted
listings, and **Use as job title** copies the first line into the owner's title field, which still
needs an explicit save.

Boundaries: derived values are never written to the database and never change owner fields, the
original text, its hash or the collection time. They are observations about wording, not facts: a
listing that says "not remote" still mentions "remote". There is no company, salary, date or
location extraction, no language detection, no deduplication and no matching. Links are found and
shown as text; none is opened. Because the rules run at read time, a later rules version changes
what is shown for every listing, and `rules_version` says which rules produced it.

Compatibility: record and list responses gained fields, and the desktop validates responses
strictly, so the step-15 backend and desktop must be deployed together.

## Verification

Step 15 adds 19 backend tests (309 total) and 2 frontend tests (102 total), covering idempotent
text cleaning, keyword boundaries in both languages, link bounding, canonical links including
credential and tracking removal and malformed input, adversarial length, separation from stored and
owner fields, strict validation of derived data, text-only rendering and suggestion-on-request.

Backend: 290 Linux tests pass, 26 of them new. They cover exact retention of pasted text, immutable
original/hash/collection time across edits and archiving, idempotent and conflicting creation,
stale and missing updates, filtering and escaping, the capacity bound, rejected inputs, database
constraints, the real wire path with redacted failures, migration from `0008` with its local copy,
and snapshot round-trip. Frontend: 100 tests pass, 11 of them new, covering request shapes, strict
response validation, save-on-request, read-only display of the original as text, archive/restore,
error redaction and draft retention across modules. All test data is synthetic.

After deployment the installed release answered `listings_list` on the live workspace with zero
listings and still reported 23 applications and 3 documents (counts only; no record was read out).
The 33 ordinary native tests also pass. Not verified: the module's appearance and behaviour in the
unlocked installed app, which only the owner can open. No real listing was created by the session.
