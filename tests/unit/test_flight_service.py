import sys
from pathlib import Path
SERVICE_DIR = Path(__file__).resolve().parents[2] / "services" / "flight_service"
sys.path.insert(0, str(SERVICE_DIR))
for mod in ("main", "database", "models"):
    sys.modules.pop(mod, None)

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock

from main import app
import database
import main as flight_main

client = TestClient(app)

@pytest.fixture(autouse=True)
def mock_dynamodb(monkeypatch):
    monkeypatch.setattr(database, "use_dynamodb", lambda: True)
    monkeypatch.setattr(database, "backend_health", lambda: "ok")

def test_flight_can_be_created_dynamodb(monkeypatch):
    monkeypatch.setattr(database, "list_flight_items", lambda: [])
    monkeypatch.setattr(database, "create_flight_item", lambda *args: {
        "flight_id": "test-id", "flight_no": "AL101", "origin": "LHR", "destination": "JFK",
        "price": 100.0, "available_seats": 50, "total_seats": 50,
        "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z"
    })
    
    response = client.post("/flights", params={"flight_no": "AL101", "seats": 50, "origin": "LHR", "destination": "JFK", "price": 100.0})
    assert response.status_code == 200
    data = response.json()
    assert data["flight_number"] == "AL101"
    assert data["available_seats"] == 50

def test_flight_creation_validation_errors(monkeypatch):
    monkeypatch.setattr(database, "list_flight_items", lambda: [])
    response = client.post("/flights", params={"flight_no": "", "seats": 50, "origin": "LHR", "destination": "JFK", "price": 100.0})
    assert response.status_code == 400
    response = client.post("/flights", params={"flight_no": "AL102", "seats": 50, "origin": "LHRR", "destination": "JFK", "price": 100.0})
    assert response.status_code == 400

def test_flight_seat_reservation_success(monkeypatch):
    monkeypatch.setattr(database, "reserve_seat_item", lambda fid, count: {
        "flight_id": fid, "flight_no": "AL101", "origin": "LHR", "destination": "JFK",
        "price": 100.0, "available_seats": 50 - count
    })
    response = client.patch("/flights/test-id/reserve", params={"seat_count": 3})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["reserved_seats"] == 3
    assert data["remaining_seats"] == 47

def test_flight_seat_reservation_zero_or_negative(monkeypatch):
    response = client.patch("/flights/test-id/reserve", params={"seat_count": 0})
    assert response.status_code == 400
    response = client.patch("/flights/test-id/reserve", params={"seat_count": -5})
    assert response.status_code == 400

def test_flight_seat_reservation_insufficient(monkeypatch):
    monkeypatch.setattr(database, "reserve_seat_item", lambda fid, count: None)
    response = client.patch("/flights/test-id/reserve", params={"seat_count": 100})
    assert response.status_code == 400

def test_price_update_success(monkeypatch):
    monkeypatch.setattr(flight_main, "send_event", lambda *args, **kwargs: None)
    monkeypatch.setattr(database, "update_price_item", lambda fid, p: {"flight_id": fid, "price": p})
    response = client.patch("/flights/test-id/price", params={"new_price": 250.0})
    assert response.status_code == 200

def test_price_update_non_existent(monkeypatch):
    monkeypatch.setattr(database, "update_price_item", lambda fid, p: None)
    response = client.patch("/flights/missing-id/price", params={"new_price": 250.0})
    assert response.status_code == 404
