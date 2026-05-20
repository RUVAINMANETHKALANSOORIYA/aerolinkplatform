import pytest

from datetime import datetime, timedelta

from tests.helpers import load_service_app, unique_name


pytestmark = pytest.mark.unit


def test_schedule_can_be_created(monkeypatch):
    client, main, _, _, _ = load_service_app("schedule_service")
    monkeypatch.setattr(main, "send_event", lambda *args, **kwargs: None)

    departure_time = datetime.utcnow() + timedelta(days=1)
    arrival_time = departure_time + timedelta(hours=8)

    response = client.post(
        "/schedules",
        json={
            "flight_no": unique_name("SCH"),
            "origin": "LHR",
            "destination": "JFK",
            "departure_time": departure_time.isoformat(),
            "arrival_time": arrival_time.isoformat(),
            "gate": "A12",
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == "SCHEDULED"
    assert payload["gate"] == "A12"


def test_schedule_can_be_updated(monkeypatch):
    client, main, _, _, _ = load_service_app("schedule_service")
    monkeypatch.setattr(main, "send_event", lambda *args, **kwargs: None)

    departure_time = datetime.utcnow() + timedelta(days=1)
    arrival_time = departure_time + timedelta(hours=8)

    create_response = client.post(
        "/schedules",
        json={
            "flight_no": unique_name("SCHUPD"),
            "origin": "LHR",
            "destination": "JFK",
            "departure_time": departure_time.isoformat(),
            "arrival_time": arrival_time.isoformat(),
            "gate": "B10",
        },
    )
    schedule_id = create_response.json()["id"]

    update_response = client.patch(
        f"/schedules/{schedule_id}",
        json={"status": "BOARDING", "gate": "B15"},
    )

    assert update_response.status_code == 200
    payload = update_response.json()
    assert payload["message"] == "Schedule updated and broadcasted"
    assert payload["schedule"]["status"] == "BOARDING"
    assert payload["schedule"]["gate"] == "B15"
