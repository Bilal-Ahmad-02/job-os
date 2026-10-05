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

Status on 2026-10-05: implemented, tested and deployed on the owner's instruction as backend
`b033929bb789bec11303a2e4d632a1c1b3a4fffe0c6b67be645d9e4071ea7946` and desktop
`e53b70cb903ee48ee3cef13dacd28547a0edb4554bc77444fede04d237e27d84`. No schema change or live
migration was involved: nothing derived is stored. Not seen in the unlocked app by the session.

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

## Possible duplicates and closed roles (step 16)

Status on 2026-10-05: implemented, tested and deployed on the owner's instruction. The live
workspace is at schema `0010`; see "Deploying step 16" below. Not seen in the unlocked app by the
coding session.

What it does:

- When a listing is opened or saved, Oracle lists up to 10 other stored listings that fixed rules
  flag as possibly the same role, each with its reasons, collection time and whether you archived
  it or marked it closed. Identical-text matches come first, then newest first.
- Reasons: **identical text** (same cleaned text ignoring letter case and spacing), **same link**
  (same canonical link, so tracking parameters and fragments do not hide a match) and **same title
  and company** (your own fields compared without case, punctuation or a trailing legal suffix
  such as AB, Inc or Ltd; both must be filled in on both listings).
- A match without identical text may be an updated posting of the same role; the two texts are
  both kept so you can compare them.
- The index marks listings that share any of those keys with another listing, in either the active
  or archived view, so a role you already reviewed and archived is recognized when pasted again.
- **Mark role closed** / **Reopen role** records your own statement that a role is no longer open.

What it never does: merge, hide, archive, close, delete or re-rank a listing by itself, block you
from saving a duplicate, or decide that two listings are the same. Oracle cannot know that a role
has closed because it contacts no website; only you set that flag. There is no fuzzy or semantic
similarity, and paste-only listings without your title and company match on text or link only.

Storage: schema `0010` adds three columns to `job_listings` and changes no other table. `text_key`
is a SHA-256 of the cleaned, case-folded text, derived from the unchanged original, with
`keys_version` recording the rule version that produced it; keys from another version are ignored
rather than trusted. `closed` is the owner flag. The migration backfills keys for existing
listings from their stored originals and alters nothing else in them. Link and title/company keys
are computed at read time and not stored. `listing_update` now requires `closed`, and records and
pages gained fields, so backend and desktop must be deployed together.

### Deploying step 16

Done on 2026-10-05. Backend release `79a4fd8ca8bdabcd59e8a48473ed9e3873a2a709b48167656ca3ba9b7a19a04a`
passed its offline install probe and both Windows/WSL native integration tests and is selected.
With Oracle closed, the release's explicit Linux `prepare` took the integrity-checked local copy
(`migration-backups/before-0010-*.sqlite3`) and migrated the workspace. Of 14 tables, only
`alembic_version` and the `job_listings` definition changed; the other 12 and the identity marker
were identical by typed-row hash. The workspace held no listings, so there was nothing to
backfill. Desktop `2abb755640b9d6952b9983aab93d04f61cd2737eb39e2d744e7fd0e6c85f7ca7` was installed and
reopened. The step-15 backend can no longer open the workspace. The active backup repository still
held a single snapshot from before the `0009` migration, so no encrypted backup covers the current
schema.

## Review workflow (step 19)

Status on 2026-10-05: implemented and tested in source, **not deployed**. It needs schema `0011`,
so deployment includes a live migration. Steps 17 (matching) and 18 (explanations) were skipped
for now at the owner's request: the confirmed profile and preferences are still empty, so there is
nothing to match against. This step does not read the profile.

What it adds in **06 / INGRESS**:

- Four views. **Incoming** holds listings not yet shortlisted, dismissed or tracked. **Shortlist**
  holds ones you marked. **Tracked** holds ones you started an application from. **Dismissed**
  holds ones you dismissed. Every listing is in exactly one view.
- **Add to shortlist** / **Remove from shortlist**, and **Dismiss listing** / **Restore listing**.
  Dismissal is the step-14 archive flag under a clearer name; nothing is deleted.
- **Start application** creates one dossier in **01 / ACQ** with status Saved, filled from the
  listing: your title (or the first line of the pasted text, stated in the dossier's notes),
  company, link, source and the cleaned text as the description, shortened to 10,000 characters
  with a note if it is longer. The listing keeps its full original and is linked to the dossier.
  It can be done once per listing; a retry returns the same link. Press REFRESH in ACQ to see it.
- **Saved searches**: name the current view and text filter, re-apply it with one click, remove
  it with the cross. Up to 20. A saved search stores no results and never runs by itself.

What it never does: move, shortlist, dismiss or track a listing by itself; contact an employer or
any website; submit anything. "Start application" only creates a local tracker record. The link
from a listing to its dossier is one-way and permanent in this version: the dossier does not yet
show which listing it came from, and there is no "unlink". Removing a saved search removes the
named filter only.

Storage: schema `0011` adds `shortlisted` and a nullable `application_id` (foreign key to
`applications`, unique when set) to `job_listings`, and a `listing_searches` table. Existing
listings start as not shortlisted and untracked, in the view their archive flag implies.
`listings_list` now takes `view` instead of `archived`, `listing_update` requires `shortlisted`,
and `listing_track`, `listing_searches_list`, `listing_search_save` and `listing_search_delete`
are new operations on the existing authenticated pipe. Backend and desktop must be deployed
together. The step-16 backend cannot open a `0011` workspace.

## Verification

Step 19 brings the backend to 333 tests (15 more, net) and the frontend to 108 (4 more): one view per listing,
a single linked dossier with idempotent retry, stated title provenance and bounded description,
refusal of unnamed, stale, missing and colliding tracking requests with no partial dossier, saved
search bounds, idempotency and removal without touching listings, rejected inputs, real migrations
from `0009` and `0010` built by running only the earlier migrations, strict validation of the new
response fields, and request-only shortlist, tracking and saved-search actions in the interface.
The 33 ordinary native tests pass.

Step 16 adds 9 backend tests (318 total) and 2 frontend tests (104 total): key normalization,
two-way flags with nothing merged, link and title/company reasons kept distinct from identical
text, no flags for unrelated or incomplete listings, recognition of archived and closed listings,
match changes after owner edits without touching the other listing, the 10-match bound and
ordering, ignored keys from another rule version, migration from `0009` with backfill and its local
copy, strict validation of match data, open-on-request and close-on-request in the interface. The
33 ordinary native tests pass with the new migration chain.

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
