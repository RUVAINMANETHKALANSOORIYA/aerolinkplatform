"""Payment Notification Lambda

Triggered by EventBridge when the Payment Service publishes a
PaymentSucceeded or PaymentFailed event.

Accepted events
---------------
- source       : "aerolink.payment"
- detail-type  : "PaymentSucceeded" | "PaymentFailed"

All other events are silently ignored (no DynamoDB write).

Stored notification fields
--------------------------
notification_id, booking_id, payment_id, event_type,
title, message, notification_status, created_at.

No payment credentials, card numbers, CVV, expiry dates,
banking details or authentication tokens are stored.
"""
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import boto3

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# ── Configuration ─────────────────────────────────────────────────────────────
NOTIFICATIONS_TABLE = os.getenv("NOTIFICATIONS_TABLE", "AeroLinkNotifications")
ACCEPTED_SOURCE = "aerolink.payment"

# Notification copy for each event type
NOTIFICATION_MAP: dict[str, dict[str, str]] = {
    "PaymentSucceeded": {
        "title": "Payment confirmed",
        "message": "Your simulated payment was successful and your booking is confirmed.",
    },
    "PaymentFailed": {
        "title": "Payment unsuccessful",
        "message": "Your simulated payment was unsuccessful. Please try again.",
    },
}

# ── DynamoDB ──────────────────────────────────────────────────────────────────
_dynamodb = boto3.resource("dynamodb")


def _notifications_table():
    return _dynamodb.Table(NOTIFICATIONS_TABLE)


# ── Handler ───────────────────────────────────────────────────────────────────

def lambda_handler(event: dict[str, Any], context: Any) -> None:
    """EventBridge Lambda handler for payment notification events.

    Parameters
    ----------
    event:
        The EventBridge event envelope delivered by AWS Lambda.
    context:
        The Lambda execution context (unused).
    """
    source = event.get("source", "")
    detail_type = event.get("detail-type", "")

    # Ignore events from unrelated sources or with unrelated detail types.
    if source != ACCEPTED_SOURCE:
        logger.info("Ignoring event with unrelated source: %s", source)
        return

    notification_config = NOTIFICATION_MAP.get(detail_type)
    if notification_config is None:
        logger.info("Ignoring event with unrelated detail-type: %s", detail_type)
        return

    detail: dict[str, Any] = event.get("detail", {})
    if isinstance(detail, str):
        # EventBridge may deliver detail as a JSON string in some test scenarios.
        try:
            detail = json.loads(detail)
        except json.JSONDecodeError:
            logger.error("Could not parse event detail as JSON; skipping.")
            return

    # Extract only the safe, non-sensitive identifiers from the detail.
    booking_id = str(detail.get("booking_id", ""))
    payment_id = str(detail.get("payment_id", ""))

    notification_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    item = {
        "notification_id": notification_id,
        "booking_id": booking_id,
        "payment_id": payment_id,
        "event_type": detail_type,
        "title": notification_config["title"],
        "message": notification_config["message"],
        "notification_status": "UNREAD",
        "created_at": created_at,
    }

    _notifications_table().put_item(Item=item)
    logger.info(
        "Notification stored",
        extra={
            "notification_id": notification_id,
            "event_type": detail_type,
            "booking_id": booking_id,
        },
    )
