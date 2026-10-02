# Oracle coding handoff

Read `AGENTS.md`, `docs/HANDOFF.md` and `docs/ORACLE_CONTEXT.md` before changing code.
For backend work also read `docs/WSL_DEVELOPMENT.md`. `docs/DEVELOPMENT.md` contains current commands;
`docs/VALIDATION.md` records what was actually verified and what remains unverified.

- Oracle is a personal Windows desktop app, with its record backend in Ubuntu WSL2. Not a website.
- Current scope ends at job preferences (step 13). Stabilization/handoff takes priority.
  Do not start job ingestion or other roadmap features without the owner's next instruction.
- Preserve the black/green console and circular opening seal. Do not redesign them unasked.
- Develop/test Python in `~/projects/oracle` under Ubuntu with `.venv/bin/python`.
  Build/test Tauri on Windows in `C:\Personal projects\Job-os`.
- Inspect both Git working trees before changes or transfers. Preserve unrelated/uncommitted work;
  never reset either checkout or blindly synchronize directories. Use reviewed commits/content checks.
- Source changes are not live until installed releases are built, checked and selected. Follow
  `docs/RUNTIME_RELEASES.md`; never point production back to an editable development environment.
- Active SQLite is private Linux data, never a Windows shared-path connection. Windows credentials
  stay on Windows. Never remove runtime markers, reactivate the old Windows rollback database,
  silently create a missing workspace, or replace newer records with an old snapshot.
- GitHub is public. Use synthetic tests. Do not read personal records just to learn the architecture,
  upload documents to an AI provider, log secrets, or commit local files/credentials/backups.
- Keep `docs/PROJECT_CONTEXT.md` unchanged. Owner approval, source provenance and truthful uncertainty
  matter: document evidence is not verified fact, and model output never grants authority.
- The owner permits necessary update restarts without another saved-edits question.
- Prefer small reviewed changes, typed boundaries, bounded requests/retries and deterministic
  permissions. Do not add frameworks, agents, dependencies or speculative abstractions without need.
- Update `docs/WORK_LOG.md`, handoff status and relevant validation when a milestone changes.
  Record unverified outcomes honestly; never claim a visual check, backup or live connection passed
  because its automated tests passed.

First session: report the checkout/installed-release state and outstanding issues after reading the
handoff. Do not recreate the project, overwrite the existing instructions with generated defaults,
or treat this file as permission to implement the full future roadmap.
