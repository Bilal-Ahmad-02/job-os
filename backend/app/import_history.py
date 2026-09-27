"""Explicit local maintenance command; not exposed to the desktop renderer."""

import argparse
import json
import sys
from pathlib import Path

from app.db.store import open_store
from app.db.workspace import prepare_workspace
from app.services.spreadsheet_import import import_workbook


def main() -> None:
    parser = argparse.ArgumentParser(description="Import a Job Application Log into Oracle.")
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--database", type=Path, required=True)
    args = parser.parse_args()
    engine = None
    try:
        prepare_workspace(args.database)
        engine = open_store(args.database)
        result = import_workbook(engine, args.workbook)
    except Exception:
        print(
            "Import failed. Check workbook format and database access; no rows were imported.",
            file=sys.stderr,
        )
        raise SystemExit(1) from None
    finally:
        if engine is not None:
            engine.dispose()
    print(json.dumps(result))


if __name__ == "__main__":
    main()
