import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

import boto3
import requests
from fastapi import Depends, FastAPI, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

services_dir = Path(__file__).parent.parent
if str(services_dir) not in sys.path:
    sys.path.insert(0, str(services_dir))
from shared_observability import HealthChecker, RequestIDMiddleware, get_metrics, setup_structured_logging

import database
import models

if not database.use_dynamodb():
    models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="AeroLink Payment Service")
SERVICE_NAME = "payment_service"
app.add_middleware(RequestIDMiddleware, service_name=SERVICE_NAME)
logger = setup_structured_logging(SERVICE_NAME)
health_checker = HealthChecker(SERVICE_NAME)

BOOKING_SERVICE_URL = os.getenv("BOOKING_SERVICE_URL", "http://booking_service:8000")
VALID_PAYMENT_RESULTS = {"SUCCESS", "FAILED", "PENDING"}

# ── EventBridge configuration ────────────────────────────────────────────────
# PAYMENT_EVENTS_ENABLED must be explicitly set to "true" to publish events.
# Local Docker Compose keeps this "false" so no real AWS calls are made.
PAYMENT_EVENTS_ENABLED = os.getenv("PAYMENT_EVENTS_ENABLED", "false").strip().lower() == "true"
EVENT_BUS_NAME = os.getenv("EVENT_BUS_NAME", "default")
EVENT_SOURCE = os.getenv("EVENT_SOURCE", "aerolink.payment")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")


def publish_payment_event(
    detail_type: str,
    payment_id: str,
    booking_id: str,
    payment_status: str,
    booking_status: str,
    transaction_reference: str,
    created_at: str,
    passenger_sub: str,
) -> None:
    """Publish a safe EventBridge event after payment and booking update.

    Only called when PAYMENT_EVENTS_ENABLED is true.
    The detail payload deliberately excludes all sensitive fields:
    amount, card numbers, CVV, expiry dates, banking credentials.
    A publishing failure is logged but does not alter the already-successful
    API response.
    """
    if not PAYMENT_EVENTS_ENABLED:
        return

    # Build safe detail — no amount, no card data, no credentials.
    detail_payload = {
        "payment_id": payment_id,
        "booking_id": str(booking_id),
        "payment_status": payment_status,
        "booking_status": booking_status,
        "transaction_reference": transaction_reference,
        "created_at": str(created_at),
        "passenger_sub": passenger_sub,
    }

    try:
        events_client = boto3.client("events", region_name=AWS_REGION)
        result = events_client.put_events(
            Entries=[
                {
                    "Source": EVENT_SOURCE,
                    "DetailType": detail_type,
                    "Detail": json.dumps(detail_payload),
                    "EventBusName": EVENT_BUS_NAME,
                }
            ]
        )
        if result.get("FailedEntryCount", 0) > 0:
            logger.error(
                "EventBridge put_events had failed entries",
                extra={
                    "detail_type": detail_type,
                    "failed_entries": result.get("Entries", []),
                },
            )
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "EventBridge publish failed — payment response unchanged",
            extra={"detail_type": detail_type, "error": str(exc)},
        )


class PaymentCreate(BaseModel):
    booking_id: str | int
    payment_result: str

    class Config:
        extra = "forbid"


class PaymentOut(BaseModel):
    id: str | int
    booking_id: str | int
    amount: float
    payment_method: str
    payment_status: str
    transaction_reference: str
    created_at: datetime | str


def serialize_payment(payment: models.Payment | dict) -> dict:
    if isinstance(payment, dict):
        return {
            "id": payment.get("payment_id", payment.get("id")),
            "booking_id": payment.get("booking_id"),
            "amount": payment.get("amount"),
            "payment_method": payment.get("payment_method"),
            "payment_status": payment.get("payment_status"),
            "transaction_reference": payment.get("transaction_reference"),
            "created_at": payment.get("created_at"),
        }

    return {
        "id": payment.id,
        "booking_id": payment.booking_id,
        "amount": payment.amount,
        "payment_method": payment.payment_method,
        "payment_status": payment.payment_status,
        "transaction_reference": payment.transaction_reference,
        "created_at": payment.created_at,
    }


def update_booking_status(booking_id: int, status: str) -> None:
    response = requests.patch(
        f"{BOOKING_SERVICE_URL.rstrip('/')}/bookings/{booking_id}/status",
        json={"status": status},
        timeout=5,
    )
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Booking Service update failed")


def _sqlite_payment_items(db: Session):
    return db.query(models.Payment).order_by(models.Payment.id.desc()).all()


def _sqlite_get_payment(payment_id: str, db: Session):
    try:
        payment_key = int(payment_id)
    except ValueError:
        return None
    return db.query(models.Payment).filter(models.Payment.id == payment_key).first()


def _sqlite_payment_by_booking(booking_id: str, db: Session):
    try:
        booking_key = int(booking_id)
    except ValueError:
        return []
    return db.query(models.Payment).filter(models.Payment.booking_id == booking_key).order_by(models.Payment.id.desc()).all()


