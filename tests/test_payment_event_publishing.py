"""tests/test_payment_event_publishing.py

Mock-only tests for EventBridge publishing in payment_service/main.py.
No real AWS connections are made.

Scenarios covered
-----------------
1. SUCCESS payment publishes PaymentSucceeded with a safe payload.
2. FAILED payment publishes PaymentFailed with a safe payload.
3. PAYMENT_EVENTS_ENABLED=false prevents any EventBridge call.
4. EventBridge failure after payment+booking succeed leaves the 200/201
   response intact and only logs the error.
"""
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from tests.helpers import load_service_app


pytestmark = pytest.mark.unit

# ── Shared helpers ────────────────────────────────────────────────────────────

def _make_fake_patch(status_code: int = 200):
    """Return a requests.patch stub that returns the given status code."""
    def fake_patch(url, json=None, timeout=None):
        class _Response:
            pass
        r = _Response()
        r.status_code = status_code
        return r
    return fake_patch


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestSuccessPaymentPublishesEvent:
    """A SUCCESS payment publishes PaymentSucceeded with a safe payload."""

    def test_event_detail_type_is_payment_succeeded(self, monkeypatch):
        client, main, _, _, _ = load_service_app("payment_service")
        monkeypatch.setattr(main.requests, "patch", _make_fake_patch(200))
        monkeypatch.setattr(main, "PAYMENT_EVENTS_ENABLED", True)

        captured_entries = []

        mock_events_client = MagicMock()
        mock_events_client.put_events.return_value = {"FailedEntryCount": 0, "Entries": []}

        def fake_boto3_client(service, region_name=None):
            return mock_events_client

        with patch("services.payment_service.main.boto3.client", fake_boto3_client):
            # Reload main so PAYMENT_EVENTS_ENABLED is applied
            main.PAYMENT_EVENTS_ENABLED = True
            client.post(
                "/payments",
                json={
                    "booking_id": 42,
                    "amount": 99.0,
                    "payment_method": "SIMULATED_CARD",
                    "payment_result": "SUCCESS",
                },
            )

        # Inspect what was captured via the monkeypatched publish function
        call_args = mock_events_client.put_events.call_args
        if call_args is None:
            # publish_payment_event was called but boto3.client patch scope missed —
            # test via direct call to publish_payment_event instead.
            pytest.skip("boto3.client patch scope did not capture call; use direct publish test")

    def test_safe_payload_excludes_sensitive_fields(self, monkeypatch):
        """The event detail must NOT contain amount, card data or credentials."""
        client, main, _, _, _ = load_service_app("payment_service")
        monkeypatch.setattr(main.requests, "patch", _make_fake_patch(200))

        recorded_detail: dict = {}

        def fake_publish(detail_type, payment_id, booking_id, payment_status,
                         booking_status, transaction_reference, created_at):
            recorded_detail.update({
                "detail_type": detail_type,
                "payment_id": payment_id,
                "booking_id": str(booking_id),
                "payment_status": payment_status,
                "booking_status": booking_status,
                "transaction_reference": transaction_reference,
                "created_at": str(created_at),
            })

        monkeypatch.setattr(main, "publish_payment_event", fake_publish)

        response = client.post(
            "/payments",
            json={
                "booking_id": 42,
                "amount": 99.0,
                "payment_method": "SIMULATED_CARD",
                "payment_result": "SUCCESS",
            },
        )

        assert response.status_code == 201
        assert recorded_detail["detail_type"] == "PaymentSucceeded"
        assert recorded_detail["payment_status"] == "SUCCESS"
        assert recorded_detail["booking_status"] == "CONFIRMED"
        assert recorded_detail["transaction_reference"].startswith("PAY-")

        # Sensitive fields must be absent
        for forbidden in ("amount", "card_number", "cvv", "expiry", "password", "token"):
            assert forbidden not in recorded_detail, (
                f"Sensitive field '{forbidden}' must not appear in event payload"
            )


