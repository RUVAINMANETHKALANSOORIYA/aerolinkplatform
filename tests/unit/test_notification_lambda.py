import sys
from pathlib import Path
SERVICE_DIR = Path(__file__).resolve().parents[2] / "services"
sys.path.insert(0, str(SERVICE_DIR))

import pytest
from unittest.mock import MagicMock
import json

from payment_notification_lambda.lambda_function import lambda_handler
import payment_notification_lambda.lambda_function as lambda_main

@pytest.fixture
def mock_dynamo_table(monkeypatch):
    mock_table = MagicMock()
    monkeypatch.setattr(lambda_main, "_notifications_table", lambda: mock_table)
    return mock_table

def test_payment_succeeded_event(mock_dynamo_table):
    event = {"source": "aerolink.payment", "detail-type": "PaymentSucceeded", "detail": {"booking_id": "booking-123", "payment_id": "pay-123", "passenger_sub": "passenger-sub-test"}}
    lambda_handler(event, None)
    mock_dynamo_table.put_item.assert_called_once()
    item = mock_dynamo_table.put_item.call_args[1]["Item"]
    assert item["passenger_sub"] == "passenger-sub-test"
    assert item["event_type"] == "PaymentSucceeded"

def test_payment_failed_event(mock_dynamo_table):
    event = {"source": "aerolink.payment", "detail-type": "PaymentFailed", "detail": {"booking_id": "booking-123", "payment_id": "pay-123", "passenger_sub": "passenger-sub-test"}}
    lambda_handler(event, None)
    mock_dynamo_table.put_item.assert_called_once()
    item = mock_dynamo_table.put_item.call_args[1]["Item"]
    assert item["event_type"] == "PaymentFailed"

def test_unsupported_source_ignored(mock_dynamo_table):
    event = {"source": "unsupported.source", "detail-type": "PaymentSucceeded", "detail": {"passenger_sub": "test"}}
    lambda_handler(event, None)
    mock_dynamo_table.put_item.assert_not_called()

def test_unsupported_detail_type_ignored(mock_dynamo_table):
    event = {"source": "aerolink.payment", "detail-type": "UnsupportedType", "detail": {"passenger_sub": "test"}}
    lambda_handler(event, None)
    mock_dynamo_table.put_item.assert_not_called()

def test_missing_passenger_sub_ignored(mock_dynamo_table):
    event = {"source": "aerolink.payment", "detail-type": "PaymentSucceeded", "detail": {"booking_id": "booking-123"}}
    lambda_handler(event, None)
    mock_dynamo_table.put_item.assert_not_called()

def test_malformed_detail_ignored(mock_dynamo_table):
    event = {"source": "aerolink.payment", "detail-type": "PaymentSucceeded", "detail": "{invalid_json"}
    lambda_handler(event, None)
    mock_dynamo_table.put_item.assert_not_called()
