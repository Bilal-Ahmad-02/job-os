import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_defaults() -> None:
    settings = Settings()

    assert settings.port == 8000
    assert settings.log_level == "info"


def test_environment_overrides(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JOB_OS_PORT", "9000")
    monkeypatch.setenv("JOB_OS_LOG_LEVEL", "warning")

    settings = Settings()

    assert settings.port == 9000
    assert settings.log_level == "warning"


@pytest.mark.parametrize("port", ["0", "1023", "65536", "not-a-port"])
def test_invalid_port_is_rejected(monkeypatch: pytest.MonkeyPatch, port: str) -> None:
    monkeypatch.setenv("JOB_OS_PORT", port)

    with pytest.raises(ValidationError):
        Settings()


def test_invalid_log_level_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JOB_OS_LOG_LEVEL", "verbose")

    with pytest.raises(ValidationError):
        Settings()
