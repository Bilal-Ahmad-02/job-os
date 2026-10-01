# Local extraction tasks

Open **04 / TASKS**, expand **New source-text extraction task**, select stored source versions,
and choose **Start extraction**. Oracle extracts readable PDF text locally. Original files,
profile entries, review decisions and semantic drafts are preserved. Existing extracted text is
reused after checking its source hash. Scans without readable text fail explicitly; OCR is not
implemented. Creating a task does not approve document claims.

## Execution and cancellation

The unlocked desktop drives a durable task one document at a time through the existing authenticated
IPC boundary. Switching modules keeps that driver mounted. This is cooperative execution while
Oracle is open, not an unattended service or scheduler. Native record operations and locking can
wait for the current document because the authorization gate stays held until that request finishes.

**Cancel after current document** stops the remainder after the current result is confirmed. A
completed final document wins a concurrent cancellation request. Previously extracted text stays
stored. Locking/unmounting stops the next step; closing also activates existing native/WSL process
cleanup. The parser has an eight-second extraction deadline inside the existing 15-second Linux
worker deadline. Windows startup and transport cleanup have their own bounded allowance.

Progress counts confirmed documents, not estimated elapsed time. At most one task parser is admitted
per workspace. Each transition checks the saved task version, and creation is idempotent for the
same task ID and ordered document IDs. No paths, executables or arbitrary job types are accepted.

## Interruption and recovery

Nothing automatically resumes on startup, unlock or refresh. Use **Resume task** for queued work,
or **Retry remaining documents** for failed, cancelled or interrupted work. A retry preserves
confirmed progress and consumes one of three total attempts. An uncertain response disables further
task mutations until a successful explicit refresh; a native transport failure requires reopening
Oracle as well. A missing response does not prove the extraction did not commit.

A running claim has a 120-second lease, longer than normal worker/transport cleanup. If its worker
dies before journaling the result, wait for lease expiry and refresh. Oracle marks it interrupted;
retry remains explicit. Reprocessing after a crash between extraction commit and task checkpoint
reuses the immutable source's existing text. Host suspension or clock changes can affect lease
recovery; this is not an exactly-once execution guarantee.

Each task accepts 1–100 unique stored document IDs; at most 100 tasks are retained. History deletion
and retention controls are not implemented, so reaching that cap prevents creating more tasks.
Errors use fixed public codes, excluding parser exception text, document contents and paths.

## Storage and backups

Schema `0008` adds `background_tasks` to the Linux-owned SQLite workspace. Explicit preparation
makes an integrity-checked private migration snapshot before upgrading. Existing records and
original PDF bytes are unchanged. Local recovery copies are not an off-device backup.

New encrypted workspace backups include task state and extracted text. Synthetic tests cover
encrypted restoration of task/source associations and resuming from a consistent progress snapshot.
Older snapshots cannot contain later tasks. Backup scheduling and OneDrive upload confirmation
remain separate work; this feature does not create a cloud backup automatically.

## Verification

Backend regressions exercise progress, idempotency, concurrency exclusion, stale revisions, bounded
retries, redaction, crash-after-commit recovery, source validation and migration. Frontend tests
cover explicit resume, progress, cancellation, unmounting, uncertain responses, failed reconciliation
and strict response validation. All test data is synthetic.
