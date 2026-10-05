# Oracle — current long-term context

Owner instruction, 2026-10-05: the roadmap is resumed ("focus on finishing the 40 steps"). The
earlier pause notes below are historical. Work proceeds one scoped step at a time; later steps are
still not authorized in bulk, and frontend redesign beyond the chamber hub is deferred.

Source checkpoint, 2026-10-05: step 15 normalizes pasted listings at read time with fixed rules
(cleaned text, first-line title suggestion, links, canonical link, mentioned work modes and
employment types). Nothing derived is stored, owner fields are never changed automatically, and
there is no schema change, network access or model. It is committed locally and **not deployed**;
backend and desktop must ship together. Deduplication (step 16) is next. See LISTINGS.md.

Implementation checkpoint, 2026-10-05: step 14's manual intake is implemented and deployed. Schema `0009` adds `job_listings`; pasted text, its hash and collection time are
write-once, owner fields and an archive flag are editable with revision checks, and creation is
idempotent. Four pipe operations and a **06 / INGRESS** console module were added; no native
command, dependency, network access, parsing, matching or model call. 290 Linux and 100 frontend
tests pass. Backend release `dd8f41728b147c3e544e4ea1e227a21fdae36c8e54327f341398867d20513c91` is selected and
the live workspace is at `0009`; all pre-existing tables and the identity marker were identical
across the migration. Desktop `1b579d1f5ea1c34bb08359563e269b8e71ca072295230fd460be3f1c3eca2734`. The unlocked
module was not visually inspected and no listing was created by the session. See LISTINGS.md.
External listing sources, normalization and deduplication (steps 14b-16) are next.

Owner priority, 2026-10-01 / handoff work 2026-10-02: pause new roadmap features after step 13.
Stabilize the implemented scope, preserve source on GitHub, verify recovery, and prepare a Claude
handoff before the owner's Codex subscription ends. This supersedes earlier "next step" directions
until the owner explicitly resumes feature work. Read HANDOFF.md, DEVELOPMENT.md, VALIDATION.md,
SECURITY_REVIEW.md and WORK_LOG.md for the current state; CLAUDE_START_PROMPT.txt is the starter prompt.

The 208-file source checkpoint was reviewed for private artifacts/token patterns and pushed as
`f031b314293270ee1405e98f08557d454fae3971`. The repository is public. Linux was aligned to that
reviewed commit with its former uncommitted work retained in a recovery stash. Private records,
originals, passwords and API keys remain outside Git. No model generation or new feature was added.

Stabilization corrects a misleading system indicator: the optional HTTP diagnostic now runs only
on explicit request and cannot label the whole app disconnected. Record operations remain over
the installed Linux pipe runtime. Current setup instructions replace historical Windows-first
launch directions. The selected backend remains the step-13 release below; final desktop digest,
test evidence, advisory applicability and backup verification are recorded in VALIDATION.md.

Implementation checkpoint, 2026-10-01: step 13 completes owner-entered search preferences in
**03 / IDENTITY > Saved profile > Job preferences**. Target roles, locations, work arrangements
and employment types are joined by explicit employer and listing-phrase exclusion lists. Each
text list is bounded to 20 nonempty, distinct entries of 300 characters; blank editor lines and
surrounding whitespace are removed on explicit save. Empty choices mean unspecified; multiple
choices are alternatives. Other constraints remain review notes, never inferred executable rules.
No search, job ingestion, matching, provider call or automatic profile population was added.

The existing profile transaction stores all preferences with revision/conflict protection. Updates
to existing profiles require every preference field so partial/older clients cannot erase exclusions.
Older stored JSON reads with empty new lists without rewriting notes, revisions or draft evidence;
evidence approval preserves the owner's preferences. No table migration or dependency change was
required. After saving the new JSON fields, use this or a newer compatible backend for recovery:
older runtimes reject those fields even though the database remains schema `0008`. See PROFILE.md.

Validation passed: 264 Linux tests, 82 frontend tests, TypeScript/Biome, Ruff, both native integration
tests against the newly installed runtime and the production Windows build. Synthetic coverage
includes legacy reads, bounds/duplicates, complete updates, idempotent writes, evidence preservation
and snapshots. No native source changed. All 13 live tables, original document bytes and workspace
identity were compared before/after release selection and remained identical. The installed backend
reads the actual profile and original draft successfully; no personal preference was set by the agent.

