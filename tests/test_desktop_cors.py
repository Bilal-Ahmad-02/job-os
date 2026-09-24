import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def test_packaged_oracle_can_read_health(client: TestClient) -> None:
    response = client.get("/health", headers={"Origin": "http://tauri.localhost"})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://tauri.localhost"
    assert "access-control-allow-credentials" not in response.headers
    assert "Origin" in response.headers["vary"]


@pytest.mark.parametrize(
    "origin",
    [
        "http://127.0.0.1:1420",
        "http://localhost:1420",
        "http://127.0.0.1:1421",
        "http://tauri.localhost.attacker.example",
        "https://attacker.example",
        "null",
    ],
)
def test_other_origins_have_no_read_permission(client: TestClient, origin: str) -> None:
    response = client.get("/health", headers={"Origin": origin})

    assert "access-control-allow-origin" not in response.headers


def test_development_origin_requires_explicit_opt_in(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JOB_OS_ALLOW_DESKTOP_DEV_ORIGIN", "true")
    with TestClient(create_app(), base_url="http://127.0.0.1") as client:
        response = client.get("/health", headers={"Origin": "http://127.0.0.1:1420"})

    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:1420"


@pytest.mark.parametrize("development", [False, True])
def test_allowed_origins_cannot_preflight_writes_or_auth_headers(development: bool) -> None:
    settings = Settings(allow_desktop_dev_origin=development)
    origin = "http://127.0.0.1:1420" if development else "http://tauri.localhost"
    with TestClient(create_app(settings), base_url="http://127.0.0.1") as client:
        for method, request_headers in [("POST", ""), ("GET", "Authorization")]:
            response = client.options(
                "/health",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": method,
                    "Access-Control-Request-Headers": request_headers,
                },
            )
            assert response.status_code == 400


def test_packaged_get_preflight_is_allowed(client: TestClient) -> None:
    response = client.options(
        "/health",
        headers={
            "Origin": "http://tauri.localhost",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-methods"] == "GET"
