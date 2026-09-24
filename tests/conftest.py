from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app(), base_url="http://127.0.0.1") as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def isolate_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("JOB_OS_PORT", raising=False)
    monkeypatch.delenv("JOB_OS_LOG_LEVEL", raising=False)
    monkeypatch.delenv("JOB_OS_ALLOW_DESKTOP_DEV_ORIGIN", raising=False)
