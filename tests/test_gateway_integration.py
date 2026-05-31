import os
import uuid

import requests
import pytest


pytestmark = pytest.mark.integration


BASE_URL = "http://localhost:8080"
PASSENGER_TOKEN = os.getenv("COGNITO_PASSENGER_ACCESS_TOKEN")
STAFF_TOKEN = os.getenv("COGNITO_STAFF_ACCESS_TOKEN")


def _unique(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _health_check() -> None:
    response = requests.get(f"{BASE_URL}/health", timeout=10)
    response.raise_for_status()


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_gateway_complete_flow():
    if not PASSENGER_TOKEN or not STAFF_TOKEN:
        pytest.skip("Set COGNITO_PASSENGER_ACCESS_TOKEN and COGNITO_STAFF_ACCESS_TOKEN to run this integration test.")

    _health_check()

    staff_headers = _headers(STAFF_TOKEN)
    passenger_headers = _headers(PASSENGER_TOKEN)

    create_flight = requests.post(
        f"{BASE_URL}/api/flights",
        params={"flight_no": _unique("AL"), "seats": 50},
        headers=staff_headers,
        timeout=10,
    )
    assert create_flight.status_code == 200
    flight_id = create_flight.json()["id"]

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

    passenger_create_booking = requests.post(
        f"{BASE_URL}/api/bookings",
        params={"name": _unique("passenger"), "flight_id": flight_id},
        headers=passenger_headers,
        timeout=10,
    )
    assert passenger_create_booking.status_code == 200

    create_baggage = requests.post(
        f"{BASE_URL}/api/baggage",
        params={
            "passenger_name": _unique("passenger"),
            "flight_id": flight_id,
            "tag_number": _unique("TAG"),
        },
        headers=staff_headers,
        timeout=10,
    )
    assert create_baggage.status_code == 201

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
