import os
import uuid
from datetime import datetime
from decimal import Decimal
from functools import lru_cache
from typing import Any, Optional, Union

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

BAGGAGE_TABLE_NAME = os.getenv("BAGGAGE_TABLE_NAME", "AeroLinkBaggage")
BAGGAGE_PASSENGER_INDEX = os.getenv("BAGGAGE_PASSENGER_INDEX", "passenger_sub-updated_at-index")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")


@lru_cache(maxsize=1)
def get_dynamodb_resource():
    return boto3.resource("dynamodb", region_name=AWS_REGION)


def baggage_table():
    return get_dynamodb_resource().Table(BAGGAGE_TABLE_NAME)


def backend_health() -> str:
    baggage_table().load()
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


def create_baggage_item(
    booking_id: str,
    passenger_sub: str,
    flight_id: str,
    flight_no: str,
    origin: str,
    destination: str,
    tag_number: str,
    weight_kg: Optional[float] = None,
    status: str = "CHECKED_IN"
) -> dict[str, Any]:
    now = datetime.utcnow().isoformat() + "Z"
    baggage = {
        "baggage_id": str(uuid.uuid4()),
        "booking_id": booking_id,
        "passenger_sub": passenger_sub,
        "flight_id": flight_id,
        "flight_no": flight_no,
        "origin": origin,
        "destination": destination,
        "tag_number": tag_number,
        "status": status,
        "created_at": now,
        "updated_at": now,
    }
    if weight_kg is not None:
        baggage["weight_kg"] = weight_kg
    baggage_table().put_item(Item=_to_dynamo_value(baggage))
    return _normalize_item(baggage)


def check_tag_exists(tag_number: str) -> bool:
    scan_kwargs = {
        "FilterExpression": Attr("tag_number").eq(tag_number),
        "ProjectionExpression": "tag_number",
    }

    while True:
        response = baggage_table().scan(**scan_kwargs)
        if response.get("Items"):
            return True

        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            return False

        scan_kwargs["ExclusiveStartKey"] = last_key


def list_passenger_baggage_items(passenger_sub: str) -> list[dict[str, Any]]:
    response = baggage_table().query(
        IndexName=BAGGAGE_PASSENGER_INDEX,
        KeyConditionExpression=Key("passenger_sub").eq(passenger_sub),
        ScanIndexForward=False
    )
    items = response.get("Items", [])
    return [_normalize_item(item) for item in items]


def list_baggage_items() -> list[dict[str, Any]]:
    response = baggage_table().scan()
    items = response.get("Items", [])
    normalized = [_normalize_item(item) for item in items]
    return sorted(normalized, key=lambda item: str(item.get("created_at", "")), reverse=True)


def get_baggage_item(baggage_id: str) -> Optional[dict[str, Any]]:
    item = baggage_table().get_item(Key={"baggage_id": str(baggage_id)}).get("Item")
    return _normalize_item(item) if item else None


def update_baggage_status_item(baggage_id: str, status: str) -> Optional[dict[str, Any]]:
    now = datetime.utcnow().isoformat() + "Z"
    try:
        baggage_table().update_item(
            Key={"baggage_id": str(baggage_id)},
            UpdateExpression="SET #status = :status, updated_at = :updated_at",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={":status": status, ":updated_at": now},
            ConditionExpression="attribute_exists(baggage_id)",
        )
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return None
        raise e
    return get_baggage_item(baggage_id)
