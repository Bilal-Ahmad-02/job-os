"""Content comparison for explicit workspace maintenance; contains no record logging."""

import hashlib
import json
import sqlite3
from contextlib import closing
from pathlib import Path


def fingerprint(database: Path) -> dict:
    """Hash every table's typed rows, including complete PDF bytes and duplicate rows."""
    with closing(sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)) as connection:
        connection.execute("BEGIN")
        result = {}
        names = connection.execute(
            "SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        for name, schema in names:
            quoted = '"' + name.replace('"', '""') + '"'
            rows = []
            cursor = connection.execute("SELECT * FROM " + quoted)  # noqa: S608 -- quoted identifier
            for row in cursor:
                cells = [("bytes", value.hex()) if isinstance(value, bytes)
                         else (type(value).__name__, value) for value in row]
                rows.append(hashlib.sha256(json.dumps(cells, ensure_ascii=True).encode()).digest())
            digest = hashlib.sha256(schema.encode())
            for row in sorted(rows):
                digest.update(row)
            result[name] = {"rows": len(rows), "sha256": digest.hexdigest()}
        return result
