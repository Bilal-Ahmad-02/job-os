from unittest.mock import patch

import pytest

from app.__main__ import main


def test_launcher_keeps_network_and_logging_restricted(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JOB_OS_PORT", "9000")
    monkeypatch.setenv("JOB_OS_LOG_LEVEL", "warning")
    # Generic Uvicorn environment settings must not widen the supported launcher.
    monkeypatch.setenv("UVICORN_HOST", "0.0.0.0")  # noqa: S104 -- hostile setting under test
    monkeypatch.setenv("FORWARDED_ALLOW_IPS", "*")

    with patch("app.__main__.uvicorn.run") as run:
        main()

    run.assert_called_once()
    assert run.call_args.kwargs == {
        "host": "127.0.0.1",
        "port": 9000,
        "log_level": "warning",
        "proxy_headers": False,
        "server_header": False,
        "access_log": False,
    }
    assert run.call_args.args[0].debug is False


def test_invalid_configuration_stops_before_binding(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JOB_OS_PORT", "invalid-private-value")

    with patch("app.__main__.uvicorn.run") as run:
        with pytest.raises(SystemExit) as error:
            main()

    run.assert_not_called()
    assert "Invalid backend configuration" in str(error.value)
    assert "invalid-private-value" not in str(error.value)
