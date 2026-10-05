# Oracle work log

Historical entries below are reconstructed from Git commits, dated implementation checkpoints and
the available conversation. They are not a complete activity transcript or a timesheet. Dates identify
the recorded milestone, not proof that every related edit happened that day. No private record data,
passwords or document text is included. Continue with concise dated entries and concrete validation.

| Date | Recorded work and decisions | Evidence / qualification |
| --- | --- | --- |
| 2026-09-23 | Job OS repository, initial context, structure and ignore rules | Commit `533ed9d`; original plan remains in PROJECT_CONTEXT.md |
| 2026-09-24 | Oracle desktop foundation, native password gate, constrained loopback health service | Commit `4f5174f`; DESKTOP.md security/dependency notes |
| 2026-09-25 | Expanded Oracle vision: job module first, later bounded personal AI, deterministic permissions, Windows/WSL separation | Dated owner context update in ORACLE_CONTEXT.md; planned capabilities, not implementations |
| 2026-09-27 | Tracking/import provenance, workspace identity and recovery, PDF originals, encrypted backup/staged restore | Commit `c11d3ed`; schema through `0003`; checkpoint records preservation of existing data |
| 2026-09-28 | Dark personal console cleanup; separate UI components; profile data foundation | Context records step 3/schema `0004`, 34 frontend tests at cleanup; restarts authorized without repeated saved-edits questions |
| 2026-09-29 | PDF text extraction and assisted semantic draft, owner review, document versions; Linux development started | Steps 4-6, schemas `0005`-`0007`; tests grew from 126 to 153 Linux tests; draft is not autonomous AI extraction |
| 2026-09-30 | WSL production cutover and verified restore; worker lifecycle/host-disconnect correction; circular rotation seal with password recovery | Cutover checkpoint: 177 Linux tests, native integration/fault/recovery checks; Windows remains the desktop OS |
| 2026-10-01 | Profile editor/preferences; typed operation routing; cooperative extraction tasks; independently installed runtimes; provider vault/manual test; structured exclusions | Steps 7-13 (step 10 cutover already done), schema `0008`; last feature validation 264 Linux/82 frontend tests plus native integration; backend release `bda6f25...` |
| 2026-10-01 | Owner paused roadmap for stabilization and Claude handoff before subscription expiry; source/privacy review and GitHub checkpoint | Public repository confirmed; 208-file checkpoint pushed as `f031b31`; Linux source checked and aligned with a retained recovery stash |
| 2026-10-01 to 2026-10-02 | Optional HTTP diagnostic made manual and removed as a global app-connectivity indicator | Frontend checks and 83 tests passed; no record/backend contract change |
| 2026-10-02 | Current setup/handoff guides, Claude prompt, advisory review, fresh-checkout verification and release preparation | See VALIDATION.md for final results, backup evidence and limits; do not infer completion from this log alone |
| 2026-10-02 | Fresh Windows clone exposed missing line-ending policy: automatic CRLF conversion broke formatter checks | Added `.gitattributes` for LF source, CRLF PowerShell scripts and binary image assets; repeat fresh-checkout verification |
| 2026-10-05 | Unlock now opens a hub, "the chamber": dormant Oracle master core, one real JOB.OS node that opens the unchanged console, three unnamed empty slots; console header gained a Chamber return control | Desktop frontend only; 89 frontend tests, TypeScript/Biome and Windows production build passed; desktop release `1884702b...` installed and reopened. Unlocked look in the installed app not visually verified; see VALIDATION.md |

Fresh-checkout checks passed: 264 Linux tests in a new virtualenv, 83 frontend tests and a Windows
frontend production build after the line-ending correction. The final Windows executable was
installed and reopened; its digest and current runtime are in VALIDATION.md. Existing native tests,
fault probes and synthetic cross-platform recovery passed. No backend code/data migration was made.

The initial handoff backup report could not be corroborated: its terminal used the installed record
environment without the separately provisioned restic tool. The corrected terminal uses the tested
Linux maintenance environment. Fresh backup receipt/cloud confirmation are tracked in VALIDATION.md.

## Decisions to preserve

- Oracle remains a desktop application, with a Windows shell and a Linux-owned database/runtime.
- Preserve private originals and provenance. Owner approval is explicit and is not external verification.
- GitHub carries reviewed source only. Private data uses encrypted OneDrive backups; credentials have
  separate recovery. A source push cannot establish private-data recovery or cloud-sync completion.
- Do not replace the existing app or data to simplify assistant migration. Claude should read the
  repository instructions and continue from the recorded state.
- Current work is stabilization. Manual job ingestion is the next deferred feature when authorized.
