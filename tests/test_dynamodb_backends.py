import importlib
import sys
from pathlib import Path

import pytest


pytestmark = pytest.mark.unit


class FakeTable:
    def __init__(self):
        self.items: dict[str, dict] = {}

    def put_item(self, Item):
        self.items[str(Item[self.key_name])] = dict(Item)

    def get_item(self, Key):
        return {"Item": self.items.get(str(next(iter(Key.values()))))}

    def update_item(self, Key, UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues, ConditionExpression):
        key_value = str(next(iter(Key.values())))
        item = self.items.get(key_value)
        if not item:
            raise Exception("not found")
        for name_token, field_name in ExpressionAttributeNames.items():
            if field_name == "status":
                item[field_name] = ExpressionAttributeValues[":status"]
        item["updated_at"] = ExpressionAttributeValues[":updated_at"]

    def load(self):
        return None

    def scan(self):
        return {"Items": list(self.items.values())}


class FakeResource:
    def __init__(self, table_name: str):
        self.table = FakeTable()
        self.table.key_name = "payment_id" if "Payment" in table_name else "booking_id"

    def Table(self, name):
        return self.table


def _import_service_database(service_name: str, monkeypatch, backend: str, table_name: str):
    service_dir = Path(__file__).resolve().parents[1] / "services" / service_name
    monkeypatch.setenv(f"{service_name.split('_')[0].upper()}_STORAGE_BACKEND", backend)
    monkeypatch.setenv(f"{service_name.split('_')[0].upper()}_TABLE_NAME", table_name)
    monkeypatch.setenv("AWS_REGION", "us-east-1")

    for module_name in ("database", "models", "main"):
        sys.modules.pop(module_name, None)

    sys.path.insert(0, str(service_dir))
    try:
        database = importlib.import_module("database")
        database.get_dynamodb_resource.cache_clear()
        return database
    finally:
        if sys.path and sys.path[0] == str(service_dir):
            sys.path.pop(0)


def test_booking_dynamodb_backend_roundtrip(monkeypatch):
    database = _import_service_database("booking_service", monkeypatch, "dynamodb", "AeroLinkBookings")
    fake_resource = FakeResource("AeroLinkBookings")
    monkeypatch.setattr(database, "get_dynamodb_resource", lambda: fake_resource)

    assert database.use_dynamodb()

    created = database.create_booking_item("alice", 7)
    assert created["passenger_name"] == "alice"
    assert created["status"] == "PENDING_PAYMENT"
    assert created["booking_id"]

    fetched = database.get_booking_item(created["booking_id"])
    assert fetched["booking_id"] == created["booking_id"]

    updated = database.update_booking_status_item(created["booking_id"], "CONFIRMED")
    assert updated["status"] == "CONFIRMED"


def test_payment_dynamodb_backend_roundtrip(monkeypatch):
    database = _import_service_database("payment_service", monkeypatch, "dynamodb", "AeroLinkPayments")
    fake_resource = FakeResource("AeroLinkPayments")
    monkeypatch.setattr(database, "get_dynamodb_resource", lambda: fake_resource)

    assert database.use_dynamodb()

    created = database.create_payment_item("abc-123", 42.5, "SIMULATED_CARD", "SUCCESS", "PAY-TEST")
    assert created["booking_id"] == "abc-123"
    assert created["payment_status"] == "SUCCESS"
    assert created["payment_id"]

    fetched = database.get_payment_item(created["payment_id"])
    assert fetched["payment_id"] == created["payment_id"]

    by_booking = database.get_payment_items_by_booking("abc-123")
    assert len(by_booking) == 1
    assert by_booking[0]["payment_id"] == created["payment_id"]