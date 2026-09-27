"""Explicit workspace maintenance; no renderer-selected paths or operations."""

import argparse
import json
from pathlib import Path

from app.db.store import WorkspaceError
from app.db.workspace import initialize_workspace, prepare_workspace


def main() -> None:
    parser = argparse.ArgumentParser(description="Initialize or prepare an Oracle workspace.")
    parser.add_argument("operation", choices=("initialize", "prepare"))
    parser.add_argument("database", type=Path)
    args = parser.parse_args()
    try:
        if args.operation == "initialize":
            initialize_workspace(args.database).dispose()
        else:
            prepare_workspace(args.database)
        result = {"ok": True, "result": {"ready": True}}
    except WorkspaceError as exc:
        result = {"ok": False, "error": str(exc)}
    except Exception:
        result = {"ok": False, "error": "workspace_invalid"}
    result["protocol_version"] = 1
    print(json.dumps(result))
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
