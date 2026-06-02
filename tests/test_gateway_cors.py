import requests
import pytest

pytestmark = pytest.mark.integration

BASE_URL = "http://localhost:8080"


def test_cors_preflight_allowed_origin():
    # Test that preflight request for allowed origin works
    response = requests.options(
        f"{BASE_URL}/api/flights",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization"
        },
        timeout=10
    )
    
    # Preflight should return 200 OK
    assert response.status_code == 200
    
    # Preflight must return the allowed origin
    assert response.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"
    
    # Preflight should indicate which methods/headers are allowed
    assert "GET" in response.headers.get("Access-Control-Allow-Methods", "")
    assert "Authorization" in response.headers.get("Access-Control-Allow-Headers", "")


def test_cors_preflight_unallowed_origin():
    # Test that preflight request for unallowed origin is rejected (or doesn't get the header)
    response = requests.options(
        f"{BASE_URL}/api/flights",
        headers={
            "Origin": "https://untrusted.example.com",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization"
        },
        timeout=10
    )
    
    # If the middleware rejects it, it might return 400 or omit the header on a 200/405.
    # FastAPI's CORSMiddleware typically returns 400 for disallowed origins in preflight.
    # Alternatively, if it passes through, it won't have the Access-Control-Allow-Origin header.
    if response.status_code == 200:
        assert response.headers.get("Access-Control-Allow-Origin") != "https://untrusted.example.com"
    else:
        assert response.status_code in (400, 405)