Selected backend release: `bda6f25fbb0f4fdf1efa25b47ebeb0f16b29de16930d6c0086276c1844ef6f25`.
Desktop executable SHA-256: `9cbbda6e4c18ea6bc501579f85e0633163c8786fba34141fec7cd15667da4409`.
Oracle reopened from the installed release with a responsive window; shortcuts were updated and
previous releases retained. The unlocked preference screen was not visually inspected. All 208
reviewed source files match across the development checkouts. Next is step 14: manual job ingestion
from pasted descriptions and owner-supplied listings, followed by normalization and deduplication.

Implementation checkpoint, 2026-10-01: step 12 adds **05 / CONTROL** for the first provider's
configuration, credential storage, explicit connection-test permission and manual connection checks.
OpenAI is the initial adapter from the original plan; it starts disabled with no key. Native Windows
credential entry keeps secrets out of the renderer, Linux and workspace backups. Windows Credential
Manager stores the key, revision and permission together. Replacement/removal revokes the permission;
revision checks and a cross-instance lease prevent stale settings writes. Every action requires the
unlocked native session. Finish/cancel the modal key dialog before locking; a running test can delay
locking by its bounded request deadline. See PROVIDER_SETTINGS.md for scope and recovery.

Saving a key never contacts OpenAI. An explicitly permitted, manually requested test sends only the
key and ordinary network metadata to the fixed HTTPS model-list endpoint. TLS validation, no redirects,
no proxies/retries, bounded deadlines/response size and redacted errors constrain the adapter.
No inference, model selection, private-record access, automatic check or live provider connection was
enabled during implementation. Credential Manager uses the Windows account boundary, not app-exclusive
storage. Provider keys need separate recovery and are not included in encrypted workspace snapshots.

Validation: 80 frontend tests, 33 ordinary native tests, both installed-runtime native integration
tests, TypeScript/Biome, Clippy with warnings denied and the production build passed. Credential tests
use unique synthetic Windows vault targets with cleanup; no real key was read or external request
made. Native dialog presentation and a live account's connection result remain unverified. All 447
preexisting Cargo package versions/checksums were retained; 14 TLS-related lock entries were added.
The Linux backend, schema, active records and selected backend release were not changed by this step.

Installed desktop SHA-256: `a3cee02d7b68e52cb17cc1b51b29b6272a11b7c3357afea814d782e079910851`.
The installed app reopened with a responsive Oracle window; its existing shortcuts select this release.
The backend remains `6d8ade8e9b301a986a5029df6f24530875133eefb51fa06df20c9d16866b4bee`.
The reviewed source handoff covers 207 files. The next original-plan milestone is step 13: refine
job-search preferences into criteria ready for ingestion and matching, building on the existing
profile editor. Job-source ingestion follows; model execution and broader permissions remain later.

Implementation checkpoint, 2026-10-01: step 11 installs independent desktop/backend releases;
step 10's Linux runtime ownership was already completed. Normal Oracle launch now uses Windows
`%LOCALAPPDATA%\Programs\Oracle\releases\<exe-sha256>` and a freshly installed, non-editable Linux
environment under `~/.local/share/oracle/runtime/releases/<release-id>/.venv`. Neither development
checkout nor its virtual environment is needed for normal use. Ubuntu WSL2, its Python 3.12 system
installation and WebView2 remain prerequisites. This is a managed local installation, not a signed
new-machine installer, updater or fully portable Python distribution. See RUNTIME_RELEASES.md.

Selected backend release: `6d8ade8e9b301a986a5029df6f24530875133eefb51fa06df20c9d16866b4bee`.
Desktop executable SHA-256: `449a0cbe39475903f0e7c228cdbc6388c8fc6a961e025fb688a1aeff30d6c419`.
Runtime configuration version 2 pins the exact release; missing/broken releases fail closed.
Dependency versions remain unchanged, installed offline from hash-verified wheels into a new
environment. The release retains its install bundle; previous configurations and desktop releases
are preserved. The source builder stages only explicit code/build inputs. No new private data,
model, provider, HTTP service, schema migration or automatic update mechanism was introduced.

Validation: all 242 Linux tests, 25 ordinary native tests and both native integration tests against
the installed runtime passed. Installed-package smoke checks exercised synthetic storage, migrations,
IPC and PDF subprocess execution from outside the checkout. Ruff, Clippy and the Windows production
build passed. Existing 72 frontend tests passed at the prior milestone; no frontend source changed
in this one. All 13 live database tables, original PDF bytes and workspace identity were compared
before/after selection and remained identical. Oracle reopened from its installed location with a
responsive window, and Start/desktop/taskbar shortcuts were updated. Authentication was not bypassed;
the unlocked screen was not visually inspected. The final reviewed source handoff covers 198 files.

Future development changes are not live until a reviewed release is built, installed, tested and
selected. The next original-plan milestone is step 12: controlled configuration, provider credentials,
permissions and connection checks. AI providers are not connected yet. Scheduled backups and
separately provisioned backup maintenance tools remain outside this installed record-runtime step.

