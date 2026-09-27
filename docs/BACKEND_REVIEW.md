# Oracle backend review — 2026-09-25

Later owner update: [ORACLE_CONTEXT.md](ORACLE_CONTEXT.md) expands the vision and plans a Windows/WSL2
split. The findings below describe the reviewed code, but the proposed deployment and delivery order
must be reassessed against that update. In particular, bundled Windows Python is not a settled target.

Implementation follow-up: workspace recovery/identity and separate startup maintenance/read/write
lifecycle have since been added; see [current behaviour](APPLICATIONS.md#workspace-lifecycle-and-recovery).
Encrypted manual snapshots and verified staged restore have also been implemented, with the first
local OneDrive-folder backup verified; see [backup status and limitations](BACKUP.md).
The findings below remain the historical review, not a claim that those fixes are still absent.

Recommendation: evolve Oracle into a modular Python application, supervised by its native desktop
shell. Keep Tauri/React, Python, SQLite, SQLAlchemy, Alembic, and the existing private-data boundary.
The immediate improvements concern workspace recovery, database lifecycle, request contracts, and
process management. Folder organization supports those changes; it cannot substitute for them.

This is a review and proposed direction, not an implemented architecture or authorization to build
the entire roadmap. `PROJECT_CONTEXT.md` remains the original project plan. No application code,
dependencies, private records, password settings, or backup configuration changed during this review.

**What was checked**

Three passes covered the current implementation and long-term plan, official/open-source designs,
and existing tests plus targeted failure/concurrency probes. Tests used synthetic temporary databases,
not the owner's application database. Online research contained no private application records.

- Python: 55 tests passed; Ruff lint and formatting passed.
- Desktop frontend: 19 tests passed; TypeScript and Biome checks passed.
- Native desktop: 15 tests passed; Clippy passed with warnings denied.
- A simulated failure on the second imported row left zero jobs, applications, batches, and source
  rows. The transaction boundary correctly rolled back the first row as well.
- Holding a read transaction through `open_store()` prevented a second connection from acquiring
  a write transaction. This follows from the unconditional `BEGIN IMMEDIATE` hook.
- A list request against an absent temporary database created it and returned success with an
  empty list. The transport has no first-run versus recovery distinction.
- Five empty-list Python subprocess requests took 650, 628, 653, 683, and 657 ms here (median 653 ms).
  This is an indicative local sample including process/import/migration/query time, excluding Tauri
  overhead, while other checks were running. It is not a formal performance benchmark.

These checks establish specific behaviour, not a comprehensive security audit. Packaged UI inspection,
power-loss simulation, a clean-machine installation, and cloud/AI integration testing were outside
this review. No AI or cloud integration currently exists to audit.

**Existing decisions worth keeping**

The renderer cannot choose an executable or database path. Native commands enforce the password
session. Application records travel through inherited process pipes; the HTTP service exposes only
liveness. User text is validated, SQL parameters are bound, imports retain provenance, and edit
versions prevent stale overwrites. Source fixtures contain synthetic data. These are useful boundaries
to preserve through refactoring.

SQLite remains a reasonable starting database for this single-owner local application. There is no
measured need for a remote database. FastAPI can remain an HTTP adapter for future integrations;
Oracle's business operations should also be callable through the private desktop transport.

**Findings, ordered by practical priority**

| Priority | Evidence in current code | Consequence | Proposed change |
| --- | --- | --- | --- |
| High, before automatic recovery/backup | `db/store.py:10` creates directories and opens/initializes any missing database; `desktop_bridge.py:25` uses it for ordinary reads. Reproduced with a temporary database. | A lost/moved database appears to be an empty workspace. This does not delete the old file, but conceals a recovery condition. | Separate explicit initialization from opening an existing workspace. Store/check workspace identity and schema state. Existing credentials with a missing database should trigger recovery, with a reviewed path for upgrading older credential-only installations. |
| Medium, before background work | `db/store.py:23` issues `BEGIN IMMEDIATE` for all transactions; line 30 runs Alembic on each connection lifecycle. Reproduced read/write contention. | Listing records reserves the single writer slot. Repeated migration checks add work and complicate concurrent maintenance. | Migrate under exclusive startup/maintenance coordination, then open ordinary sessions. Use read transactions for reads and intentional short write transactions for mutations. Preserve stale-update protection; do not simply remove the locking hook without replacing its guarantee. |
| Medium, before distribution or AI | Native `applications.rs:28` embeds the build repository path and starts `.venv` for each request; line 43 uses a 15-second response deadline. | Moving the checkout can break the executable. Long inference and scheduled work do not fit this transport lifecycle. | Introduce a managed, bundled Python sidecar with startup readiness, protocol negotiation, bounded requests, graceful shutdown, and supervised failure handling. Packaging and changing to a persistent worker should be separately testable changes. |
| Medium, before long operations | `commands.rs:94` holds the authentication mutex through the worker request. | This serializes data operations and makes lock completion wait for an operation. The UI removes records immediately, but this is unsuitable for long AI runs. | Keep the current bounded CRUD guarantee until replaced. For long tasks use short session checks, revocable operation authorization, cancellation, and a defined commit/lock boundary. Never solve this by dropping the session check around privileged work. |
| Medium, with the next backend refactor | `services/applications.py:66` combines request dispatch, SQL, mutation rules, and response dictionaries. Responses are manually mirrored in TypeScript. | Adding unrelated capabilities to this dispatcher would increase coupling and contract drift. | Give application operations explicit service functions, a small persistence boundary, and typed result/error models. Keep transport parsing and dispatch in adapters. Version the wire contract and test compatibility. |
| Medium, before support/distribution | Worker stderr is discarded, and unexpected Python failures become a generic `storage` error. | Private details stay hidden, but diagnosing migration, missing-runtime, or corrupted-data failures is difficult. | Add local bounded diagnostics containing operation IDs, error codes, timings, and component versions. Redact paths/content/secrets; preserve the generic user-facing error boundary. |

The worker's 15-second receive deadline is not a proof that every cleanup path is bounded:
`taskkill.status()`, `child.wait()`, and thread joins occur afterward. The existing timeout test passes
for an ordinary sleeping Python worker. Before a persistent backend or agent can spawn work, add
tests for failed termination, inherited pipe handles, partial replies, abnormal exits, and shutdown
while a write is in flight. Consider Windows process-tree ownership through Job Objects when designing
the native supervisor; review the implementation against Windows documentation at that milestone.

**Proposed structure**

The following is a target to introduce incrementally. Only application tracking and spreadsheet
import have real feature implementations today. Future folders are not a request to scaffold empty
frameworks now. Existing Python package name `app` and entry points can stay compatible during moves.

```text
backend/app/
  bootstrap.py                 # composition, workspace startup, shutdown
  core/                        # settings, stable errors, clock/path policies
  transports/
    desktop/                   # bounded, versioned desktop messages
    http/                      # FastAPI routes/dependencies; health initially
    cli/                       # explicit maintenance/import entry points
  features/
    applications/              # schemas, use cases, persistence operations
    imports/                   # supported source mappings and provenance
    profile/                   # later: verified skills and supporting evidence
    documents/                 # later: originals, versions and extraction
    assistant/                 # later: conversations, AI runs and reviewed proposals
    tasks/                     # later: follow-ups and durable work records
  infrastructure/
    database/                  # engine/session policies and migrations
    backups/                   # snapshots, restore validation, destination adapter
    secrets/                   # later: provider/integration credential storage
    ai/                        # later: hosted/local provider adapters
    integrations/              # later: email, calendar and other explicit connectors
  workers/                     # later: durable task execution and recovery
tests/
  unit/
  integration/
  contracts/
  recovery/
training/                      # stays separate from application runtime
```

Dependency rule: the desktop/HTTP/CLI adapters call feature services. Services implement the use
cases and use explicit database/provider/storage dependencies. Provider adapters and ORM objects
should not become the public UI contract. Extract narrow interfaces where they allow a real external
dependency to be replaced or tested; a generic repository, event bus, or service framework for every
class is unnecessary.

Keep one Python application with clear feature ownership. Separate processes are useful for the
native supervisor and eventual expensive model execution, while sharing one application codebase.
No present requirement justifies Kubernetes, a distributed microservice system, a public server,
mandatory Firebase, Redis, or a separate vector database.

**Desktop/backend communication**

Keep private desktop requests on an inherited-pipe channel for the next stage. A persistent worker
will require framing, request IDs, protocol version checks, bounded queues/messages, cancellation,
and responses associated with the correct request. A worker becoming persistent is not automatically
more secure; it requires lifecycle and session revocation tests.

Tauri should own the worker process and expose narrow commands. The renderer should not gain a
general shell capability. Python owns application use cases, data validation, persistence, migrations,
and provider orchestration. The native layer owns the Windows process lifecycle and desktop access
boundary. Both sides validate their respective trust boundaries.

If a future browser extension or other integration needs FastAPI endpoints, expose the same feature
services through an authenticated HTTP adapter. Design endpoint identity, per-session authorization,
origin validation, credential lifecycle, and port ownership together. CORS and a successful health
request are not authorization. FastAPI does not turn the product into a website; it is an internal
interface technology. The existing HTTP health response is not readiness of the private data worker.

Use one shared bootstrap policy for both transports. Engine creation, schema readiness, and worker
resources belong to startup/shutdown. When hosted in FastAPI, connect that policy to its lifespan.
Local models should load on demand rather than delaying every tracker launch.

**Boundaries for Oracle's eventual personal assistant**

1. Verified personal facts and evidence remain authoritative structured records. Chat history,
   imported documents, extracted claims, and model suggestions are distinguishable and retain origin.
   A model suggestion cannot silently become a verified skill or qualification.
2. Introduce a small provider interface with explicit capabilities: structured output, streaming,
   cancellation, usage, and embedding support where needed. Hosted and local providers may support
   different capabilities. Store the model/provider, prompt version, input record versions, and
   evidence references for each saved AI result. Keep prompts and regression evaluations versioned.
3. Start AI as read-and-propose: analyse a saved job against verified profile evidence and present
   a reviewable result. Deterministic application services validate and apply accepted changes.
4. Future tools have named capabilities, bounded parameters, allowed resource scopes, and distinct
   read/write/external-send permissions. A separate authorization check enforces policy immediately
   before action. Imported pages, email, files, or model text cannot grant permissions.
5. Consequential actions such as sending email or submitting an application require review of the
   concrete action. Lock/revocation semantics and interrupted-operation recovery must be specified.
   An LLM safety prompt is an additional layer, not the enforcement mechanism.
6. Hosted calls get only the explicitly permitted data subset. Credentials stay outside prompts,
   logs, and ordinary UI state. No automatic training upload. Local fine-tuning remains a separate,
   opt-in `training/` workflow using curated, traceable examples.
7. Retrieval indexes and embeddings are derived data with a rebuild path. Original documents and
   verified records must remain available independently of the current model or index format.

These are future design constraints, not a proposal to add agents or broad computer access now.

**Long-running work**

When reminders, extraction, or AI analysis arrive, use persistent task records with states, attempt
limits, idempotency keys, cancellation, and restart recovery. A single local worker with SQLite is a
reasonable first implementation candidate, subject to concurrency tests. Close transactions before
calling a model or external service. Save the result afterward, checking that input versions still
match. A task's output may be stale even if the model call succeeded.

Do not claim exactly-once execution for external side effects. After an interrupted send or submission,
reconcile the provider outcome before retrying. Ordinary FastAPI background callbacks alone are not
a durable task system. Work that must continue with all app windows closed needs a deliberately
designed tray/service lifecycle; that is a separate milestone.

**How this changes the upcoming backup step**

Do the minimum workspace lifecycle work first: explicit initialization, existing-database checks,
schema/version checks, and coordination for maintenance. Then implement backup/restore against that
boundary. The entire proposed folder layout and persistent-worker system need not be built before
protecting the owner's data.

Backups should start from a consistent SQLite snapshot, include a versioned manifest and checksums,
use an established authenticated encryption implementation or backup tool, and retain dated versions.
The destination and independently recoverable key arrangement are still product choices. A same-disk
copy is not protection against losing the PC. Login password hashing and backup encryption are
different responsibilities; do not invent a cryptographic file format or make recovery depend solely
on the lost Windows installation.

Restore into a staging location first. Verify integrity, supported schema, workspace identity, and
file scope before replacing an active workspace under maintenance coordination. Preserve a recovery
copy and test restoration after interruption. Future documents require a manifest consistent with
database references. Rebuildable AI caches can be excluded according to an explicit policy.

Acceptance tests for that milestone should cover missing and corrupt databases, foreign/newer schema
versions, unavailable destinations, insufficient disk space, interrupted backups, incorrect keys,
tampered archives, path traversal, restore over existing data, multiple app instances, and restoration
to a clean user profile. Tests should verify useful user-facing recovery states as well as data bytes.

**Sources and what Oracle should take from them**

The recommendations above are an engineering synthesis for Oracle. They are not claims that these
projects prescribe this exact structure. Research used upstream documentation and repositories,
accessed 2026-09-25; moving branches may change. No source code was copied or installed. Review
licenses before any future code reuse.

| Source | Observed pattern | Application to Oracle |
| --- | --- | --- |
| [FastAPI: larger applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/) and [lifespan](https://fastapi.tiangolo.com/advanced/events/) | Modular routers/dependencies and explicit resource startup/shutdown. | Keep HTTP adapters thin and resource ownership explicit. These docs do not mandate a complete domain architecture. |
| [Tauri: sidecars](https://v2.tauri.app/develop/sidecar/) | Bundled external executables can provide Python functionality without a separate user installation. | Replace the repository-dependent executable path during packaging; retain narrow native permissions. |
| [Home Assistant integration architecture](https://developers.home-assistant.io/docs/architecture_components/) | Domain-specific integrations offer actions, maintain state, and interact through events. | Give future email, calendar, and other capabilities explicit ownership and lifecycle. Its Python integrations are not a sandbox model to copy for untrusted plugins. |
| [Khoj processor structure](https://github.com/khoj-ai/khoj/tree/master/src/khoj/processor) and [backend layout](https://github.com/khoj-ai/khoj/tree/master/src/khoj) | Separate content/conversation/tool processing and database/router areas. | Keep ingestion, retrieval, conversations, and executable tools distinguishable as assistant features arrive. Directory inspection alone does not establish security or reliability. |
| [LocalAI backend architecture](https://github.com/mudler/LocalAI/blob/master/backend/README.md) | Standard backend contracts across inference implementations, including streaming and embeddings. | Define a provider boundary with explicit capabilities; its multi-language gRPC deployment is more than Oracle currently needs. |
| [SQLite transactions](https://www.sqlite.org/lang_transaction.html) | Concurrent readers are supported; only one writer proceeds at a time. | Avoid acquiring a write reservation for every read; keep mutations short and concurrency rules tested. |
| [SQLite online backup](https://www.sqlite.org/backup.html) | Produces a database snapshot through SQLite's backup mechanism. | Make a consistent snapshot before encryption/upload; avoid copying a live database blindly. |
| [restic repository design](https://restic.readthedocs.io/en/stable/100_references.html) | Immutable snapshots, atomic writes, integrity metadata, and authenticated encryption. | Borrow recovery and snapshot principles; evaluate mature tools before deciding on an implementation. No tool has been selected. |
| [OWASP LLM prompt injection guidance](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html) | Tool authorization, least privilege, separation of untrusted content, and human oversight. | Enforce permissions outside the model. Adapt observability to Oracle's privacy rules instead of logging raw prompts and private documents by default. |

**Proposed delivery order**

1. Fix workspace initialization/recovery distinctions and database lifecycle; add regression tests
   for the reproduced missing-file and contention behaviours.
2. Implement and verify encrypted, versioned backup and restore against that stable boundary.
3. Refactor current tracking/import code into feature modules with typed transport contracts;
   preserve existing commands through compatibility wrappers while moving code.
4. Package and supervise the Python runtime; introduce a persistent worker when its readiness,
   shutdown, cancellation, session, and clean-machine tests are ready.
5. Add structured follow-ups, status history, and evidence-backed profile/documents as scoped features.
   Preserve imported free text while introducing typed dates/events; never guess historical values.
6. Add the first read-and-propose AI feature with provider abstraction, data-use controls, and evals.
7. Add durable tasks and narrowly scoped integrations as real use cases require them.

This order protects current records early while giving Oracle room to become a broader personal
assistant without a wholesale rewrite.
