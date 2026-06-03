import os
import uuid
from datetime import datetime
from decimal import Decimal
from functools import lru_cache
from typing import Any, Optional

import boto3
from botocore.exceptions import ClientError
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = os.getenv("FLIGHT_DATABASE_URL", "sqlite:///./flights.db")
FLIGHT_STORAGE_BACKEND = os.getenv("FLIGHT_STORAGE_BACKEND", "sqlite").strip().lower()
FLIGHT_TABLE_NAME = os.getenv("FLIGHT_TABLE_NAME", "AeroLinkFlights")
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
    return FLIGHT_STORAGE_BACKEND == "dynamodb"


@lru_cache(maxsize=1)
def get_dynamodb_resource():
    return boto3.resource("dynamodb", region_name=AWS_REGION)


def flight_table():
    return get_dynamodb_resource().Table(FLIGHT_TABLE_NAME)


def backend_health() -> str:
    if not use_dynamodb():
        return "not_configured"
    flight_table().load()
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


def create_flight_item(flight_no: str, seats: int, origin: str, destination: str, price: float) -> dict[str, Any]:
    now = datetime.utcnow().isoformat() + "Z"
    flight = {
        "flight_id": str(uuid.uuid4()),
        "flight_no": flight_no,
        "origin": origin,
        "destination": destination,
        "price": price,
        "total_seats": seats,
        "available_seats": seats,
        "created_at": now,
        "updated_at": now,
    }
    flight_table().put_item(Item=_to_dynamo_value(flight))
    return _normalize_item(flight)


def get_flight_item(flight_id: str) -> Optional[dict[str, Any]]:
    item = flight_table().get_item(Key={"flight_id": str(flight_id)}).get("Item")
    return _normalize_item(item) if item else None


def list_flight_items() -> list[dict[str, Any]]:
    items = flight_table().scan().get("Items", [])
    normalized = [_normalize_item(item) for item in items]
    return sorted(normalized, key=lambda item: str(item.get("created_at", "")), reverse=True)


def reserve_seat_item(flight_id: str, seat_count: int = 1) -> Optional[dict[str, Any]]:
    now = datetime.utcnow().isoformat() + "Z"
    try:
        response = flight_table().update_item(
            Key={"flight_id": str(flight_id)},
            UpdateExpression="SET available_seats = available_seats - :count, updated_at = :updated_at",
            ExpressionAttributeValues={
                ":count": seat_count,
                ":updated_at": now
            },
            ConditionExpression="attribute_exists(flight_id) AND available_seats >= :count",
            ReturnValues="ALL_NEW"
        )
        return _normalize_item(response.get("Attributes"))
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return None
        raise


def update_price_item(flight_id: str, new_price: float) -> Optional[dict[str, Any]]:
    now = datetime.utcnow().isoformat() + "Z"
    try:
        response = flight_table().update_item(
            Key={"flight_id": str(flight_id)},
            UpdateExpression="SET price = :price, updated_at = :updated_at",
            ExpressionAttributeValues={
                ":price": _to_dynamo_value(new_price),
                ":updated_at": now
            },
            ConditionExpression="attribute_exists(flight_id)",
            ReturnValues="ALL_NEW"
        )
        return _normalize_item(response.get("Attributes"))
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return None
        raise