Implementation checkpoint, 2026-10-01: step 9 adds **04 / TASKS** for local source-text extraction,
with durable per-document progress, cancellation between documents, bounded explicit retries and
interruption recovery. The unlocked desktop drives cooperative steps through the existing native
gate and supervised Linux worker; this is not an unattended scheduler. Navigation preserves the
driver, lock/close stops further admission, and no task automatically resumes. Record operations
and locking can wait for the current bounded document. See TASKS.md for deadlines, recovery and
the 100-task history cap. Original evidence, confirmed profiles and semantic drafts are unchanged;
no private extraction task was created during deployment. No new dependency was installed.

Schema `0008` adds only the task journal. The live Linux migration's private recovery snapshot was
compared with the entire prior workspace; all 11 preexisting data tables, original PDF bytes and
workspace identity were preserved. The journal starts empty. Validation passed 227 Linux tests
(including encrypted task/source restoration), 72 frontend tests, type/lint checks, both native WSL
integration tests and the Windows desktop build. Oracle reopened with a responsive window; visual
inspection of the task screen was not performed. All 192 reviewed source files match between
Windows and Linux; platform-generated directories remain separate. The next original-plan item
is standalone runtime distribution (step 11), since step 10 runtime ownership/cutover is complete.
Normal launch already starts supervised Linux workers, but still depends on the development
checkout and its virtual environment. Automated backups and unattended task scheduling remain later.

Implementation checkpoint, 2026-10-01: step 8 separates typed operation routing into
`app/operations.py` from the bounded desktop pipe adapter. All current request types map explicitly
to feature services; neither it nor the application compatibility adapter defaults unknown requests
to writes. JSON ambiguity/non-finite constants are rejected before opening storage. Responses have
a transport-compatible cap, errors stay redacted, and engine cleanup is exercised on every outcome.
Existing wire version, service transactions, schema, native authentication and Linux ownership are
unchanged. No UI, live data, dependency or migration change was needed. See BACKEND_ARCHITECTURE.md.
Validation passed all 213 Linux tests, Ruff, and both synthetic Windows/WSL native
integration tests. The next original-plan milestone is step 9, background task management; it is not implemented yet.


Implementation checkpoint, 2026-10-01: step 7 (profile interface) adds Saved profile alongside
Evidence review in 03 / IDENTITY, retaining the existing visual theme and circular launcher.
Basic details and all existing profile collections can be edited, with explicit saves/removals,
stable entry IDs, complete versioned payloads and retained drafts on failures or conflicts.
Initial job preferences are editable but do not yet drive searches or matching. Manual profile
changes never rewrite documents, extracted claims or review decisions. Dirty drafts survive
navigation; locking/closing still discards unsaved edits. No database migration, inferred personal
facts, new dependency, or runtime change was introduced. Validation: 64 frontend and 31 Linux
profile/review tests passed with lint/type checks. See PROFILE.md for conflict/recovery behavior.
Continue the original plan beyond this profile-interface milestone; backend boundary improvements
should support concrete modules, with background task management still outstanding. Runtime
ownership/cutover was completed early; standalone backend distribution is not yet finished.

Frontend checkpoint, 2026-09-30: the owner authorized a circular opening seal using the existing
black/green emblem, with a personally chosen rotation sequence and the standard rectangular
workspace after unlock. The Windows launcher now uses native circular clipping; the Rust gate
supports private, confirmed 4–8-turn enrollment and hashed sequence verification. The existing
password remains a discreet recovery route. The actual sequence is chosen locally by the owner,
not by the coding agent. Linux records/runtime are unchanged. See DESKTOP.md for setup, keyboard
controls, security limits, and verification. A saved rotation key cannot yet be changed in the UI.

Owner's context update, 2026-09-25. Read this alongside the original
[Job OS plan](PROJECT_CONTEXT.md), which is retained as historical context. This update takes
precedence where the long-term scope or deployment direction differs. It records intentions and
constraints, not implemented capabilities or permission to build the whole roadmap.

For now, do not undertake large changes, refactors, installations, migrations, or implementations
without a subsequent explicit request. Inspect existing code and documentation before proposing
changes. Preserve existing work and keep the application runnable and understandable at each stage.

**Update and restart preference (2026-09-28)**

The owner explicitly authorizes necessary Oracle restarts to apply completed updates without asking
again whether edits are saved. Finish appropriate checks, apply the update, and reopen Oracle.
Unsaved in-memory drafts may be discarded by these restarts. This standing instruction concerns
Oracle update restarts; it does not authorize deleting stored records, bypassing authentication,
publishing changes, or expanding a feature request's scope.

