"""Supported local-only server entry point: python -m app."""

import sys

import uvicorn
from pydantic import ValidationError

from app.core.config import Settings
from app.main import create_app


def main() -> None:
    try:
        settings = Settings()
    except ValidationError:
        sys.exit(
            "Invalid backend configuration. JOB_OS_PORT must be 1024-65535; "
            "JOB_OS_LOG_LEVEL must be debug, info, warning, error, or critical; "
            "JOB_OS_ALLOW_DESKTOP_DEV_ORIGIN must be a boolean."
        )

    uvicorn.run(
        create_app(settings),
        host="127.0.0.1",
        port=settings.port,
        log_level=settings.log_level,
        proxy_headers=False,
        server_header=False,
        access_log=False,
    )


if __name__ == "__main__":
    main()
