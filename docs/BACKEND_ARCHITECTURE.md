# Backend boundaries (step 8)

Oracle runs feature services in Ubuntu WSL2 and its native desktop on Windows. This checkpoint
keeps the existing application, document, profile and review contracts while separating operation
routing from the private pipe adapter. No database migration or new service is introduced.

## Responsibilities

| Layer | Current code | Responsibility |
| --- | --- | --- |
| Desktop authority | `apps/desktop/src-tauri/src/commands.rs` | Enforce the unlocked session and serialize record operations with lock. |
| Process transport | Native `wsl.rs`, Linux `wsl_worker.py` / `wsl_guard.py` | Pin the runtime/workspace, frame and bound IPC, enforce deadlines, terminate orphaned descendants. |
| Pipe adapter | `backend/app/desktop_bridge.py` | Parse one bounded request, own its engine lifetime, translate failures into public codes, serialize one bounded response. |
| Operation routing | `backend/app/operations.py` | Explicitly map validated request types to feature services; no implicit write fallback. |
| Feature rules | `backend/app/services/` | Application updates, document versions, profile saves, evidence and owner-review rules. Own each transaction and revision check. |
| Contracts | `backend/app/schemas/` | Bound and validate request/result structures. `DesktopRequest` and `DesktopResult` collect the supported types. |
| Persistence | `backend/app/db/` and `models/` | Workspace identity, existing-only opens, transaction policy, explicit migrations, stored records. |
| Maintenance | Import, backup and workspace CLIs | Explicit local maintenance. They are not exposed by desktop operation routing. |

The optional loopback health service does not serve private records. Operations take an existing,
identity-checked engine and a validated request; they do not choose database paths or authenticate
callers. A future task runner must establish its own authorization and lifecycle before calling
these services. Calling a Python function is not an authorization boundary against local code.

## IPC behavior

Protocol version 1 and existing action/error names are preserved. Requests are at most 512 KiB.
Duplicate JSON members at any nesting depth, non-finite constants, malformed/overly nested JSON,
unknown actions and unknown fields are rejected before opening the workspace. No request can select
a database path or invoke imports, restores, arbitrary functions or modules.

Every supported operation is explicitly dispatched. The older application-only compatibility
adapter also rejects unsupported request objects rather than treating them as saves. Adding a
request type requires extending routing and its coverage tests deliberately.

The adapter disposes its engine after both successful and failed operations. Public failures are
allowlisted codes; unexpected exceptions and cleanup/encoding errors never serialize their text,
paths or records. Responses are limited to 2 MiB minus 256 bytes, leaving room for the Linux
guardian's exit footer. Oversized/failed encoding returns a complete `storage` failure, never a
partial JSON document. This is an output/transport limit, not a sandbox or streaming-memory limit.

A response or cleanup failure after a committed write can leave the outcome uncertain. Neither
the native transport nor this adapter automatically retries writes. Reload and compare saved state;
the existing version/idempotency rules still apply. No changes were made to live private records.

## Verification and next milestone

Synthetic regressions cover all request types, read/write routing, unsupported-object rejection,
ambiguous/malformed input before database access, error redaction, engine disposal, output bounds,
and the real subprocess wire contract. Existing regression tests cover the feature transactions,
document immutability, review/profile concurrency, backup restoration and WSL worker lifecycle.

Step 9 now adds cooperative, durable source-text extraction tasks through the same authenticated
request boundary. See TASKS.md for state transitions, cancellation granularity and interruption
recovery. Tasks accept stored source IDs and explicit operations; there is no arbitrary function
runner, unattended scheduler, external connector or AI provider.

Validation completed 2026-10-01: 213 Linux tests and both Windows/WSL native integration
tests passed; Ruff passed. No frontend/native executable changes required a rebuild.
