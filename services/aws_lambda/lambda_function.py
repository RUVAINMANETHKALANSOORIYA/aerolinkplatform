import base64
import json
import os
import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import boto3
from botocore.exceptions import ClientError


DYNAMODB = boto3.resource("dynamodb")

USERS_TABLE = os.getenv("USERS_TABLE", "AeroLinkUsers")
FLIGHTS_TABLE = os.getenv("FLIGHTS_TABLE", "AeroLinkFlights")
BOOKINGS_TABLE = os.getenv("BOOKINGS_TABLE", "AeroLinkBookings")
BAGGAGE_TABLE = os.getenv("BAGGAGE_TABLE", "AeroLinkBaggage")
SCHEDULES_TABLE = os.getenv("SCHEDULES_TABLE", "AeroLinkSchedules")
NOTIFICATIONS_TABLE = os.getenv("NOTIFICATIONS_TABLE", "AeroLinkNotifications")

CORS_ORIGIN = "https://main.d1qn3y6dlgkh7a.amplifyapp.com"

CORS_HEADERS = {
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Content-Type": "application/json",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def json_default(value: Any) -> Any:
    if isinstance(value, Decimal):
        if value % 1 == 0:
            return int(value)
        return float(value)
    if isinstance(value, datetime):
        return value.isoformat()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def normalize_item(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: normalize_item(inner) for key, inner in value.items()}
    if isinstance(value, list):
        return [normalize_item(item) for item in value]
    if isinstance(value, Decimal):
        if value % 1 == 0:
            return int(value)
        return float(value)
    return value


def to_dynamo_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: to_dynamo_value(inner) for key, inner in value.items()}
    if isinstance(value, list):
        return [to_dynamo_value(item) for item in value]
    if isinstance(value, float):
        return Decimal(str(value))
    return value


def response(status_code: int, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": dict(CORS_HEADERS),
        "body": json.dumps(payload, default=json_default),
    }


def table(name: str):
    return DYNAMODB.Table(name)


def api_method(event: dict[str, Any]) -> str:
    request_context = event.get("requestContext", {})
    http = request_context.get("http", {})
    return (http.get("method") or event.get("httpMethod") or "GET").upper()


def api_path(event: dict[str, Any]) -> str:
    path = event.get("rawPath") or event.get("path") or "/"
    stage = event.get("requestContext", {}).get("stage")
    if stage:
        stage_prefix = f"/{stage}"
        if path.startswith(stage_prefix):
            path = path[len(stage_prefix):] or "/"
    path = path.split("?", 1)[0]
    if not path.startswith("/"):
        path = f"/{path}"
    return path.rstrip("/") or "/"


def parse_body(event: dict[str, Any]) -> dict[str, Any]:
    body = event.get("body")
    if not body:
        return {}
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")
    if isinstance(body, dict):
        return body
    if isinstance(body, str):
        body = body.strip()
        if not body:
            return {}
        return json.loads(body)
    return {}


