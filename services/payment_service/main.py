import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

import requests
from fastapi import Depends, FastAPI, HTTPException
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


class PaymentCreate(BaseModel):
    booking_id: str | int
    amount: float
    payment_method: str
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
def create_payment(payment: PaymentCreate, db: Session = Depends(database.get_db)):
    payment_status = payment.payment_result.strip().upper()
    if payment_status not in VALID_PAYMENT_RESULTS:
        raise HTTPException(status_code=400, detail="payment_result must be SUCCESS, FAILED, or PENDING")

    transaction_reference = f"PAY-{uuid.uuid4().hex[:16].upper()}"

    if database.use_dynamodb():
        new_payment = database.create_payment_item(
            booking_id=payment.booking_id,
            amount=payment.amount,
            payment_method=payment.payment_method.strip(),
            payment_status=payment_status,
            transaction_reference=transaction_reference,
        )
    else:
        new_payment = models.Payment(
            booking_id=int(payment.booking_id),
            amount=payment.amount,
            payment_method=payment.payment_method.strip(),
            payment_status=payment_status,
            transaction_reference=transaction_reference,
            created_at=datetime.utcnow(),
        )
        db.add(new_payment)
        db.commit()
        db.refresh(new_payment)

    if payment_status == "SUCCESS":
        update_booking_status(payment.booking_id, "CONFIRMED")
    elif payment_status == "FAILED":
        update_booking_status(payment.booking_id, "PAYMENT_FAILED")

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