**Identity and purpose**

Oracle is the overall personal AI system. Job OS is its first major functional module: a practical
job-search and application system, still the immediate product priority. Oracle should eventually
become a continuously available personal interface above the owner's operating system, supporting
jobs, studying, development, files, applications, workflows, and supported external services.

Windows remains the desktop operating system, handling hardware, monitors, drivers, native apps,
and games. The eventual Oracle interface may be full-screen and span multiple monitors, with a
custom black-and-green command-center appearance. It may substantially reduce the need to use the
ordinary desktop, without replacing Windows itself. Visual ambition must not dictate backend design.

Oracle is a system of models, memory, retrieval, tools, bounded agents, deterministic services,
permissions, workflows, databases, integrations, background workers, UI, and separate training work.
It is not one giant model. Models propose and reason; application code controls authority and action.

**Visual direction - owner preference**

Oracle should feel like a personal Batcave command center: predominantly black and near-black,
with deep neon-green outline icons, restrained green borders, and subtle technical grid textures.
Apply this consistently to the access screen, application workspace, forms, and native window theme.
Use readable pale text and muted secondary text; reserve brighter green for focus and emphasis.
Keep warnings and errors distinguishable, retain visible keyboard focus, and respect reduced motion.
Prefer precise, useful controls over decorative fake telemetry, perpetual animation, or claims that
unimplemented AI features are active. This direction should guide future frontend work as Oracle grows.
The existing Oracle emblem remains the app identity.

The owner's follow-up asks for a substantially more personal, dense, unfamiliar console inspired
by Blade Runner 2049 and Cyberpunk, retaining the black-and-green palette. Prefer edge-to-edge
panels, a narrow module rail, numbered dossiers, command-style search, technical labels, and
an Oracle identity display over conventional sidebar/card dashboards and welcoming marketing copy.
Current vocabulary: ACQ = job operations, DOSSIER = application record, INGRESS = source/discovery,
TRACE = imported evidence. Keep a compact protocol key. "Operator" is a placeholder display alias,
not a new account or credential. Preserve clear save/discard/recovery controls and accessible labels.
The visual language is personalization, not an access-control mechanism. Do not imply that models,
agents, monitoring, or telemetry are active before those capabilities are implemented.

Frontend checkpoint, 2026-09-28: the cleanup retains the black/green console vocabulary but replaces
the single-module rail and permanent decorative side panel with compact ACQ/VAULT navigation and an
on-demand system drawer. Applications, editor, source trace, document register, and system status have
separate components and scoped style files. Module changes preserve in-memory drafts. No profile
editor or document extraction was added in this frontend pass. See DESKTOP.md for behavior and checks.
The frontend passed all 34 tests, TypeScript/lint checks, and the production desktop build. The new
executable was applied and reopened on 2026-09-28; live visual inspection remains unverified because
the computer/browser capture tools were unavailable during the change.

**Linux development checkpoint, 2026-09-29**

The owner explicitly authorized beginning the WSL2 transition before further feature work. Ubuntu
24.04 with Python 3.12.3 now has the project at `~/projects/oracle`, preserving Git history and the
reviewed uncommitted source. Backend development/tests should use this Linux checkout from now on;
the Windows checkout remains the desktop build/runtime copy. Check for divergent edits before any
source transfer. No live private database, password, or OneDrive repository was moved. The installed
app still runs Windows Python; production runtime cutover is the next infrastructure milestone.
WSL sees the RTX 3060 Ti and 8192 MiB VRAM, but AI/GPU compute is not yet validated. A verified Linux
restic binary supports encrypted-backup tests. All 153 backend tests pass in Linux with no skips;
Linux lint and dependency checks pass. A synthetic Windows-to-WSL JSON pipe probe passed all seven
checks. Windows backup regression tests also pass. Production authentication/cancellation integration
has not been switched or certified by the probe.
See WSL_DEVELOPMENT.md for setup, source ownership, architecture decisions, and migration gates.

Native integration checkpoint, 2026-09-30: the Windows desktop now includes an inactive WSL adapter
with explicit local configuration, a pinned workspace identity, and no fallback after Linux is
selected. A new Linux supervisor bounds input/output and lifetime, cancels on parent-pipe closure,
and kills the worker process group before returning. The native authorization boundary is retained;
transport failures stop further requests until restart and never automatically replay writes.
All 166 Linux tests, 18 ordinary native tests, and two separately executed synthetic WSL/native tests
passed. The Windows production build passed. No new dependency, live data migration, credential copy,
or runtime activation occurred. Cold-start/host-crash checks and verified cross-platform recovery and
single-owner cutover remain required. Do not treat this adapter checkpoint as permission to skip
those gates or create a second live database. See WSL_DEVELOPMENT.md for precise test coverage.

