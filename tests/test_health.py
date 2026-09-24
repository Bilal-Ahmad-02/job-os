import pytest
from fastapi.testclient import TestClient


def test_health_returns_only_liveness(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["content-type"] == "application/json"
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("host", ["127.0.0.1:8000", "localhost:8000"])
def test_local_hosts_are_accepted(client: TestClient, host: str) -> None:
    assert client.get("/health", headers={"Host": host}).status_code == 200


@pytest.mark.parametrize("host", ["attacker.example", "localhost.attacker.example"])
def test_untrusted_hosts_are_rejected(client: TestClient, host: str) -> None:
    response = client.get("/health", headers={"Host": host})

    assert response.status_code == 400


@pytest.mark.parametrize("path", ["/", "/docs", "/redoc", "/openapi.json", "/health/"])
def test_only_explicit_routes_are_available(client: TestClient, path: str) -> None:
    assert client.get(path, follow_redirects=False).status_code == 404


@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
def test_health_does_not_accept_writes(client: TestClient, method: str) -> None:
    assert client.request(method, "/health").status_code == 405


def test_no_cross_origin_read_permission(client: TestClient) -> None:
    response = client.get("/health", headers={"Origin": "https://attacker.example"})

    # CORS is a browser read restriction, not authentication or a request firewall.
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


def test_cross_origin_preflight_is_not_enabled(client: TestClient) -> None:
    response = client.options(
        "/health",
        headers={
            "Origin": "https://attacker.example",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
