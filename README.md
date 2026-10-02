# Oracle

Oracle is a personal desktop workspace for managing a job search. Job OS is its first module;
the longer-term goal is a permission-controlled personal AI assistant. It is a Windows
Tauri/React app with a Python backend running in Ubuntu WSL2, not a hosted website.

## Open the installed app

Use **Oracle** in Start, on the desktop or on the taskbar. The installed executable launches its
pinned Linux worker automatically. No development terminal or HTTP server is required.
The circular opening seal supports an owner-enrolled rotation sequence, with password recovery.

The system panel's HTTP diagnostic is optional and runs only when requested. It does not determine
whether the private record runtime is working.

## Implemented scope

- **01 / ACQ:** local application history, search, add/edit, and preserved spreadsheet provenance.
- **02 / VAULT:** immutable PDF originals, explicit versions and source metadata.
- **03 / IDENTITY:** editable profile, source-cited draft review, explicit approvals and job preferences.
- **04 / TASKS:** bounded local text extraction, progress, cancellation and explicit recovery/retries.
- **05 / CONTROL:** native Windows API-key entry, protected credential storage and explicit connection tests.
- Versioned runtime installation, workspace identity/migrations and manually triggered encrypted backups.

Job ingestion, job matching, AI generation, chat, autonomous actions, scheduling, voice and model
training remain future work. Provider setup alone does not enable AI or authorize sharing records.

## Start here when taking over development

Read [AGENTS.md](AGENTS.md), [the handoff](docs/HANDOFF.md) and
[the current project context](docs/ORACLE_CONTEXT.md). [CLAUDE.md](CLAUDE.md) provides a concise
Claude entry point; [the starter prompt](docs/CLAUDE_START_PROMPT.txt) can be pasted into a new session.

| Guide | Purpose |
| --- | --- |
| [Development](docs/DEVELOPMENT.md) | Windows/WSL ownership, clean setup and checks |
| [Installed releases](docs/RUNTIME_RELEASES.md) | Build, install, select and recover an update |
| [Validation](docs/VALIDATION.md) | Actual check results and remaining verification limits |
| [Security review](docs/SECURITY_REVIEW.md) | Boundaries and dependency advisories |
| [Work log](docs/WORK_LOG.md) | Dated development history and decisions |
| [Roadmap](docs/ROADMAP.md) | Implemented scope and deferred steps |
| [Backup and recovery](docs/BACKUP.md) | Encrypted private-data protection, separate from Git |
| [Desktop](docs/DESKTOP.md) | UI behavior, locking and native security |
| [Profile](docs/PROFILE.md) | Evidence review and search preferences |

## Source and private data

This GitHub repository is public. It contains source, tests, lockfiles, assets and sanitized
documentation only. Databases, CVs, extracted text, passwords, API keys, local models and backups
do not belong here. The Windows credentials and active Linux workspace are separate from the source.

Normal use depends on Windows/WebView2 and Ubuntu WSL2 with its system Python. It does not depend on
a Codex subscription. Changing coding assistants does not require moving the database or replacing
the runtime. See the handoff before making environment or recovery changes.

The [original Job OS plan](docs/PROJECT_CONTEXT.md) is preserved as historical context; it describes
intentions and must not be read as a claim that future features already exist.