**Production Linux cutover completed, 2026-09-30.** This supersedes the earlier inactive-adapter
checkpoint. The Windows desktop now invokes the Ubuntu backend; its sole active database is
`/home/lethargic/.local/share/oracle/oracle.sqlite3`. The Windows password gate and hash remain on
Windows. Fresh encrypted backup and Linux restoration succeeded. All 12 tables, original source
bytes, evidence, decisions, and workspace identity matched before and after activation: 23
applications and three documents were preserved. The real Linux pipe worker passed its checks and
Oracle was reopened. The former Windows database is a private, read-only, inactive rollback copy.
Never silently fall back or discard newer Linux writes during recovery. Cold-start and host-crash
probes passed after fixing orphan-descendant cleanup with a Linux guardian. Validation passed 177
Linux tests, 19 ordinary native tests, two explicit native/WSL tests, bidirectional encrypted recovery,
lint, and the Windows build. No AI feature, dependency installation, or cloud service was added.
See WSL_DEVELOPMENT.md for exact paths, startup markers, test coverage, and rollback constraints;
use BACKUP.md's Linux commands for the now-active workspace. OneDrive upload remains unconfirmed.

**Planned Windows and Linux arrangement**

- Windows remains the environment for normal desktop use, VS Code, Codex, ChatGPT, Gemini,
  browsers, and native applications.
- WSL2 with Ubuntu is the intended future backend/engineering environment for Python, databases,
  workers, AI/ML tooling, PyTorch/CUDA workloads, local models, and training. Docker/services may
  be used where a concrete need justifies them.
- This is not a plan to switch to a traditional Linux desktop or a VirtualBox/Kali workflow.
- Eventually keep the Linux development checkout in the Linux filesystem, for example
  `~/projects/oracle` or initially `~/projects/job-os`, rather than under `/mnt/c`.
- Continue the existing source and history. Recreate platform-specific environments when migration
  is authorized; do not discard and regenerate the project.
- This update does not install WSL, move files, change database ownership, select a transport, or
  authorize changing the current working desktop build.

The current app uses Windows Python and a Windows-local SQLite database. The previous backend
review's bundled Windows Python proposal predates this update. Re-evaluate deployment, native
Windows capabilities, communication, startup/shutdown, data paths, backup/restore, and build tooling
against the WSL2 direction before adopting that proposal. A development environment and a deployed
runtime are separate decisions; their exact arrangement remains to be designed.

**Hardware constraints supplied by the owner**

| Current development target | Specification |
| --- | --- |
| CPU | Intel Core i7-10700K, 8 cores / 16 threads |
| GPU | NVIDIA RTX 3060 Ti, 8 GB VRAM |
| RAM | 32 GB DDR4 |

Intended workloads include ordinary backend/database development, ingestion, embeddings, RAG,
smaller local models, quantized roughly 7B/8B model experiments, limited LoRA/fine-tuning, voice,
monitoring, and UI development. These are targets to benchmark, not guarantees that every model,
context length, training configuration, or combination fits this hardware.

Future hardware could include an RTX 5090-class GPU with 32 GB VRAM, 128 GB RAM, a stronger CPU,
and large NVMe storage. Keep model execution modular and resource-aware; do not make that future
workstation a prerequisite for the current application.

**Job OS scope**

The job module should eventually discover and aggregate permitted sources, normalize and deduplicate
listings, and match opportunities against education, CVs, skills, projects, experience, interests,
and preferences. Matching should handle different job titles with equivalent requirements, rank
opportunities, explain relevance using evidence, and identify missing qualifications.

It should prepare reviewed CV variants, cover letters, and application answers; retain previous
applications and outcomes; reduce duplicate effort; and gradually assist with browser/application
workflows under the owner's control. Never invent qualifications or silently submit applications.

Use supported, lawful mechanisms consistent with source terms: APIs, feeds, alerts, user-provided
links, employer career sites, approved integrations, and permitted browser assistance. Do not build
around prohibited scraping. Arbetsförmedlingen/open job data is an important early integration
candidate; validate actual access conditions when that integration is scoped.

**Models and provider independence**

Use replaceable model/provider boundaries. Possible future providers include local open-weight
models, OpenAI, Gemini, and others. DeepSeek and Qwen are examples to evaluate, not selected models.
Model choice belongs in a routing layer with explicit capabilities and resource/cost policies.

