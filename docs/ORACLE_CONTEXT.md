# Oracle — current long-term context

Owner's context update, 2026-09-25. Read this alongside the original
[Job OS plan](PROJECT_CONTEXT.md), which is retained as historical context. This update takes
precedence where the long-term scope or deployment direction differs. It records intentions and
constraints, not implemented capabilities or permission to build the whole roadmap.

For now, do not undertake large changes, refactors, installations, migrations, or implementations
without a subsequent explicit request. Inspect existing code and documentation before proposing
changes. Preserve existing work and keep the application runnable and understandable at each stage.

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