@app.get("/")
def read_root():
    return {"message": "AeroLink Payment Service is Online"}


@app.get("/health")
def health(db: Session = Depends(database.get_db)):
    try:
        db_status = database.backend_health() if database.use_dynamodb() else health_checker.check_database(db)
    except Exception as e:
        db_status = f"error: {str(e)}"
    return health_checker.get_health_status(db_status=db_status, rabbitmq_status="not_configured")


@app.get("/metrics")
def metrics_endpoint():
    return get_metrics(SERVICE_NAME)


@app.post("/payments", response_model=PaymentOut, status_code=201)
def create_payment(payment: PaymentCreate, request: Request, db: Session = Depends(database.get_db)):
    passenger_sub = request.headers.get("x-passenger-sub")
    if not passenger_sub:
        raise HTTPException(status_code=401, detail="Unauthorized")

    payment_status = payment.payment_result.strip().upper()
    if payment_status not in {"SUCCESS", "FAILED"}:
        raise HTTPException(status_code=400, detail="payment_result must be SUCCESS or FAILED")

    # Fetch booking to validate ownership, status, and get total_amount
    booking_resp = requests.get(f"{BOOKING_SERVICE_URL.rstrip('/')}/bookings/{payment.booking_id}", timeout=5)
    if booking_resp.status_code != 200:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = booking_resp.json()

    booking_passenger_sub = booking.get("passenger_sub")
    if not booking_passenger_sub or booking_passenger_sub != passenger_sub:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Booking does not belong to user"
        )
    
    if booking.get("status") != "PENDING_PAYMENT":
        raise HTTPException(status_code=400, detail="Booking is not in PENDING_PAYMENT status")

    transaction_reference = f"PAY-{uuid.uuid4().hex[:16].upper()}"
    
    stored_total = booking.get("total_amount")
    if stored_total is None:
        raise HTTPException(
            status_code=400,
            detail="Booking does not contain a valid payable amount"
        )
    try:
        amount = float(stored_total)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Booking does not contain a valid payable amount"
        )
    if amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Booking does not contain a valid payable amount"
        )
        
    payment_method = "SIMULATED_CARD"

    if database.use_dynamodb():
        new_payment = database.create_payment_item(
            booking_id=payment.booking_id,
            amount=amount,
            payment_method=payment_method,
            payment_status=payment_status,
            transaction_reference=transaction_reference,
        )
    else:
        new_payment = models.Payment(
            booking_id=int(payment.booking_id),
            amount=amount,
            payment_method=payment_method,
            payment_status=payment_status,
            transaction_reference=transaction_reference,
            created_at=datetime.utcnow(),
        )
        db.add(new_payment)
        db.commit()
        db.refresh(new_payment)

    if payment_status == "SUCCESS":
        update_booking_status(payment.booking_id, "CONFIRMED")
        publish_payment_event(
            detail_type="PaymentSucceeded",
            payment_id=str(new_payment["payment_id"] if isinstance(new_payment, dict) else new_payment.id),
            booking_id=str(payment.booking_id),
            payment_status="SUCCESS",
            booking_status="CONFIRMED",
            transaction_reference=transaction_reference,
            created_at=new_payment["created_at"] if isinstance(new_payment, dict) else str(new_payment.created_at),
            passenger_sub=passenger_sub,
        )
    elif payment_status == "FAILED":
        update_booking_status(payment.booking_id, "PAYMENT_FAILED")
        publish_payment_event(
            detail_type="PaymentFailed",
            payment_id=str(new_payment["payment_id"] if isinstance(new_payment, dict) else new_payment.id),
            booking_id=str(payment.booking_id),
            payment_status="FAILED",
            booking_status="PAYMENT_FAILED",
            transaction_reference=transaction_reference,
            created_at=new_payment["created_at"] if isinstance(new_payment, dict) else str(new_payment.created_at),
            passenger_sub=passenger_sub,
        )

    return serialize_payment(new_payment)


@app.get("/payments")
def get_payments(db: Session = Depends(database.get_db)):
    if database.use_dynamodb():
        return [serialize_payment(item) for item in database.list_payment_items()]
    return [serialize_payment(payment) for payment in _sqlite_payment_items(db)]


@app.get("/payments/booking/{booking_id}")
def get_payments_by_booking(booking_id: str, db: Session = Depends(database.get_db)):
    payments = database.get_payment_items_by_booking(booking_id) if database.use_dynamodb() else _sqlite_payment_by_booking(booking_id, db)
    if not payments:
        raise HTTPException(status_code=404, detail="No payments found for booking")
    return [serialize_payment(payment) for payment in payments]


@app.get("/payments/{payment_id}")
def get_payment(payment_id: str, db: Session = Depends(database.get_db)):
    payment = database.get_payment_item(payment_id) if database.use_dynamodb() else _sqlite_get_payment(payment_id, db)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return serialize_payment(payment)
