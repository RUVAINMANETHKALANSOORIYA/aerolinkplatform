"""tests/test_payment_notification_lambda.py

Mock-only tests for services/payment_notification_lambda/lambda_function.py.
No real AWS connections are made.

Scenarios covered
-----------------
1. PaymentSucceeded event creates an UNREAD notification with correct title/message.
2. PaymentFailed event creates an UNREAD notification with correct title/message.
3. Event with unrelated source does not write to DynamoDB.
4. Event with unrelated detail-type does not write to DynamoDB.
"""
import importlib
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


pytestmark = pytest.mark.unit

# ── Module loading helper ─────────────────────────────────────────────────────

def _load_lambda():
    """Import the notification Lambda module fresh for each test."""
    module_path = str(
        Path(__file__).resolve().parents[1]
        / "services"
        / "payment_notification_lambda"
    )
    for mod in list(sys.modules.keys()):
        if "payment_notification_lambda" in mod:
            del sys.modules[mod]

    sys.path.insert(0, module_path)
    try:
        lf = importlib.import_module("lambda_function")
    finally:
        if sys.path and sys.path[0] == module_path:
            sys.path.pop(0)
    return lf


# ── Fake DynamoDB table ───────────────────────────────────────────────────────

class _FakeTable:
    def __init__(self):
        self.stored_items: list[dict] = []

    def put_item(self, Item: dict):
        self.stored_items.append(dict(Item))


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestPaymentSucceededNotification:
    """PaymentSucceeded event → UNREAD notification with correct copy."""

    def test_notification_stored_with_unread_status(self):
        lf = _load_lambda()
        fake_table = _FakeTable()
        lf._dynamodb = MagicMock()
        lf._dynamodb.Table.return_value = fake_table

        event = {
            "source": "aerolink.payment",
            "detail-type": "PaymentSucceeded",
            "detail": {
                "payment_id": "pay-001",
                "booking_id": "book-001",
                "payment_status": "SUCCESS",
                "booking_status": "CONFIRMED",
                "transaction_reference": "PAY-ABCDEF",
                "created_at": "2026-06-01T00:00:00Z",
            },
        }

        lf.lambda_handler(event, context=None)

        assert len(fake_table.stored_items) == 1
        item = fake_table.stored_items[0]
        assert item["notification_status"] == "UNREAD"
        assert item["event_type"] == "PaymentSucceeded"
        assert item["title"] == "Payment confirmed"
        assert "successful" in item["message"].lower()
        assert item["booking_id"] == "book-001"
        assert item["payment_id"] == "pay-001"
        assert "notification_id" in item
        assert "created_at" in item

    def test_no_sensitive_fields_stored(self):
        lf = _load_lambda()
        fake_table = _FakeTable()
        lf._dynamodb = MagicMock()
        lf._dynamodb.Table.return_value = fake_table

        event = {
            "source": "aerolink.payment",
            "detail-type": "PaymentSucceeded",
            "detail": {
                "payment_id": "pay-002",
                "booking_id": "book-002",
                "payment_status": "SUCCESS",
                "booking_status": "CONFIRMED",
                "transaction_reference": "PAY-XYZ",
                "created_at": "2026-06-01T00:00:00Z",
            },
        }

        lf.lambda_handler(event, context=None)

        assert len(fake_table.stored_items) == 1
        item = fake_table.stored_items[0]
        for forbidden in ("amount", "card_number", "cvv", "expiry", "password", "token", "payment_status"):
            assert forbidden not in item, (
                f"Sensitive field '{forbidden}' must not appear in stored notification"
            )


class TestPaymentFailedNotification:
    """PaymentFailed event → UNREAD notification with correct copy."""

    def test_notification_stored_with_correct_message(self):
        lf = _load_lambda()
        fake_table = _FakeTable()
        lf._dynamodb = MagicMock()
        lf._dynamodb.Table.return_value = fake_table

        event = {
            "source": "aerolink.payment",
            "detail-type": "PaymentFailed",
            "detail": {
                "payment_id": "pay-003",
                "booking_id": "book-003",
                "payment_status": "FAILED",
                "booking_status": "PAYMENT_FAILED",
                "transaction_reference": "PAY-FAIL01",
                "created_at": "2026-06-01T00:00:00Z",
            },
        }

        lf.lambda_handler(event, context=None)

        assert len(fake_table.stored_items) == 1
        item = fake_table.stored_items[0]
        assert item["notification_status"] == "UNREAD"
        assert item["event_type"] == "PaymentFailed"
        assert item["title"] == "Payment unsuccessful"
        assert "unsuccessful" in item["message"].lower()
        assert item["booking_id"] == "book-003"
        assert item["payment_id"] == "pay-003"


class TestUnrelatedSourceIgnored:
    """Events from a different source must not write to DynamoDB."""

    def test_unrelated_source_skipped(self):
        lf = _load_lambda()
        fake_table = _FakeTable()
        lf._dynamodb = MagicMock()
        lf._dynamodb.Table.return_value = fake_table

        event = {
            "source": "com.someother.service",
            "detail-type": "PaymentSucceeded",
            "detail": {
                "payment_id": "pay-999",
                "booking_id": "book-999",
            },
        }

        lf.lambda_handler(event, context=None)

        assert len(fake_table.stored_items) == 0, (
            "DynamoDB must not be written for events from unrelated sources"
        )


class TestUnrelatedDetailTypeIgnored:
    """Events with an unknown detail-type must not write to DynamoDB."""

    def test_unrelated_detail_type_skipped(self):
        lf = _load_lambda()
        fake_table = _FakeTable()
        lf._dynamodb = MagicMock()
        lf._dynamodb.Table.return_value = fake_table

        event = {
            "source": "aerolink.payment",
            "detail-type": "SomeOtherEvent",
            "detail": {
                "payment_id": "pay-888",
                "booking_id": "book-888",
            },
        }

        lf.lambda_handler(event, context=None)

        assert len(fake_table.stored_items) == 0, (
            "DynamoDB must not be written for events with unrelated detail-type"
        )
