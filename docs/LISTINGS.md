# Manual job-listing intake (step 14)

Status on 2026-10-05: implemented and tested in source. **Not deployed.** The installed Oracle does
not have this module until a backend release with schema `0009` is installed, the live workspace is
migrated and a matching desktop build is installed. See "Deployment" below.

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

Not yet done. It requires, in order: closing Oracle; building and installing a new backend release;
running the explicit Linux `prepare` step, which takes an integrity-checked local copy and then
migrates the live workspace to `0009`; comparing every existing table before and after; selecting
the release; installing the desktop build; reopening Oracle. After the migration the previous
backend release can no longer open the workspace, so a code rollback means restoring the
pre-migration copy. A confirmed fresh encrypted backup beforehand is strongly preferable.

## Verification

Backend: 290 Linux tests pass, 26 of them new. They cover exact retention of pasted text, immutable
original/hash/collection time across edits and archiving, idempotent and conflicting creation,
stale and missing updates, filtering and escaping, the capacity bound, rejected inputs, database
constraints, the real wire path with redacted failures, migration from `0008` with its local copy,
and snapshot round-trip. Frontend: 100 tests pass, 11 of them new, covering request shapes, strict
response validation, save-on-request, read-only display of the original as text, archive/restore,
error redaction and draft retention across modules. All test data is synthetic.

Not verified: the module in the installed app, its appearance, and the live migration.