Potential roles include a tiny intent/router model, a personal conversational model, specialist
coding/embedding/reranking/vision models, and cloud frontier models for tasks exceeding local
capabilities. Core business rules should not depend directly on one vendor or model name.

Other concrete integration boundaries may include `JobSource`, `EmbeddingProvider`,
`BrowserProvider`, and `StorageProvider`. Add interfaces when needed to isolate actual dependencies;
do not create speculative abstractions for every possible future service.

**Personalization and reproducible training**

Learning has several layers: immediate preferences, structured memory, behavioural statistics,
retrievable knowledge, interaction history, explicit feedback, curated datasets, and deliberate
periodic fine-tuning/LoRA. It does not mean retraining after every interaction.

Useful examples may pair a job and Oracle draft with the owner's edits and accepted application,
or pair context/proposed actions with what the owner actually did and the outcome. Collect only
permitted data, retain provenance and model versions, and distinguish raw, cleaned, training,
validation, and test data. Retain experiment metadata and practical reproducibility. Production
runtime and experimental training remain separate. No automatic upload of private training data.

**Background operation, context, and resources**

Eventually a lightweight core service should be available continuously and start with the PC.
Large models should load when required, rather than consuming GPU resources continuously.
Startup policies and background work when the interface is closed remain future implementation work.

The core may maintain explicit context such as current activity, project/course, approved documents,
active applications/window, opened files, workflow/session timing, tasks, notifications, system
resource state, and model availability. For example, a study session could associate Linear Algebra,
a lecture PDF, Jupyter, VS Code, and elapsed time so "explain this" has an explicit context source.
Do not substitute an indiscriminate dump of desktop data into an LLM prompt for context modelling.

A future resource scheduler should prioritise interactive requests, avoid expensive AI work while
gaming, pause training under heavy GPU load, index during idle time, and support overnight work.
CPU, RAM, GPU/VRAM, model state, and task budgets should inform scheduling.

**Observation and privacy modes**

Workflow learning could recognise the tools/materials used for studying or development and offer
reusable routines such as "Start Linear Algebra study mode". Observation must be explicit,
configurable, limited to necessary data, and distinct from permission to act.

| Conceptual mode | Intended scope, subject to explicit controls |
| --- | --- |
| Standard | Approved application/window/file/process metadata, timing, and switching patterns |
| Contextual | Permitted accessibility/UI metadata, including relevant controls and text |
| Learning | Explicitly enabled detailed workflow recording; potentially screenshots/vision |
| Private | Observation disabled; no memory or learning for that session |

These modes are future concepts, not current collection permissions or default-enabled monitoring.
Oracle must not become an uncontrolled screen recorder. Never silently expand collection. Design
retention, visibility, exclusions, and the ability to stop collection when observation is scoped.

**Skills, security, and bounded authority**

Future skill areas can include jobs, study, development, and system operations. Examples include
searching/analyzing jobs, preparing applications, opening course materials, preparing Jupyter,
opening projects, running tests, starting a backend, launching apps, opening approved files,
arranging windows, and reporting system status. Tools require typed, validated inputs.

Security must account for eventual access to files, browsers, websites, email, calendars, API keys,
documents, OS tools, terminals, models, and personal data. Required principles include least privilege,
explicit component boundaries, protected secrets, tool allowlists, path/network scopes, input
validation, safe command execution, appropriate component authentication, and prompt-injection
defences. No secrets in Git, prompts, or routine logs.

The permission layer independently decides whether a requested operation is authorized. A malicious
webpage asking a model to read an SSH private key must not gain that capability. Model output and
untrusted content cannot grant permissions. Approval does not automatically make an otherwise
prohibited operation permissible.

Illustrative action risk categories:

- Low: searching jobs, reading approved data, summarizing information, drafting content.
- Medium: creating/editing documents, launching applications, changing project files, navigation.
- High: submitting applications, sending email, deletion, installation, privileged commands,
  credential disclosure, and irreversible operations.

Actual risk depends on resources, destination, scope, and consequences. Support explicit approvals
and, where the owner chooses, narrowly scoped persistent grants for known-safe workflows. Include
revocation, cancellation, timeouts, retry/rate limits, task budgets, and useful action auditing.
The LLM is never the final security authority.

Each autonomous run should have a task ID, start time, state, maximum steps/retries, timeout,
resource and model/API cost budgets, cancellation, approval checkpoints, error/completion states,
and an audit trail. Do not create unbounded or recursively expanding agents.

**Workflows, data, and auditability**

Use explicit states for important processes. One illustrative job pipeline is:

```text
Discovered -> Normalized -> Deduplicated -> Analyzed -> Matched -> Shortlisted
-> Application drafted -> Awaiting review -> Approved -> Submitted -> Tracking
```

