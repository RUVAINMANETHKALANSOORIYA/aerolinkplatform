import pytest

from tests.helpers import load_service_app


pytestmark = pytest.mark.unit


def test_create_payment_success_updates_booking(monkeypatch):
    client, main, models, database, _ = load_service_app("payment_service")
    captured = {}

    def fake_patch(url, json=None, timeout=None):
        captured["url"] = url
        captured["json"] = json

        class Response:
            status_code = 200

        return Response()

    monkeypatch.setattr(main.requests, "patch", fake_patch)

    response = client.post(
        "/payments",
        json={
            "booking_id": 101,
            "amount": 125.5,
            "payment_method": "CARD",
            "payment_result": "SUCCESS",
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["booking_id"] == 101
    assert payload["payment_status"] == "SUCCESS"
    assert payload["transaction_reference"].startswith("PAY-")
    assert captured["json"] == {"status": "CONFIRMED"}

    with database.SessionLocal() as db:
        payment = db.query(models.Payment).one()
        assert payment.booking_id == 101
        assert payment.payment_method == "CARD"
        assert payment.payment_status == "SUCCESS"


def test_unsafe_fields_are_rejected():
    client, _, _, _, _ = load_service_app("payment_service")

    response = client.post(
        "/payments",
        json={
            "booking_id": 101,
            "amount": 125.5,
            "payment_method": "CARD",
            "payment_result": "SUCCESS",
            "card_number": "4111111111111111",
        },
    )

    assert response.status_code == 422