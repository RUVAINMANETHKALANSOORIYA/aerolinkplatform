"""
AeroLink Event Consumer
-----------------------
Listens to the 'aerolink_events' RabbitMQ queue and processes
events published by other services (e.g. PRICE_UPDATED, SEAT_RESERVED).

This closes the event-driven loop — Flight Service publishes,
this consumer receives and acts on the messages.
"""

import pika
import json
import time
import logging
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [EVENT_CONSUMER] %(levelname)s - %(message)s"
)
log = logging.getLogger(__name__)

RABBITMQ_HOST = "rabbitmq"
QUEUE_NAME = "aerolink_events"


# ── EVENT HANDLERS ───────────────────────────────────────────────────────────

def handle_price_updated(data: dict):
    """
    Triggered when a flight price changes.
    In production: update a read-model cache, notify subscribed passengers, etc.
    """
    flight_id = data.get("flight_id")
    new_price = data.get("new_price")
    log.info(f"[PRICE_UPDATED] Flight {flight_id} new price: £{new_price}")
    log.info(f"  → Action: Notifying subscribed passengers of price change.")
    log.info(f"  → Action: Updating pricing read-model cache.")


def handle_seat_reserved(data: dict):
    """
    Triggered when a seat is reserved via the Booking Service.
    In production: update seat map UI, trigger baggage record creation, etc.
    """
    flight_id = data.get("flight_id")
    passenger = data.get("passenger_name", "Unknown")
    log.info(f"[SEAT_RESERVED] Passenger '{passenger}' reserved seat on flight {flight_id}")
    log.info(f"  → Action: Updating real-time seat availability map.")
    log.info(f"  → Action: Triggering baggage record creation.")


def handle_booking_confirmed(data: dict):
    """
    Triggered when a booking is confirmed.
    In production: send confirmation email, update loyalty points, etc.
    """
    booking_id = data.get("booking_id")
    passenger = data.get("passenger_name", "Unknown")
    log.info(f"[BOOKING_CONFIRMED] Booking #{booking_id} confirmed for '{passenger}'")
    log.info(f"  → Action: Sending confirmation email.")
    log.info(f"  → Action: Updating passenger loyalty points.")


def handle_baggage_status_updated(data: dict):
    """
    Triggered when baggage status changes.
    In production: update baggage tracking UI, notify passenger, trigger handling systems.
    """
    baggage_id = data.get("baggage_id")
    passenger = data.get("passenger_name", "Unknown")
    tag_number = data.get("tag_number")
    old_status = data.get("old_status")
    new_status = data.get("new_status")
    log.info(f"[BAGGAGE_STATUS_UPDATED] Baggage {baggage_id} (Tag: {tag_number}) for '{passenger}'")
    log.info(f"  → Status transition: {old_status} → {new_status}")
    log.info(f"  → Action: Updating real-time baggage tracking display.")
    log.info(f"  → Action: Sending status notification to passenger.")


def handle_flight_schedule_updated(data: dict):
    """
    Triggered when a flight schedule changes.
    In production: update boarding displays, notify passengers of delays/gate changes, etc.
    """
    schedule_id = data.get("schedule_id")
    flight_no = data.get("flight_no")
    old_status = data.get("old_status")
    new_status = data.get("new_status")
    gate = data.get("gate")
    log.info(f"[FLIGHT_SCHEDULE_UPDATED] Flight {flight_no} (Schedule ID: {schedule_id})")
    log.info(f"  → Status transition: {old_status} → {new_status}")
    log.info(f"  → Gate: {gate}")
    log.info(f"  → Action: Updating flight display boards.")
    log.info(f"  → Action: Notifying passengers of schedule/gate changes.")


def handle_unknown(event_type: str, data: dict):
    log.warning(f"[UNKNOWN EVENT] Type: '{event_type}' — no handler registered. Data: {data}")


# ── ROUTER ───────────────────────────────────────────────────────────────────

EVENT_HANDLERS = {
    "PRICE_UPDATED":           handle_price_updated,
    "SEAT_RESERVED":           handle_seat_reserved,
    "BOOKING_CONFIRMED":       handle_booking_confirmed,
    "BAGGAGE_STATUS_UPDATED":  handle_baggage_status_updated,
    "FLIGHT_SCHEDULE_UPDATED": handle_flight_schedule_updated,
}

def process_message(ch, method, properties, body):
    """Decode an incoming event and dispatch to the correct handler."""
    try:
        message = json.loads(body)
        event_type = message.get("type", "UNKNOWN")
        data = message.get("data", {})

        # Enhanced logging with timestamp and payload summary
        timestamp = datetime.utcnow().isoformat() + "Z"
        log.info(f"━━━ Consumed Event: event_type={event_type} timestamp={timestamp} ━━━")
        log.info(f"  Payload summary: {json.dumps(data, default=str, indent=2)[:200]}...")

        handler = EVENT_HANDLERS.get(event_type)
        if handler:
            handler(data)
        else:
            handle_unknown(event_type, data)

        # Acknowledge the message so RabbitMQ removes it from the queue
        ch.basic_ack(delivery_tag=method.delivery_tag)
        log.info(f"✓ Event '{event_type}' processed and acknowledged.\n")

    except json.JSONDecodeError:
        log.error(f"Failed to decode message body: {body}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    except Exception as e:
        log.error(f"Error processing event: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)


# ── CONNECTION WITH RETRY ────────────────────────────────────────────────────

def connect_with_retry(retries: int = 10, delay: int = 5):
    """
    Attempt to connect to RabbitMQ, retrying if it isn't ready yet.
    RabbitMQ can take ~10-15s to start inside Docker — this handles that.
    """
    for attempt in range(1, retries + 1):
        try:
            log.info(f"Connecting to RabbitMQ at '{RABBITMQ_HOST}' (attempt {attempt}/{retries})...")
            connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host=RABBITMQ_HOST,
                    heartbeat=600,
                    blocked_connection_timeout=300
                )
            )
            log.info("✓ Connected to RabbitMQ successfully.")
            return connection
        except pika.exceptions.AMQPConnectionError as e:
            log.warning(f"RabbitMQ not ready yet. Retrying in {delay}s... ({e})")
            time.sleep(delay)

    raise RuntimeError("Could not connect to RabbitMQ after multiple attempts.")


# ── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    log.info("AeroLink Event Consumer starting...")
    try:
        connection = connect_with_retry()
    except RuntimeError as e:
        log.error(f"Failed to connect to RabbitMQ: {e}")
        raise
    
    channel = connection.channel()

    # Declare the queue (idempotent — safe to call even if it already exists)
    channel.queue_declare(queue=QUEUE_NAME, durable=True)

    # Only fetch one message at a time — fair dispatch
    channel.basic_qos(prefetch_count=1)

    # Register our callback
    channel.basic_consume(queue=QUEUE_NAME, on_message_callback=process_message)

    log.info(f"Listening on queue '{QUEUE_NAME}'. Waiting for events...")
    log.info("Press Ctrl+C to stop.\n")

    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        log.info("Shutting down consumer gracefully.")
        channel.stop_consuming()
    finally:
        connection.close()


if __name__ == "__main__":
    main()