This is a conceptual processing workflow, not a command to replace the existing application's
status field or to enforce a final state machine now. Design idempotency, crash recovery, duplicate
prevention, retry limits, and observability so a restart cannot blindly repeat a submission.

Future data may include profiles, education, skills, projects, companies/jobs/matches, CV and document
versions, applications/artifacts, approvals/preferences, memory/context, workflows/events, tool calls,
model runs, and training examples. Introduce only schema needed for an approved feature. Use reviewed
migrations, stable IDs, timestamps, versioning, source/provenance, duplicate detection, histories,
and appropriate deletion semantics.

Oracle should be able to explain recommendations and reconstruct what it did. Retain useful
structured metadata: source, timestamp, relevant record IDs, provider/model version, evidence,
tool calls, decisions, approvals, artifacts, workflow transitions, and outcomes. Do not store hidden
chain-of-thought. Auditability must remain compatible with privacy modes and minimal data collection.

**Observability and interface**

Begin with appropriate health/readiness and redacted structured diagnostics. Eventually surface
worker/scheduler status, queues, errors, task history, model availability, and CPU/RAM/GPU metrics
inside Oracle. The interface may include conversation, job intelligence, study/projects/files,
notifications, quick actions, a command palette, model/training state, dashboards, animation,
multi-monitor layouts, and voice. Keep UI presentation separate from backend use cases.

Voice could follow lightweight wake detection (for example, "Oracle launch"), activation,
speech recognition, intent/context handling, an authorized response/action, and speech synthesis.
A large model should not be necessary just to detect a wake phrase. Voice and microphone collection
are future work requiring explicit controls, not permissions granted by this context update.

**Scope discipline and immediate priorities**

The next architectural request should compare the actual repository against this vision and propose
the smallest useful, testable changes. Clearly distinguish:

| Horizon | Focus |
| --- | --- |
| Needed now | Architecture/security boundaries, conventions, clean backend foundations, tests, observability basics, preserving current functionality/data |
| Prepare boundaries as features arrive | Profile/CV, job sources, normalization/deduplication, matching, application workflows, provider independence, Windows/WSL ownership and communication |
| Deferred | Broad agents/automation, continuous observation, general PC control, sophisticated scheduling, voice, multi-monitor command center, periodic fine-tuning |

The owner's intended product progression is foundations, profile/CV, ingestion, normalization and
deduplication, matching, application workflows, then gradual AI/agents, automation, and broader Oracle
capabilities. Existing tracking remains useful and must not be discarded to match a new diagram.

The owner's conceptual architecture includes API/core/lifecycle, domain areas (jobs, applications,
profile, memory, context, automation), services, agents/tools/routing, integrations, permissions and
secrets, database repositories/migrations, workers/scheduler/events, observability, models, and schemas.
It is guidance on responsibility boundaries, not a mandate to create those directories now.

Flag choices that obstruct security, maintainability, migration, or growth. Prefer incremental
changes, typed interfaces, replaceable providers, explicit state, deterministic authorization,
idempotent processing, reproducible ML, privacy-conscious collection, and human control over
consequential actions. Avoid giant scripts and speculative enterprise frameworks alike.

**Relationship to current documentation**

Implementation checkpoint, 2026-09-29: step 6 adds explicit document revisions (schema `0007`).
The Vault groups each family's latest original with a history of earlier versions, and searches earlier
filenames too. Profile review shows citation versions and warns about newer originals. Imports use
one PDF plus `--replaces CURRENT-DOCUMENT-UUID` through local maintenance; there is no in-app picker.
Filenames never imply a relationship. Originals, extraction, citations, approvals, and profile data
remain unchanged by a new version. Retries deduplicate and concurrent/stale replacements cannot fork
history. All versions count toward storage limits and are included in new encrypted snapshots.
Document versioning does not regenerate or replace the immutable semantic draft. Richer profile editing
and job preferences are next; job-source ingestion follows. See DOCUMENTS.md for commands and limits.
The live upgrade preserved every existing row and workspace identity: 23 applications and three PDFs,
now three independent version-1 roots. No new personal document was imported. Validation passed the
151-test backend regression suite, the expanded 13-test version module (including one added CLI test),
the 16-test encrypted-backup suite with real multi-version restoration, 45 frontend tests, 16 native
tests, lint/type checks, and the desktop build. The live metadata-only worker returned all three
version-1 originals correctly. The updated executable was launched; UI visual inspection remains
unverified because the computer-use helper was unavailable in the preceding session.

