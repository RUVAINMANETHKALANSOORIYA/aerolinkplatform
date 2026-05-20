import pytest

from tests.helpers import load_service_app, unique_name


pytestmark = pytest.mark.unit


def test_flight_can_be_created(monkeypatch):
    client, main, _, _, _ = load_service_app("flight_service")
    monkeypatch.setattr(main, "send_event", lambda *args, **kwargs: None)

    flight_no = unique_name("AL")
    response = client.post("/flights", params={"flight_no": flight_no, "seats": 25})

    assert response.status_code == 200
    payload = response.json()
    assert payload["flight_number"] == flight_no
    assert payload["available_seats"] == 25


def test_flight_seat_can_be_reserved(monkeypatch):
    client, main, _, _, _ = load_service_app("flight_service")
    monkeypatch.setattr(main, "send_event", lambda *args, **kwargs: None)

    flight_no = unique_name("ALRES")
    create_response = client.post("/flights", params={"flight_no": flight_no, "seats": 2})
    flight_id = create_response.json()["id"]

    reserve_response = client.patch(f"/flights/{flight_id}/reserve")

    assert reserve_response.status_code == 200
    payload = reserve_response.json()
    assert payload["status"] == "success"
    assert payload["remaining_seats"] == 1
