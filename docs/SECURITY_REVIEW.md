# Stabilization security review — October 2, 2026

This is a scoped code/test and dependency review of the current single-owner application, not a
penetration test or a guarantee that all defects are absent. External advisory results change.

## Boundaries reviewed

- Native authentication/capabilities guard record and provider commands. Lock ordering prevents
  admitted record/provider writes from continuing after lock returns. Each process has its own gate.
- The WebView cannot choose arbitrary filesystem paths, shell commands, provider URLs or secrets.
  Production navigation/CSP, denied downloads/new windows and bounded native responses remain intact.
- The record transport uses fixed worker commands, validated typed requests, supervised lifetimes,
  bounded pipes and redacted failures. No HTTP endpoint exposes private records.
- Workspace identity/no-create storage and checked migration/restore paths remain in force.
  Optimistic revisions protect profile/preferences/application updates. Unknown outcomes require
  explicit reconciliation; task continuation/retries are bounded.
- PDF originals are immutable. Extraction is subprocess-bounded; evidence/owner decisions remain
  separate. Parser process limits do not constitute a complete arbitrary-code OS sandbox.
- Provider entry uses Windows CredUI and Credential Manager. Only explicit permitted model-list
  checks can contact the fixed endpoint. No personal data or model prompt is sent by that operation.
- Source allowlist review covered 208 files before the checkpoint; no private artifact types or
  common API-token/private-key patterns were detected. This is narrower than proving no secret can
  exist. The final staged source receives another review before publication.

The app lock does not encrypt active SQLite or defeat same-user malware/admin access. OS/account
and disk protection remain important. Do not reinterpret this local gate as multi-user authentication.
Passwords and provider keys are never test inputs from the real account; tests use synthetic targets.

## Dependency advisory results

`npm audit --audit-level=high` reported zero vulnerabilities. OSV batch queries checked 460 Cargo
registry package versions and 40 Python development-lock versions. No Python runtime dependency
advisory was returned. The following findings remain visible rather than being suppressed:

| Dependency | Finding | Applicability / action |
| --- | --- | --- |
| `glib 0.18.5` | RUSTSEC-2024-0429 / GHSA-wrw7-89jp-8q8g, iterator unsoundness | Not in the Windows target dependency tree; reassess before building a native Linux GUI |
| `proc-macro-error 1.0.4` | RUSTSEC-2024-0370, unmaintained | Not in the Windows target tree; monitor upstream |
| Five `unic-* 0.9.0` crates | RUSTSEC-2025-0075, 0080, 0081, 0098, 0100; unmaintained | Present via `urlpattern`/`tauri-utils` on Windows; no patched releases listed; track an upstream migration |
| `setuptools 82.0.1` (build tooling) | GHSA-h35f-9h28-mq5c / PYSEC-2026-3447, moderate sdist exclusion issue | Advisory lists no patched version. Oracle builds wheels from explicitly staged inputs on Linux; it does not publish source distributions or use macOS MANIFEST.in exclusions to protect secrets |

The setuptools issue concerns Unicode filename normalization when excluding files from source
distributions on affected filesystems. Retain Oracle's explicit build-input staging; do not build
or publish an sdist containing private local files. If packaging/platform scope changes, re-evaluate
before publishing. This is an applicability assessment, not a claim the upstream issue was fixed.
[Upstream advisory](https://github.com/pypa/setuptools/security/advisories/GHSA-h35f-9h28-mq5c)

The Rust unmaintained notices indicate maintenance risk, not evidence of a demonstrated exploit in
Oracle. A rushed unrelated dependency replacement is outside this stabilization update. Recheck on
the next dependency update and before broader distribution or new privileged capabilities.
[RustSec database](https://rustsec.org/advisories/), [OSV batch API](https://google.github.io/osv.dev/post-v1-querybatch/).

The npm check sends package metadata to its advisory service. OSV checks send only public package
names and versions. No private records, source PDFs, credentials or account keys were submitted.

## Follow-up boundaries

Do not count provider account testing, native-dialog presentation or a complete UI walkthrough as
passed without the evidence in VALIDATION.md. Keep automated and owner-observed checks distinct.
Future inference, external sources, messaging and submission need separately scoped permissions,
cost/rate limits, prompt-injection handling and testing; the current provider-test permission grants
none of those capabilities.
