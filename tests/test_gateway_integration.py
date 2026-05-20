import uuid

import requests
import pytest


pytestmark = pytest.mark.integration


BASE_URL = "http://localhost:8080"


def _unique(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _health_check() -> None:
    response = requests.get(f"{BASE_URL}/health", timeout=10)
    response.raise_for_status()


def test_gateway_complete_flow():
    _health_check()

    staff_username = _unique("staff")
    passenger_username = _unique("passenger")
    staff_password = "secret123"
    passenger_password = "secret123"

    register_staff = requests.post(
        f"{BASE_URL}/api/auth/register",
        params={"username": staff_username, "password": staff_password, "role": "staff"},
        timeout=10,
    )
    assert register_staff.status_code in (200, 201)

    login_staff = requests.post(
        f"{BASE_URL}/api/auth/login",
        data={"username": staff_username, "password": staff_password},
        timeout=10,
    )
    assert login_staff.status_code == 200
    staff_token = login_staff.json()["access_token"]

    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    create_flight = requests.post(
        f"{BASE_URL}/api/flights",
        params={"flight_no": _unique("AL"), "seats": 50},
        headers=staff_headers,
        timeout=10,
    )
    assert create_flight.status_code == 200
    flight_id = create_flight.json()["id"]

    register_passenger = requests.post(
        f"{BASE_URL}/api/auth/register",
        params={"username": passenger_username, "password": passenger_password, "role": "passenger"},
        timeout=10,
    )
    assert register_passenger.status_code in (200, 201)

    login_passenger = requests.post(
        f"{BASE_URL}/api/auth/login",
        data={"username": passenger_username, "password": passenger_password},
        timeout=10,
    )
    assert login_passenger.status_code == 200
    passenger_token = login_passenger.json()["access_token"]
    passenger_headers = {"Authorization": f"Bearer {passenger_token}"}

    view_flights = requests.get(f"{BASE_URL}/api/flights", headers=passenger_headers, timeout=10)
    assert view_flights.status_code == 200
    assert isinstance(view_flights.json(), list)

    passenger_create_flight = requests.post(
        f"{BASE_URL}/api/flights",
        params={"flight_no": _unique("DENIED"), "seats": 20},
        headers=passenger_headers,
        timeout=10,
    )
    assert passenger_create_flight.status_code == 403

    create_baggage = requests.post(
        f"{BASE_URL}/api/baggage",
        params={
            "passenger_name": passenger_username,
            "flight_id": flight_id,
            "tag_number": _unique("TAG"),
        },
        headers=staff_headers,
        timeout=10,
    )
    assert create_baggage.status_code == 201
    baggage_id = create_baggage.json()["id"]

    update_baggage = requests.patch(
        f"{BASE_URL}/api/baggage/{baggage_id}/status",
        params={"new_status": "LOADED"},
        headers=staff_headers,
        timeout=10,
    )
    assert update_baggage.status_code == 200
    assert update_baggage.json()["baggage"]["status"] == "LOADED"

    create_schedule = requests.post(
        f"{BASE_URL}/api/schedules",
        json={
            "flight_no": _unique("SCH"),
            "origin": "LHR",
            "destination": "JFK",
            "departure_time": "2025-06-15T14:30:00",
            "arrival_time": "2025-06-15T22:30:00",
            "gate": "A12",
        },
        headers=staff_headers,
        timeout=10,
    )
    assert create_schedule.status_code == 201
    schedule_id = create_schedule.json()["id"]

    update_schedule = requests.patch(
        f"{BASE_URL}/api/schedules/{schedule_id}",
        json={"status": "BOARDING", "gate": "A15"},
        headers=staff_headers,
        timeout=10,
    )
    assert update_schedule.status_code == 200
    assert update_schedule.json()["schedule"]["status"] == "BOARDING"
