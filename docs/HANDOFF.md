# Oracle handoff — October 2, 2026

## Current instruction

The owner paused the feature roadmap after step 13 to stabilize existing work and transfer coding
to Claude. Preserve the app and data. Resume new features only when requested. The next deferred
feature is manual job ingestion, not general agents, chat, scraping or model training.

Read in order: AGENTS.md, this file, ORACLE_CONTEXT.md, DEVELOPMENT.md, VALIDATION.md and
SECURITY_REVIEW.md. Consult feature documents as needed. PROJECT_CONTEXT.md is immutable historical
intent; newer instructions/context take precedence. WORK_LOG.md is a reconstructed dated history.

## Product and implemented behavior

Oracle is a private, single-owner Windows desktop app. Job OS is the initial job/application module
inside an eventual personal AI system. The visual direction is black/near-black and green, a dense
personal console with a circular emblem/rotation opening seal. Keep useful labels, keyboard access,
visible state and truthful capability claims. Do not replace it with a generic website or dashboard.

Since 2026-10-05 unlock opens a hub ("the chamber") whose only real node opens the Job OS console;
its Oracle core is labelled dormant because no assistant exists. See DESKTOP.md.

Step 14 manual listing intake (schema `0009`, **06 / INGRESS**) was implemented and deployed on
2026-10-05, followed the same day by step 15 read-time normalization and step 16 duplicate flags
(schema `0010`); see LISTINGS.md. The roadmap
is resumed one scoped step at a time.

Implemented: application tracking and import provenance; immutable source PDFs and explicit version
families; bounded local page-text extraction; an assisted-import semantic draft with citations;
owner approval/rejection; an editable confirmed profile and job preferences; cooperative extraction
tasks; manual encrypted backups/restores; Windows credential storage for a key-only OpenAI test;
installed desktop/backend releases. The semantic draft was prepared with coding-session assistance,
not an autonomous semantic-extraction feature. No live AI provider integration generates text yet.

## Architecture and boundaries

```text
Windows Tauri/React UI
  -> native unlocked-session and capability checks
  -> typed operation over bounded Windows/WSL pipes
  -> Ubuntu guardian + worker
  -> validated operation dispatcher -> services -> SQLite transactions

Explicit provider test -> native Windows credential vault + fixed HTTPS endpoint
Manual backup -> Linux restic -> encrypted files in OneDrive
```

The renderer gets no general shell/filesystem/network capability. Native commands enforce access
independently of UI state. Database requests do not use HTTP. Workspace identity, no-create opens,
reviewed migrations, optimistic revisions and redacted error codes protect record operations.
PDF parsing runs in bounded subprocesses. Unknown write outcomes require reconciliation; do not
automatically replay them. Model output and external content never authorize actions.

The lock is an application gate, not encryption of the active database or protection from malware
running as the same OS account. Provider credentials use Windows account protection. Review the
documented threat boundary before expanding capabilities; do not claim hardened system isolation.

## This machine

| Item | Location |
| --- | --- |
| Windows source/build checkout | `C:\Personal projects\Job-os` |
| Linux source/tests | Ubuntu, `/home/lethargic/projects/oracle` |
| Active database | `/home/lethargic/.local/share/oracle/oracle.sqlite3` |
| Matching identity | Same directory, `oracle.workspace-id` |
| Backend installation | `~/.local/share/oracle/runtime/releases/<digest>/.venv` |
| Windows installation | `%LOCALAPPDATA%\Programs\Oracle\releases\<digest>` |
| Native configuration/hashes | `%LOCALAPPDATA%\local.oracle.desktop` |
| Provider key | Windows Credential Manager, `Oracle.Provider.OpenAI.v1` |
| Encrypted backup repository | Owner's OneDrive `OracleBackups-2026-10` folder; the older `OracleBackups` is retained but unreadable (password lost) |

Selected backend since 2026-10-05: `79a4fd8ca8bdabcd59e8a48473ed9e3873a2a709b48167656ca3ba9b7a19a04a`
(previously `bda6f25fbb0f4fdf1efa25b47ebeb0f16b29de16930d6c0086276c1844ef6f25`, which cannot open
the current schema). The desktop digest is recorded in VALIDATION.md. Schema is `0010`; profile JSON
includes step-13 exclusions. An older backend can reject that JSON despite sharing the database schema.
Do not downgrade code or data without checking compatibility and preserving subsequent writes.

`runtime.json` version 2 selects the installed Linux release. `runtime-wsl.selected` records the
inactive Windows rollback folder. Never delete these markers to force fallback. That old database
is not a second live workspace. Credentials must not be copied into Linux or committed.

## Git and continuity

Repository: https://github.com/Bilal-Ahmad-02/job-os (public). A source checkpoint through step 13
was pushed as `f031b314293270ee1405e98f08557d454fae3971`; later stabilization commits follow it.
Use tag `oracle-handoff-2026-10-02` and VALIDATION.md to identify the source/release handoff and its
remaining manual checks. Do not assume an installed binary corresponds to uncommitted source.

Linux was aligned to that checkpoint only after all 208 source files were checked. Its previous
uncommitted state remains in stash `1a7508fbadc3a488bd39cd1fc1ce30199ebfdd91` as a recovery copy.
Do not apply/drop it blindly: the checkpoint already contains its reviewed changes. The local
`stepbystep.txt` note is retained untouched; ROADMAP.md preserves its planned sequence.

GitHub does not contain private records or credentials. A Git clone cannot restore those. Use
BACKUP.md for encrypted staged recovery; passwords are entered locally and never sent to an agent.
See VALIDATION.md for the distinction between owner-reported cloud sync and verified local recovery.

## Continuing in Claude

Open the existing repository in Claude Code, preferably the Linux checkout for Python work, and
paste CLAUDE_START_PROMPT.txt. Windows build commands still need Windows tools; using Claude does
not change ownership or require a data migration. A Claude chat without filesystem/terminal access
can read the handoff but cannot directly validate or update the application.

Begin with Git status and the current runtime selection, without exposing credentials or reading
personal records. Use the current test/build commands, preserve unrelated work, and report any
discrepancy before editing. Keep the roadmap paused while a release-blocking defect is unresolved.
Any later feature should be scoped, tested with synthetic data and deployed explicitly.

## Known limitations to carry forward

- No automated job ingestion/matching, inference, chat, agents, scheduling or training yet.
- Manual backups; no app backup dashboard or independently automated cloud-upload confirmation.
- Managed machine-local installation; no signed new-machine installer/updater. Recovery on a
  replacement PC still requires reviewed provisioning and credential setup, not just cloning Git.
- Rotation enrollment has password recovery but no in-app rotation/password-change workflow.
- No unattended task daemon; extraction advances while the unlocked app drives it, with bounded
  retries and 100 retained tasks. Cancellation takes effect after the current document.
- No claim of an end-to-end visual/native-dialog pass or live API-key test unless VALIDATION.md
  explicitly records one. Automated tests and a responsive window are narrower evidence.
- Upstream Rust maintenance advisories and a build-tool advisory remain documented in SECURITY_REVIEW.md.
