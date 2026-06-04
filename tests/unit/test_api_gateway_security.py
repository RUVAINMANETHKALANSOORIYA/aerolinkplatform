import sys
from pathlib import Path
SERVICE_DIR = Path(__file__).resolve().parents[2] / "services"
sys.path.insert(0, str(SERVICE_DIR))

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from api_gateway.main import app

client = TestClient(app)

@pytest.fixture
def mock_httpx_request(monkeypatch):
    from unittest.mock import AsyncMock
    mock_request = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b'{"success": true}'
    mock_response.headers = {"content-type": "application/json"}
    mock_request.return_value = mock_response
    monkeypatch.setattr("api_gateway.main.httpx.AsyncClient.request", mock_request)
    return mock_request

@pytest.fixture
def mock_jwt(monkeypatch):
    mock_jwks = MagicMock()
    mock_jwks.get_signing_key_from_jwt.return_value = MagicMock(key="fake_key")
    monkeypatch.setattr("api_gateway.main.get_cognito_jwks_client", lambda: mock_jwks)
    mock_decode = MagicMock()
    monkeypatch.setattr("api_gateway.main.jwt_decode", mock_decode)
    return mock_decode

def get_valid_claims(groups):
    return {"sub": "passenger-test-sub", "cognito:groups": groups, "token_use": "access", "client_id": "14hg3aomr5krmmac2ivh7q25bv", "iss": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_hpW84ZtH4"}

def test_missing_bearer_token():
    response = client.get("/api/flights")
    assert response.status_code == 401

def test_invalid_token(mock_jwt):
    from jwt import InvalidTokenError
    mock_jwt.side_effect = InvalidTokenError("Bad token")
    response = client.get("/api/flights", headers={"Authorization": "Bearer badtoken"})
    assert response.status_code == 401

def test_passenger_can_access_flights(mock_jwt, mock_httpx_request):
    mock_jwt.return_value = get_valid_claims(["Passenger"])
    response = client.get("/api/flights", headers={"Authorization": "Bearer validtoken"})
    assert response.status_code == 200

def test_passenger_can_access_own_bookings(mock_jwt, mock_httpx_request):
    mock_jwt.return_value = get_valid_claims(["Passenger"])
    response = client.get("/api/bookings/me", headers={"Authorization": "Bearer validtoken"})
    assert response.status_code == 200

def test_passenger_can_create_booking(mock_jwt, mock_httpx_request):
    mock_jwt.return_value = get_valid_claims(["Passenger"])
    response = client.post("/api/bookings", headers={"Authorization": "Bearer validtoken"}, json={})
    assert response.status_code == 200

def test_passenger_can_access_own_baggage(mock_jwt, mock_httpx_request):
    mock_jwt.return_value = get_valid_claims(["Passenger"])
    response = client.get("/api/baggage/me", headers={"Authorization": "Bearer validtoken"})
    assert response.status_code == 200

def test_passenger_cannot_access_staff_bookings(mock_jwt, mock_httpx_request):
    mock_jwt.return_value = get_valid_claims(["Passenger"])
    response = client.get("/api/bookings", headers={"Authorization": "Bearer validtoken"})
    assert response.status_code == 403

def test_passenger_cannot_create_baggage(mock_jwt, mock_httpx_request):
    mock_jwt.return_value = get_valid_claims(["Passenger"])
    response = client.post("/api/baggage", headers={"Authorization": "Bearer validtoken"}, json={})
    assert response.status_code == 403

def test_passenger_cannot_update_baggage_status(mock_jwt, mock_httpx_request):
    mock_jwt.return_value = get_valid_claims(["Passenger"])
    response = client.patch("/api/baggage/123/status", headers={"Authorization": "Bearer validtoken"}, json={})
    assert response.status_code == 403

def test_passenger_cannot_create_flight(mock_jwt, mock_httpx_request):
    mock_jwt.return_value = get_valid_claims(["Passenger"])
    response = client.post("/api/flights", headers={"Authorization": "Bearer validtoken"}, json={})
    assert response.status_code == 403

def test_staff_can_access_bookings(mock_jwt, mock_httpx_request):
    mock_jwt.return_value = get_valid_claims(["Staff"])
    response = client.get("/api/bookings", headers={"Authorization": "Bearer validtoken"})
    assert response.status_code == 200

def test_staff_can_create_baggage(mock_jwt, mock_httpx_request):
    mock_jwt.return_value = get_valid_claims(["Staff"])
    response = client.post("/api/baggage", headers={"Authorization": "Bearer validtoken"}, json={})
    assert response.status_code == 200

def test_staff_can_update_baggage_status(mock_jwt, mock_httpx_request):
    mock_jwt.return_value = get_valid_claims(["Staff"])
    response = client.patch("/api/baggage/123/status", headers={"Authorization": "Bearer validtoken"}, json={})
    assert response.status_code == 200

def test_staff_can_create_flight(mock_jwt, mock_httpx_request):
    mock_jwt.return_value = get_valid_claims(["Staff"])
    response = client.post("/api/flights", headers={"Authorization": "Bearer validtoken"}, json={})
    assert response.status_code == 200

def test_trusted_identity_forwarding_and_spoof_removal(mock_jwt, mock_httpx_request):
    mock_jwt.return_value = get_valid_claims(["Passenger"])
    response = client.get("/api/bookings/me", headers={"Authorization": "Bearer validtoken", "x-passenger-sub": "spoofed-sub"})
    assert response.status_code == 200
    upstream_headers = mock_httpx_request.call_args[1].get("headers", {})
    assert upstream_headers.get("x-passenger-sub") == "passenger-test-sub"