Implementation checkpoint, 2026-09-29: step 5 adds the **03 / IDENTITY** review workspace and
atomic per-entry approval/rejection (schema `0006`). Owner corrections merge into the active profile
only after explicit approval; unrelated data and original evidence are preserved. Revisions and a
draft hash prevent stale writes. Rejected entries do not enter the profile, and approval never claims
external verification. Unsaved corrections survive module navigation but not lock/close. Source-backed
review is now available; the owner must make their own decisions. Document versioning and richer
profile editing remain next roadmap work. The ledger records latest decisions, not complete history.
See PROFILE.md. UI automation inspection was unavailable; behavior, type/lint, and build checks are
used for validation, with no claim of visual verification. Validation passed: 139 backend tests
(the 138-test regression suite plus the added real-worker review test), 42 frontend tests, 16 native
tests, type/lint checks, and the production desktop build. The actual private draft passed the
frontend runtime validator: 29 entries, zero decisions. The live migration preserved every existing
row and workspace identity; no profile entry was approved by this update.

Implementation checkpoint, 2026-09-29: step 4 adds bounded local PDF page extraction and a separate
unreviewed, source-cited profile draft (schema `0005`). Three private originals yielded four pages;
29 draft entries were saved without changing the confirmed profile, original records, or workspace
identity. All prior tables were compared across migration; the automatic checked recovery copy is
private. The semantic draft is explicitly `assisted_import`, prepared with coding-session assistance;
Oracle does not yet have automatic semantic extraction, an AI provider, or a review/approval screen.
The next step is reviewing, correcting, and approving entries through the frontend. Source presence
checks do not verify factual accuracy; education dates and credential interpretation need review.
Draft/page data stay in AppData, never Git. A fresh encrypted backup is needed for these additions;
cloud sync remains unconfirmed. The encrypted draft backup completed successfully at 13:27 on 2026-09-29 and passed local
restore verification; OneDrive cloud upload remains unconfirmed. Oracle was reopened with a responsive main window.
Validation: 126 backend tests, 16 native tests, and Ruff checks pass. The actual private worker
returns the unreviewed draft; all 23 applications and three originals remain intact.
See PROFILE.md for maintenance commands and limits.

Implementation checkpoint, 2026-09-28: step 3 adds typed candidate-profile storage and private
version-checked save/load operations, with migration `0004`. It starts empty; no personal facts are
inferred from the PDFs. The profile editor, document extraction, and evidence-review workflow remain
future steps. Manual profile entries are user-provided assertions, not independently verified facts.
See PROFILE.md for limits and concurrency behavior. No new dependency or AI provider was added.
The live workspace was upgraded with a checked recovery copy; all 23 applications, three original
documents, import history, and workspace identity were verified unchanged. No profile row was
populated. The existing desktop uses the updated worker without a new executable or UI change.

Implementation checkpoint, 2026-09-27: workspace identity/recovery and explicit database lifecycle are
implemented; the frontend uses the requested black-and-green operations console. Manual encrypted
backup and staged restore are implemented with restic. The first backup in the chosen OneDrive folder
passed local restoration and integrity checks; remote sync still needs confirmation. Backups are not
scheduled, and source-code commits/pushes remain separate from personal-data backups. See BACKUP.md
for commands and current limits. Typed application services, versioned desktop responses, and runtime
frontend result validation are now implemented. Schema `0003` adds immutable private PDF originals
and a metadata-only source register. Documents remain unverified source material; profile extraction
and user review are next, before matching or AI-driven applications. See DOCUMENTS.md for boundaries.
The three owner-provided PDFs were imported on 2026-09-27 with exact-byte verification. All 23
existing applications, their import history, and the workspace identity were preserved. The updated
desktop was built and reopened. A new encrypted backup is required to protect these newly imported
documents after import. That backup completed on 2026-09-27 and passed local restoration verification;
OneDrive upload remains unconfirmed. The older pre-import snapshot does not contain the documents.
Keep the WSL deployment decision and persistent-worker design separate from that refactor.

- [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md): original Job OS goals and evidence/privacy rules;
  its initial-stage description is historical and does not describe today's implemented tracker.
- [APPLICATIONS.md](APPLICATIONS.md): current tracking, import, storage, and desktop transport.
- [DESKTOP.md](DESKTOP.md): current Windows build/setup and access-control limitations.
- [BACKUP.md](BACKUP.md): current backup situation; automated backups are not implemented.
- [BACKEND_REVIEW.md](BACKEND_REVIEW.md): earlier code findings remain evidence about that reviewed
  version. Its proposed deployment and delivery order must be reconsidered against this owner update.

No new architecture has been implemented by recording this context. Future sessions must inspect
the repository rather than assume either the roadmap or older review proposals are already built.