def scan_items(table_name: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    scan_kwargs: dict[str, Any] = {}
    result = table(table_name).scan(**scan_kwargs)
    items.extend(result.get("Items", []))
    while result.get("LastEvaluatedKey"):
        scan_kwargs["ExclusiveStartKey"] = result["LastEvaluatedKey"]
        result = table(table_name).scan(**scan_kwargs)
        items.extend(result.get("Items", []))
    return normalize_item(items)


def get_item(table_name: str, key_name: str, key_value: str) -> dict[str, Any] | None:
    item = table(table_name).get_item(Key={key_name: key_value}).get("Item")
    if not item:
        return None
    return normalize_item(item)


def create_item(table_name: str, id_field: str, body: dict[str, Any], extra_fields: dict[str, Any] | None = None) -> dict[str, Any]:
    now = utc_now()
    item = {key: value for key, value in body.items() if key != id_field}
    item[id_field] = str(uuid.uuid4())
    if extra_fields:
        item.update(extra_fields)
    item.setdefault("created_at", now)
    item["updated_at"] = now
    table(table_name).put_item(Item=to_dynamo_value(item))
    return normalize_item(item)


def create_notification(message: str, notification_type: str, related_id: str | None = None) -> dict[str, Any]:
    now = utc_now()
    notification = {
        "notification_id": str(uuid.uuid4()),
        "message": message,
        "notification_type": notification_type,
        "related_id": related_id,
        "read": False,
        "created_at": now,
        "updated_at": now,
    }
    table(NOTIFICATIONS_TABLE).put_item(Item=to_dynamo_value(notification))
    return normalize_item(notification)


def build_partial_update_expression(updates: dict[str, Any], excluded_fields: set[str] | None = None) -> tuple[str, dict[str, str], dict[str, Any]]:
    excluded_fields = excluded_fields or set()
    filtered_updates = {key: value for key, value in updates.items() if key not in excluded_fields and value is not None}
    if not filtered_updates:
        raise ValueError("At least one field is required")

    expression_attribute_names = {"#updated_at": "updated_at"}
    expression_attribute_values: dict[str, Any] = {":updated_at": utc_now()}
    set_parts = []

    for field_name, field_value in filtered_updates.items():
        name_key = f"#{field_name}"
        value_key = f":{field_name}"
        expression_attribute_names[name_key] = field_name
        expression_attribute_values[value_key] = to_dynamo_value(field_value)
        set_parts.append(f"{name_key} = {value_key}")

    set_parts.append("#updated_at = :updated_at")
    return "SET " + ", ".join(set_parts), expression_attribute_names, expression_attribute_values


def get_required_int(body: dict[str, Any], field_name: str, default: int | None = None) -> int:
    if field_name not in body or body[field_name] in (None, ""):
        if default is None:
            raise ValueError(f"Missing required field: {field_name}")
        return default
    return int(body[field_name])


def health_handler() -> dict[str, Any]:
    return response(
        200,
        {
            "message": "AeroLink Lambda is healthy",
            "item": {
                "status": "ok",
                "timestamp": utc_now(),
                "tables": [
                    USERS_TABLE,
                    FLIGHTS_TABLE,
                    BOOKINGS_TABLE,
                    BAGGAGE_TABLE,
                    SCHEDULES_TABLE,
                    NOTIFICATIONS_TABLE,
                ],
            },
        },
    )


def create_flight(body: dict[str, Any]) -> dict[str, Any]:
    total_seats = get_required_int(body, "total_seats", 0)
    available_seats = int(body.get("available_seats", total_seats))
    flight = create_item(
        FLIGHTS_TABLE,
        "flight_id",
        body,
        extra_fields={"total_seats": total_seats, "available_seats": available_seats},
    )
    return response(201, {"message": "Flight created successfully", "item": flight})


def create_booking(body: dict[str, Any]) -> dict[str, Any]:
    flight_id = body.get("flight_id")
    if not flight_id:
        return response(400, {"message": "flight_id is required", "item": {"error": "flight_id is required"}})

    seat_count = get_required_int(body, "seat_count", 1)
    if seat_count < 1:
        return response(400, {"message": "seat_count must be at least 1", "item": {"error": "seat_count must be at least 1"}})

    flight = table(FLIGHTS_TABLE).get_item(Key={"flight_id": flight_id}).get("Item")
    if not flight:
        return response(404, {"message": "Flight not found", "item": {"flight_id": flight_id}})

    available_seats = int(flight.get("available_seats", flight.get("total_seats", 0)))
    if available_seats < seat_count:
        return response(
            409,
            {
                "message": "Not enough available seats",
                "item": {
                    "flight_id": flight_id,
                    "available_seats": available_seats,
                    "seat_count": seat_count,
                },
            },
        )

    now = utc_now()
    try:
        table(FLIGHTS_TABLE).update_item(
            Key={"flight_id": flight_id},
            UpdateExpression="SET available_seats = available_seats - :seat_count, updated_at = :updated_at",
            ConditionExpression="attribute_exists(flight_id) AND available_seats >= :seat_count",
            ExpressionAttributeValues={
                ":seat_count": seat_count,
                ":updated_at": now,
            },
        )
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return response(
                409,
                {
                    "message": "Not enough available seats",
                    "item": {
                        "flight_id": flight_id,
                        "available_seats": available_seats,
                        "seat_count": seat_count,
                    },
                },
            )
        raise

    booking = {
        "booking_id": str(uuid.uuid4()),
        "flight_id": flight_id,
        "passenger_name": body.get("passenger_name", ""),
        "seat_count": seat_count,
        "status": body.get("status", "confirmed"),
        "created_at": now,
        "updated_at": now,
    }
    table(BOOKINGS_TABLE).put_item(Item=to_dynamo_value(booking))
    create_notification("Your booking has been confirmed.", "booking", booking["booking_id"])

    booking["available_seats"] = available_seats - seat_count
    return response(201, {"message": "Booking created successfully", "item": normalize_item(booking)})


def patch_flight_price(flight_id: str, body: dict[str, Any]) -> dict[str, Any]:
    if "price" not in body:
        return response(400, {"message": "price is required", "item": {"error": "price is required"}})

    now = utc_now()
    try:
        table(FLIGHTS_TABLE).update_item(
            Key={"flight_id": flight_id},
            UpdateExpression="SET price = :price, updated_at = :updated_at",
            ConditionExpression="attribute_exists(flight_id)",
            ExpressionAttributeValues={":price": to_dynamo_value(body["price"]), ":updated_at": now},
        )
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return response(404, {"message": "Flight not found", "item": {"flight_id": flight_id}})
        raise

    create_notification("A flight price has been updated.", "flight", flight_id)
    return response(200, {"message": "Flight price updated successfully", "item": get_item(FLIGHTS_TABLE, "flight_id", flight_id)})


def patch_flight_seats(flight_id: str, body: dict[str, Any]) -> dict[str, Any]:
    if "available_seats" in body:
        new_available_seats = get_required_int(body, "available_seats")
    elif "seats" in body:
        new_available_seats = get_required_int(body, "seats")
    else:
        return response(400, {"message": "available_seats is required", "item": {"error": "available_seats is required"}})

    updates: dict[str, Any] = {"available_seats": new_available_seats}
    if "total_seats" in body:
        updates["total_seats"] = get_required_int(body, "total_seats")

    update_expression, names, values = build_partial_update_expression(updates, {"flight_id"})
    try:
        table(FLIGHTS_TABLE).update_item(
            Key={"flight_id": flight_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ConditionExpression="attribute_exists(flight_id)",
        )
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return response(404, {"message": "Flight not found", "item": {"flight_id": flight_id}})
        raise

    return response(200, {"message": "Flight seats updated successfully", "item": get_item(FLIGHTS_TABLE, "flight_id", flight_id)})


def update_baggage_status(baggage_id: str, body: dict[str, Any]) -> dict[str, Any]:
    if "status" not in body:
        return response(400, {"message": "status is required", "item": {"error": "status is required"}})

    now = utc_now()
    try:
        table(BAGGAGE_TABLE).update_item(
            Key={"baggage_id": baggage_id},
            UpdateExpression="SET #status = :status, updated_at = :updated_at",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={":status": body["status"], ":updated_at": now},
            ConditionExpression="attribute_exists(baggage_id)",
        )
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return response(404, {"message": "Baggage not found", "item": {"baggage_id": baggage_id}})
        raise

    create_notification("Your baggage status has been updated.", "baggage", baggage_id)
    return response(200, {"message": "Baggage status updated successfully", "item": get_item(BAGGAGE_TABLE, "baggage_id", baggage_id)})


def update_schedule(schedule_id: str, body: dict[str, Any]) -> dict[str, Any]:
    update_expression, names, values = build_partial_update_expression(body, {"schedule_id"})
    if update_expression == "SET #updated_at = :updated_at":
        return response(400, {"message": "At least one schedule field is required", "item": {"error": "No schedule updates supplied"}})

    try:
        table(SCHEDULES_TABLE).update_item(
            Key={"schedule_id": schedule_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ConditionExpression="attribute_exists(schedule_id)",
        )
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return response(404, {"message": "Schedule not found", "item": {"schedule_id": schedule_id}})
        raise

    create_notification("Your flight schedule has changed.", "schedule", schedule_id)
    return response(200, {"message": "Schedule updated successfully", "item": get_item(SCHEDULES_TABLE, "schedule_id", schedule_id)})


def mark_notification_read(notification_id: str) -> dict[str, Any]:
    now = utc_now()
    try:
        table(NOTIFICATIONS_TABLE).update_item(
            Key={"notification_id": notification_id},
            UpdateExpression="SET #read = :read, updated_at = :updated_at",
            ExpressionAttributeNames={"#read": "read"},
            ExpressionAttributeValues={":read": True, ":updated_at": now},
            ConditionExpression="attribute_exists(notification_id)",
        )
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return response(404, {"message": "Notification not found", "item": {"notification_id": notification_id}})
        raise

    return response(200, {"message": "Notification marked as read", "item": get_item(NOTIFICATIONS_TABLE, "notification_id", notification_id)})


def route_request(event: dict[str, Any]) -> dict[str, Any]:
    method = api_method(event)
    path = api_path(event)

    if method == "OPTIONS":
        return response(200, {"message": "CORS preflight successful", "item": {"path": path}})

    if path == "/health" and method == "GET":
        return health_handler()

    body = parse_body(event)

    if path == "/users" and method == "POST":
        user = create_item(USERS_TABLE, "user_id", body)
        return response(201, {"message": "User created successfully", "item": user})
    if path == "/users" and method == "GET":
        return response(200, {"items": scan_items(USERS_TABLE)})

    if path == "/flights" and method == "POST":
        return create_flight(body)
    if path == "/flights" and method == "GET":
        return response(200, {"items": scan_items(FLIGHTS_TABLE)})

    match = re.fullmatch(r"/flights/([^/]+)/price", path)
    if match and method == "PATCH":
        return patch_flight_price(match.group(1), body)

    match = re.fullmatch(r"/flights/([^/]+)/seats", path)
    if match and method == "PATCH":
        return patch_flight_seats(match.group(1), body)

    if path == "/bookings" and method == "POST":
        return create_booking(body)
    if path == "/bookings" and method == "GET":
        return response(200, {"items": scan_items(BOOKINGS_TABLE)})

    if path == "/baggage" and method == "POST":
        baggage = create_item(BAGGAGE_TABLE, "baggage_id", body)
        return response(201, {"message": "Baggage created successfully", "item": baggage})
    if path == "/baggage" and method == "GET":
        return response(200, {"items": scan_items(BAGGAGE_TABLE)})

    match = re.fullmatch(r"/baggage/([^/]+)/status", path)
    if match and method == "PATCH":
        return update_baggage_status(match.group(1), body)

    if path == "/schedules" and method == "POST":
        schedule = create_item(SCHEDULES_TABLE, "schedule_id", body)
        return response(201, {"message": "Schedule created successfully", "item": schedule})
    if path == "/schedules" and method == "GET":
        return response(200, {"items": scan_items(SCHEDULES_TABLE)})

    match = re.fullmatch(r"/schedules/([^/]+)", path)
    if match and method == "PATCH":
        return update_schedule(match.group(1), body)

    if path == "/notifications" and method == "POST":
        message = body.get("message")
        if not message:
            return response(400, {"message": "message is required", "item": {"error": "message is required"}})
        notification = create_notification(message, body.get("notification_type", "manual"), body.get("related_id"))
        return response(201, {"message": "Notification created successfully", "item": notification})
    if path == "/notifications" and method == "GET":
        return response(200, {"items": scan_items(NOTIFICATIONS_TABLE)})

    match = re.fullmatch(r"/notifications/([^/]+)/read", path)
    if match and method == "PATCH":
        return mark_notification_read(match.group(1))

    return response(404, {"message": "Route not found", "item": {"method": method, "path": path}})


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    try:
        return route_request(event)
    except json.JSONDecodeError:
        return response(400, {"message": "Request body must be valid JSON", "item": {"error": "invalid_json"}})
    except ValueError as error:
        return response(400, {"message": str(error), "item": {"error": str(error)}})
    except ClientError as error:
        return response(
            500,
            {
                "message": "DynamoDB operation failed",
                "item": {"error": error.response.get("Error", {}).get("Message", "Unknown error")},
            },
        )