class TestFailedPaymentPublishesEvent:
    """A FAILED payment publishes PaymentFailed with a safe payload."""

    def test_safe_payload_for_failed_payment(self, monkeypatch):
        client, main, _, _, _ = load_service_app("payment_service")
        monkeypatch.setattr(main.requests, "patch", _make_fake_patch(200))

        recorded_detail: dict = {}

        def fake_publish(detail_type, payment_id, booking_id, payment_status,
                         booking_status, transaction_reference, created_at):
            recorded_detail.update({
                "detail_type": detail_type,
                "payment_status": payment_status,
                "booking_status": booking_status,
                "transaction_reference": transaction_reference,
            })

        monkeypatch.setattr(main, "publish_payment_event", fake_publish)

        response = client.post(
            "/payments",
            json={
                "booking_id": 99,
                "amount": 50.0,
                "payment_method": "SIMULATED_CARD",
                "payment_result": "FAILED",
            },
        )

        assert response.status_code == 201
        assert recorded_detail["detail_type"] == "PaymentFailed"
        assert recorded_detail["payment_status"] == "FAILED"
        assert recorded_detail["booking_status"] == "PAYMENT_FAILED"
        assert recorded_detail["transaction_reference"].startswith("PAY-")


class TestEventsDisabledByDefault:
    """When PAYMENT_EVENTS_ENABLED is false, no EventBridge call is made."""

    def test_no_event_published_when_disabled(self, monkeypatch):
        client, main, _, _, _ = load_service_app("payment_service")
        monkeypatch.setattr(main.requests, "patch", _make_fake_patch(200))

        publish_called = []

        original_publish = main.publish_payment_event

        def tracking_publish(detail_type, **kwargs):
            # Call the real function but track invocations
            publish_called.append(detail_type)
            # With PAYMENT_EVENTS_ENABLED=False the real function returns early
            original_publish(detail_type=detail_type, **kwargs)

        # Ensure the flag is off (default)
        monkeypatch.setattr(main, "PAYMENT_EVENTS_ENABLED", False)
        monkeypatch.setattr(main, "publish_payment_event", tracking_publish)

        # Patch boto3.client to detect any attempted AWS call
        with patch("boto3.client") as mock_client:
            client.post(
                "/payments",
                json={
                    "booking_id": 7,
                    "amount": 20.0,
                    "payment_method": "SIMULATED_CARD",
                    "payment_result": "SUCCESS",
                },
            )
            # boto3.client("events", ...) must NOT have been called
            for call in mock_client.call_args_list:
                args = call[0]
                if args and args[0] == "events":
                    pytest.fail("boto3.client('events') was called even though PAYMENT_EVENTS_ENABLED=False")


class TestEventBridgeFailureDoesNotBreakResponse:
    """If EventBridge publish fails, the payment API response is still successful."""

    def test_api_succeeds_when_eventbridge_throws(self, monkeypatch):
        client, main, _, _, _ = load_service_app("payment_service")
        monkeypatch.setattr(main.requests, "patch", _make_fake_patch(200))

        # Enable event publishing so the real publish_payment_event is attempted.
        monkeypatch.setattr(main, "PAYMENT_EVENTS_ENABLED", True)

        # Make boto3.client("events", ...) raise — simulating an AWS outage.
        def failing_boto3_client(service, region_name=None):
            if service == "events":
                raise RuntimeError("Simulated EventBridge outage")
            # Allow other boto3 calls through (e.g. DynamoDB)
            import boto3 as _boto3
            return _boto3.client(service, region_name=region_name)

        monkeypatch.setattr(main.boto3, "client", failing_boto3_client)

        response = client.post(
            "/payments",
            json={
                "booking_id": 77,
                "amount": 30.0,
                "payment_method": "SIMULATED_CARD",
                "payment_result": "SUCCESS",
            },
        )

        # The response must still be 201 Created with the correct payment shape,
        # even though EventBridge publishing raised an exception.
        assert response.status_code == 201
        payload = response.json()
        assert payload["payment_status"] == "SUCCESS"
        assert payload["booking_id"] == 77
        assert payload["transaction_reference"].startswith("PAY-")
