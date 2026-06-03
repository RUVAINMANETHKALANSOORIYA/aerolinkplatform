import os
import uuid
from datetime import datetime
from decimal import Decimal
from functools import lru_cache
from typing import Any, Optional, Union

import boto3
from boto3.dynamodb.conditions import Attr, Key
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = os.getenv("BOOKING_DATABASE_URL", "sqlite:///./bookings.db")
BOOKING_STORAGE_BACKEND = os.getenv("BOOKING_STORAGE_BACKEND", "sqlite").strip().lower()
BOOKING_TABLE_NAME = os.getenv("BOOKING_TABLE_NAME", "AeroLinkBookings")
NOTIFICATION_TABLE_NAME = os.getenv("NOTIFICATION_TABLE_NAME", "AeroLinkNotifications")
NOTIFICATION_PASSENGER_INDEX = os.getenv("NOTIFICATION_PASSENGER_INDEX", "passenger_sub-created_at-index")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def use_dynamodb() -> bool:
    return BOOKING_STORAGE_BACKEND == "dynamodb"


@lru_cache(maxsize=1)
def get_dynamodb_resource():
    return boto3.resource("dynamodb", region_name=AWS_REGION)


def booking_table():
    return get_dynamodb_resource().Table(BOOKING_TABLE_NAME)


def backend_health() -> str:
    if not use_dynamodb():
        return "not_configured"
    booking_table().load()
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


def create_booking_item(
    passenger_sub: str,
    passenger_name: str, 
    flight_id: str, 
    flight_no: str,
    origin: str,
    destination: str,
    seat_count: int,
    unit_price: float,
    total_amount: float,
    status: str = "PENDING_PAYMENT"
) -> dict[str, Any]:
    now = datetime.utcnow().isoformat() + "Z"
    booking = {
        "booking_id": str(uuid.uuid4()),
        "passenger_sub": passenger_sub,
        "passenger_name": passenger_name,
        "flight_id": str(flight_id),
        "flight_no": flight_no,
        "origin": origin,
        "destination": destination,
        "seat_count": seat_count,
        "unit_price": unit_price,
        "total_amount": total_amount,
        "status": status,
        "created_at": now,
        "updated_at": now,
    }
    booking_table().put_item(Item=_to_dynamo_value(booking))
    return _normalize_item(booking)

def list_passenger_bookings_item(passenger_sub: str) -> list[dict[str, Any]]:
    response = booking_table().scan(
        FilterExpression=Attr("passenger_sub").eq(passenger_sub)
    )
    items = response.get("Items", [])
    normalized = [_normalize_item(item) for item in items]
    return sorted(normalized, key=lambda item: str(item.get("created_at", "")), reverse=True)

def list_booking_items() -> list[dict[str, Any]]:
    response = booking_table().scan()
    items = response.get("Items", [])
    normalized = [_normalize_item(item) for item in items]
    return sorted(normalized, key=lambda item: str(item.get("created_at", "")), reverse=True)


def list_notification_items_for_passenger(passenger_sub: str) -> list[dict[str, Any]]:
    table = get_dynamodb_resource().Table(NOTIFICATION_TABLE_NAME)
    response = table.query(
        IndexName=NOTIFICATION_PASSENGER_INDEX,
        KeyConditionExpression=Key("passenger_sub").eq(passenger_sub),
        ScanIndexForward=False
    )
    items = response.get("Items", [])
    return [_normalize_item(item) for item in items]


def get_booking_item(booking_id: str) -> Optional[dict[str, Any]]:
    item = booking_table().get_item(Key={"booking_id": str(booking_id)}).get("Item")
    return _normalize_item(item) if item else None


def update_booking_status_item(booking_id: str, status: str) -> Optional[dict[str, Any]]:
    now = datetime.utcnow().isoformat() + "Z"
    try:
        booking_table().update_item(
            Key={"booking_id": str(booking_id)},
            UpdateExpression="SET #status = :status, updated_at = :updated_at",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={":status": status, ":updated_at": now},
            ConditionExpression="attribute_exists(booking_id)",
        )
    except Exception:
        return None
    return get_booking_item(booking_id)