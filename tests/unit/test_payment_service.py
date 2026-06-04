import sys
from pathlib import Path
SERVICE_DIR = Path(__file__).resolve().parents[2] / "services" / "payment_service"
sys.path.insert(0, str(SERVICE_DIR))
for mod in ("main", "database", "models"):
    sys.modules.pop(mod, None)

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock

from main import app
import database

client = TestClient(app)

@pytest.fixture(autouse=True)
def mock_dynamodb(monkeypatch):
    monkeypatch.setattr(database, "use_dynamodb", lambda: True)
    monkeypatch.setattr(database, "backend_health", lambda: "ok")

@pytest.fixture
def mock_requests(monkeypatch):
    mock_get = MagicMock()
    mock_patch = MagicMock()
    monkeypatch.setattr("main.requests.get", mock_get)
    monkeypatch.setattr("main.requests.patch", mock_patch)
    return mock_get, mock_patch

@pytest.fixture
def mock_boto3(monkeypatch):
    mock_client = MagicMock()
    mock_boto_func = MagicMock(return_value=mock_client)
    monkeypatch.setattr("main.boto3.client", mock_boto_func)
    return mock_client

@pytest.fixture(autouse=True)
def enable_events(monkeypatch):
    monkeypatch.setattr("main.PAYMENT_EVENTS_ENABLED", True)

def test_payment_success_workflow(monkeypatch, mock_requests, mock_boto3):
    mock_get, mock_patch = mock_requests
    mock_get_response = MagicMock()
    mock_get_response.status_code = 200
    mock_get_response.json.return_value = {"id": "booking-test-001", "passenger_sub": "passenger-test-sub", "status": "PENDING_PAYMENT", "total_amount": 125.50}
    mock_get.return_value = mock_get_response
    mock_patch.return_value.status_code = 200

    def mock_create_payment(**kwargs):
        return {"payment_id": "pay-123", **kwargs, "created_at": "2026-01-01T00:00:00Z"}
    monkeypatch.setattr(database, "create_payment_item", mock_create_payment)

    response = client.post("/payments", json={"booking_id": "booking-test-001", "payment_result": "SUCCESS"}, headers={"x-passenger-sub": "passenger-test-sub"})
    assert response.status_code == 201
    assert response.json()["payment_status"] == "SUCCESS"
    mock_patch.assert_called_once()
    assert mock_patch.call_args[1]["json"]["status"] == "CONFIRMED"
    mock_boto3.put_events.assert_called_once()

def test_payment_failed_workflow(monkeypatch, mock_requests, mock_boto3):
    mock_get, mock_patch = mock_requests
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = {"id": "booking-test-001", "passenger_sub": "passenger-test-sub", "status": "PENDING_PAYMENT", "total_amount": 125.50}
    mock_patch.return_value.status_code = 200

    def mock_create_payment(**kwargs):
        return {"payment_id": "pay-123", **kwargs, "created_at": "2026-01-01T00:00:00Z"}
    monkeypatch.setattr(database, "create_payment_item", mock_create_payment)

    response = client.post("/payments", json={"booking_id": "booking-test-001", "payment_result": "FAILED"}, headers={"x-passenger-sub": "passenger-test-sub"})
    assert response.status_code == 201
    assert response.json()["payment_status"] == "FAILED"
    mock_patch.assert_called_once()
    assert mock_patch.call_args[1]["json"]["status"] == "PAYMENT_FAILED"
    mock_boto3.put_events.assert_called_once()
    assert mock_boto3.put_events.call_args[1]["Entries"][0]["DetailType"] == "PaymentFailed"

def test_payment_wrong_passenger(mock_requests):
    mock_get, _ = mock_requests
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = {"id": "booking-test-001", "passenger_sub": "other-passenger-sub", "status": "PENDING_PAYMENT", "total_amount": 125.50}
    response = client.post("/payments", json={"booking_id": "booking-test-001", "payment_result": "SUCCESS"}, headers={"x-passenger-sub": "passenger-test-sub"})
    assert response.status_code == 403

def test_payment_unsupported_result(mock_requests):
    response = client.post("/payments", json={"booking_id": "booking-test-001", "payment_result": "UNKNOWN"}, headers={"x-passenger-sub": "passenger-test-sub"})
    assert response.status_code == 400

def test_payment_already_completed(mock_requests):
    mock_get, _ = mock_requests
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = {"id": "booking-test-001", "passenger_sub": "passenger-test-sub", "status": "CONFIRMED", "total_amount": 125.50}
    response = client.post("/payments", json={"booking_id": "booking-test-001", "payment_result": "SUCCESS"}, headers={"x-passenger-sub": "passenger-test-sub"})
    assert response.status_code == 400

def test_payment_no_extra_card_data(mock_requests):
    response = client.post("/payments", json={"booking_id": "booking-test-001", "payment_result": "SUCCESS", "card_number": "1234"}, headers={"x-passenger-sub": "passenger-test-sub"})
    assert response.status_code == 422
