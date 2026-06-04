import sys
from pathlib import Path
SERVICE_DIR = Path(__file__).resolve().parents[2] / "services" / "booking_service"
sys.path.insert(0, str(SERVICE_DIR))
for mod in ("main", "database", "models"):
    sys.modules.pop(mod, None)

import pytest
from fastapi.testclient import TestClient

from main import app
import main as booking_main
import database

client = TestClient(app)

@pytest.fixture(autouse=True)
def mock_dynamodb(monkeypatch):
    monkeypatch.setattr(database, "use_dynamodb", lambda: True)
    monkeypatch.setattr(database, "backend_health", lambda: "ok")

def test_booking_creation_success(monkeypatch):
    monkeypatch.setattr(booking_main, "call_flight_service", lambda fid, count: {
        "flight_id": fid, "flight_no": "AL101", "origin": "LHR", "destination": "JFK", "price": 100.0,
    })
    def mock_create_booking(**kwargs):
        return {"booking_id": "test-booking-1", **kwargs, "created_at": "2026-01-01T00:00:00Z"}
    monkeypatch.setattr(database, "create_booking_item", mock_create_booking)

    response = client.post("/bookings", params={"name": "Test Passenger", "flight_id": "flight-1", "seat_count": 2}, headers={"x-passenger-sub": "passenger-test-sub"})
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "test-booking-1"
    assert data["passenger_name"] == "Test Passenger"
    assert data["total_amount"] == 200.0
    assert data["status"] == "PENDING_PAYMENT"

def test_booking_creation_missing_sub(monkeypatch):
    response = client.post("/bookings", params={"name": "Test Passenger", "flight_id": "flight-1", "seat_count": 2})
    assert response.status_code == 401

def test_booking_creation_empty_name(monkeypatch):
    response = client.post("/bookings", params={"name": " ", "flight_id": "flight-1", "seat_count": 2}, headers={"x-passenger-sub": "passenger-test-sub"})
    assert response.status_code == 400

def test_booking_creation_negative_seats(monkeypatch):
    response = client.post("/bookings", params={"name": "Test Passenger", "flight_id": "flight-1", "seat_count": 0}, headers={"x-passenger-sub": "passenger-test-sub"})
    assert response.status_code == 400

def test_booking_creation_insufficient_seats(monkeypatch):
    monkeypatch.setattr(booking_main, "call_flight_service", lambda fid, count: {"error": True, "detail": "Not enough seats available for this booking."})
    response = client.post("/bookings", params={"name": "Test Passenger", "flight_id": "flight-1", "seat_count": 5}, headers={"x-passenger-sub": "passenger-test-sub"})
    assert response.status_code == 400

def test_booking_creation_flight_service_failure(monkeypatch):
    def mock_failure(*args, **kwargs):
        raise Exception("Flight Service Error")
    monkeypatch.setattr(booking_main, "call_flight_service", mock_failure)
    response = client.post("/bookings", params={"name": "Test Passenger", "flight_id": "flight-1", "seat_count": 2}, headers={"x-passenger-sub": "passenger-test-sub"})
    assert response.status_code == 503

def test_get_my_bookings(monkeypatch):
    monkeypatch.setattr(database, "list_passenger_bookings_item", lambda sub: [{"booking_id": "b1", "passenger_sub": sub}, {"booking_id": "b2", "passenger_sub": sub}])
    response = client.get("/bookings/me", headers={"x-passenger-sub": "passenger-test-sub"})
    assert response.status_code == 200
    assert len(response.json()["items"]) == 2

def test_get_all_bookings_staff(monkeypatch):
    monkeypatch.setattr(database, "list_booking_items", lambda: [{"booking_id": "b1", "passenger_sub": "sub1"}, {"booking_id": "b2", "passenger_sub": "sub2"}])
    response = client.get("/bookings")
    assert response.status_code == 200
    assert len(response.json()["items"]) == 2
