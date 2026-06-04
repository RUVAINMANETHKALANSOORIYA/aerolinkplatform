import sys
from pathlib import Path
SERVICE_DIR = Path(__file__).resolve().parents[2] / "services" / "baggage_service"
sys.path.insert(0, str(SERVICE_DIR))
for mod in ("main", "database", "models"):
    sys.modules.pop(mod, None)

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock

from main import app
import database

client = TestClient(app)

@pytest.fixture
def mock_requests(monkeypatch):
    mock_get = MagicMock()
    monkeypatch.setattr("main.requests.get", mock_get)
    return mock_get

def test_create_baggage_success(monkeypatch, mock_requests):
    monkeypatch.setattr(database, "check_tag_exists", lambda tag: False)
    mock_get = mock_requests
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = {"id": "booking-test-001", "passenger_sub": "passenger-test-sub", "status": "CONFIRMED", "flight_id": "flight-101", "flight_no": "AL101", "origin": "LHR", "destination": "JFK"}

    def mock_create_baggage(**kwargs):
        return {"baggage_id": "bag-1", **kwargs, "created_at": "2026-01-01T00:00:00Z"}
    monkeypatch.setattr(database, "create_baggage_item", mock_create_baggage)

    response = client.post("/baggage", json={"booking_id": "booking-test-001", "tag_number": "TAG-TEST-001", "weight_kg": 20.5})
    assert response.status_code == 201
    data = response.json()
    assert data["tag_number"] == "TAG-TEST-001"
    assert data["flight_no"] == "AL101"
    assert "passenger_sub" not in data

def test_create_baggage_duplicate_tag(monkeypatch):
    monkeypatch.setattr(database, "check_tag_exists", lambda tag: True)
    response = client.post("/baggage", json={"booking_id": "booking-test-001", "tag_number": "TAG-TEST-001"})
    assert response.status_code == 400

def test_create_baggage_pending_booking(monkeypatch, mock_requests):
    monkeypatch.setattr(database, "check_tag_exists", lambda tag: False)
    mock_get = mock_requests
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = {"id": "booking-test-001", "passenger_sub": "passenger-test-sub", "status": "PENDING_PAYMENT"}

    response = client.post("/baggage", json={"booking_id": "booking-test-001", "tag_number": "TAG-TEST-001"})
    assert response.status_code == 400

def test_create_baggage_validation_errors(monkeypatch):
    monkeypatch.setattr(database, "check_tag_exists", lambda tag: False)
    response = client.post("/baggage", json={"booking_id": "   ", "tag_number": "TAG-123"})
    assert response.status_code == 422
    response = client.post("/baggage", json={"booking_id": "book-1", "tag_number": ""})
    assert response.status_code == 422
    response = client.post("/baggage", json={"booking_id": "book-1", "tag_number": "TAG-123", "weight_kg": -5})
    assert response.status_code == 422

def test_update_baggage_status_success(monkeypatch):
    monkeypatch.setattr(database, "update_baggage_status_item", lambda bid, status: {"baggage_id": bid, "status": status, "passenger_sub": "secret-sub"})
    response = client.patch("/baggage/bag-1/status", json={"status": "LOADED"})
    assert response.status_code == 200
    assert "passenger_sub" not in response.json()

def test_update_baggage_status_unknown(monkeypatch):
    monkeypatch.setattr(database, "update_baggage_status_item", lambda bid, status: None)
    response = client.patch("/baggage/bag-unknown/status", json={"status": "LOADED"})
    assert response.status_code == 404

def test_get_my_baggage(monkeypatch):
    monkeypatch.setattr(database, "list_passenger_baggage_items", lambda sub: [{"baggage_id": "bag-1", "tag_number": "TAG-1", "passenger_sub": sub, "flight_no": "AL101", "origin": "LHR", "destination": "JFK", "status": "CHECKED_IN", "updated_at": "2026-01-01T00:00:00Z", "weight_kg": 20.0}])
    response = client.get("/baggage/me", headers={"x-passenger-sub": "passenger-test-sub"})
    assert response.status_code == 200
    assert "passenger_sub" not in response.json()["items"][0]
