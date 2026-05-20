import pytest

from tests.helpers import load_service_app, unique_name


pytestmark = pytest.mark.unit


def test_baggage_can_be_created(monkeypatch):
    client, main, _, _, _ = load_service_app("baggage_service")
    monkeypatch.setattr(main, "send_event", lambda *args, **kwargs: None)

    response = client.post(
        "/baggage",
        params={
            "passenger_name": unique_name("passenger"),
            "flight_id": 101,
            "tag_number": unique_name("TAG"),
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == "CHECKED_IN"
    assert payload["tag_number"]


def test_baggage_status_can_be_updated(monkeypatch):
    client, main, _, _, _ = load_service_app("baggage_service")
    monkeypatch.setattr(main, "send_event", lambda *args, **kwargs: None)

    create_response = client.post(
        "/baggage",
        params={
            "passenger_name": unique_name("passenger"),
            "flight_id": 202,
            "tag_number": unique_name("TAG"),
        },
    )
    baggage_id = create_response.json()["id"]

    update_response = client.patch(
        f"/baggage/{baggage_id}/status",
        params={"new_status": "LOADED"},
    )

    assert update_response.status_code == 200
    payload = update_response.json()
    assert payload["message"] == "Baggage status updated and broadcasted"
    assert payload["baggage"]["status"] == "LOADED"
