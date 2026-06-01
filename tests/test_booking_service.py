import pytest

from tests.helpers import load_service_app, unique_name


pytestmark = pytest.mark.unit


def test_new_bookings_start_pending_payment(monkeypatch):
    client, main, models, database, _ = load_service_app("booking_service")
    monkeypatch.setattr(main, "call_flight_service", lambda flight_id: None)

    response = client.post(
        "/bookings",
        params={"name": unique_name("passenger"), "flight_id": 77},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "PENDING_PAYMENT"

    with database.SessionLocal() as db:
        booking = db.query(models.Booking).one()
        assert booking.status == "PENDING_PAYMENT"


def test_booking_status_can_be_updated(monkeypatch):
    client, main, models, database, _ = load_service_app("booking_service")
    monkeypatch.setattr(main, "call_flight_service", lambda flight_id: None)

    create_response = client.post(
        "/bookings",
        params={"name": unique_name("passenger"), "flight_id": 88},
    )
    booking_id = create_response.json()["id"]

    update_response = client.patch(
        f"/bookings/{booking_id}/status",
        json={"status": "CONFIRMED"},
    )

    assert update_response.status_code == 200
    assert update_response.json()["status"] == "CONFIRMED"

    with database.SessionLocal() as db:
        booking = db.query(models.Booking).filter(models.Booking.id == booking_id).one()
        assert booking.status == "CONFIRMED"