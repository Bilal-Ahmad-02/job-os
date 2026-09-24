# Oracle

Oracle is a local-first Windows desktop application in development for managing a technical job search: discovering opportunities, preparing applications, tracking interviews and outcomes, and learning from application history. The repository and original project plan are named Job OS.

The project will begin with a job and application tracker, followed by evidence-grounded AI assistance and optional automation. It is both a personal tool and a portfolio project focused on maintainable software, data, and AI engineering.

See [the project context](docs/PROJECT_CONTEXT.md) for the long-term goals, intended architecture, privacy rules, and development principles.

## Current scope

The backend foundation exposes only `GET /health`, returning `{"status":"ok"}`.
This confirms the process is responding; it does not check a database or AI provider.
The Tauri/React desktop shell displays connection status with a manual retry and refreshes when
the window regains focus. A native password lock gates the workspace and its connection check.
First launch asks you to create your password; later launches require it. Job persistence and AI
integrations are not implemented yet. See [backup and restore](docs/BACKUP.md) for recovering the
source code on another computer; local personal data is not uploaded to GitHub.
See [desktop setup and security](docs/DESKTOP.md) to run Oracle's Windows app.

## Windows development setup

Use Python 3.11 (the initial tested version) and PowerShell. Run commands from the repository root.
The first setup downloads packages from PyPI; running the health service requires no cloud account,
API key, or paid service. Dependencies stay in the ignored `.venv` directory.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --use-feature=truststore --require-hashes -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pip install --no-deps --no-build-isolation -e .
```

The editable install makes the `app` Python package available without modifying `PYTHONPATH`.
Calling the virtual environment's Python directly avoids changing PowerShell execution policy.

The `--use-feature=truststore` flag enables Windows' trusted certificates with Python 3.11's
older bundled pip while retaining TLS verification. Modern pip already enables this behavior and
may report that the flag is unnecessary. The development lock installs a modern pip version.
Do not disable certificate verification.

## Run and verify

```powershell
.\.venv\Scripts\python.exe -m app
```

In a second PowerShell terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Expected result: a `status` field containing `ok`. Stop the server with `Ctrl+C`.
An occupied port causes startup to fail; stop the conflicting process or choose another port.

Optional configuration uses process environment variables, not automatically loaded `.env` files:

| Variable | Default | Accepted values |
| --- | --- | --- |
| `JOB_OS_PORT` | `8000` | Integer from 1024 to 65535 |
| `JOB_OS_LOG_LEVEL` | `info` | `debug`, `info`, `warning`, `error`, `critical` |
| `JOB_OS_ALLOW_DESKTOP_DEV_ORIGIN` | `false` | Boolean; enable only for Tauri development |

For example, set `$env:JOB_OS_PORT = "8001"` before starting the backend and use that port in the
health-check URL. Invalid configuration fails before the server opens a socket.

## Security boundary

- The supported launcher binds explicitly to IPv4 loopback (`127.0.0.1`), not the LAN.
- Requests must use a `127.0.0.1` or `localhost` Host header. This limits untrusted hostnames,
  including common DNS-rebinding paths; it is not client authentication.
- Forwarded proxy headers are not trusted. Debug responses, interactive API docs, and the
  OpenAPI endpoint are disabled. CORS allows only `GET` from `http://tauri.localhost`, without
  credentials. The exact development origin `http://127.0.0.1:1420` requires explicit opt-in.
- Request access logging is disabled to avoid routinely recording URLs or query parameters.
  Server lifecycle and error logging remain enabled; never include secrets in URLs or logs.
- The health endpoint is intentionally unauthenticated and returns no personal or machine data.
  Other local processes can call it. Browsers may still send some requests without CORS permission.
- Before adding private data or state-changing endpoints, design and test desktop/backend
  authentication and browser-origin protections. These initial restrictions do not protect against
  malicious software already running under your user account.

Use the provided launcher: starting Uvicorn manually with different flags can bypass its network
and logging defaults. Do not expose this service to a network or use a public tunnel.

## Checks

```powershell
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
.\.venv\Scripts\python.exe -m pip check
```

Tests cover the health response, host validation, unavailable routes, rejected write methods,
restricted CORS permissions, configuration validation, and server startup defaults.
The test client uses `httpx2`, as recommended by the current
[Starlette testing guidance](https://www.starlette.io/testclient/).

## Dependency maintenance

`pyproject.toml` declares direct dependencies. `requirements.txt` and `requirements-dev.txt`
pin resolved runtime and development dependencies with package hashes. They are generated for
the initial Windows/Python 3.11 environment; regenerate and test when changing the supported runtime.
Keep lockfiles in Git, but keep local environments and private data out of it.

After editing dependencies, regenerate the runtime lock first, then the development lock:

```powershell
.\.venv\Scripts\python.exe -m piptools compile --generate-hashes --strip-extras --no-emit-index-url --no-build-isolation --output-file requirements.txt pyproject.toml
.\.venv\Scripts\python.exe -m piptools compile --extra dev --generate-hashes --allow-unsafe --strip-extras --no-emit-index-url --no-build-isolation --constraint requirements.txt --output-file requirements-dev.txt pyproject.toml
```

Add `--upgrade` to deliberately refresh pinned versions. Review the changes, reinstall using the
setup commands, and run the checks. For a clean dependency verification, use a fresh virtual
environment; installing requirements alone does not remove previously installed packages.
