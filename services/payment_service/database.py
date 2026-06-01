import os
import uuid
from datetime import datetime
from decimal import Decimal
from functools import lru_cache
from typing import Any

import boto3
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


SQLALCHEMY_DATABASE_URL = os.getenv("PAYMENT_DATABASE_URL", "sqlite:///./payment.db")
PAYMENT_STORAGE_BACKEND = os.getenv("PAYMENT_STORAGE_BACKEND", "sqlite").strip().lower()
PAYMENT_TABLE_NAME = os.getenv("PAYMENT_TABLE_NAME", "AeroLinkPayments")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def use_dynamodb() -> bool:
    return PAYMENT_STORAGE_BACKEND == "dynamodb"


@lru_cache(maxsize=1)
def get_dynamodb_resource():
    return boto3.resource("dynamodb", region_name=AWS_REGION)


def payment_table():
    return get_dynamodb_resource().Table(PAYMENT_TABLE_NAME)


def backend_health() -> str:
    if not use_dynamodb():
        return "not_configured"
    payment_table().load()
    return "ok"


def _normalize_item(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _normalize_item(inner) for key, inner in value.items()}
    if isinstance(value, list):
        return [_normalize_item(item) for item in value]
    if isinstance(value, Decimal):
        if value % 1 == 0:
            return int(value)
        return float(value)
    return value


def _to_dynamo_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _to_dynamo_value(inner) for key, inner in value.items()}
    if isinstance(value, list):
        return [_to_dynamo_value(item) for item in value]
    if isinstance(value, float):
        return Decimal(str(value))
    return value


def create_payment_item(
    booking_id: str | int,
    amount: float,
    payment_method: str,
    payment_status: str,
    transaction_reference: str,
) -> dict[str, Any]:
    payment = {
        "payment_id": str(uuid.uuid4()),
        "booking_id": str(booking_id),
        "amount": amount,
        "payment_method": payment_method,
        "payment_status": payment_status,
        "transaction_reference": transaction_reference,
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    payment_table().put_item(Item=_to_dynamo_value(payment))
    return _normalize_item(payment)


def get_payment_item(payment_id: str) -> dict[str, Any] | None:
    item = payment_table().get_item(Key={"payment_id": str(payment_id)}).get("Item")
    return _normalize_item(item) if item else None


def list_payment_items() -> list[dict[str, Any]]:
    items = payment_table().scan().get("Items", [])
    normalized = [_normalize_item(item) for item in items]
    return sorted(normalized, key=lambda item: str(item.get("created_at", "")), reverse=True)


def get_payment_items_by_booking(booking_id: str | int) -> list[dict[str, Any]]:
    target_booking_id = str(booking_id)
    return [item for item in list_payment_items() if str(item.get("booking_id")) == target_booking_id]
