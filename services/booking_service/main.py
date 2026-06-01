from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from tenacity import retry, stop_after_attempt, wait_fixed
import requests
import models, database
import sys
from pathlib import Path
import os
from pydantic import BaseModel
from typing import Any, Dict, Optional, Union

# Import observability utilities (works both locally and in Docker)
services_dir = Path(__file__).parent.parent
if str(services_dir) not in sys.path:
    sys.path.insert(0, str(services_dir))
from shared_observability import RequestIDMiddleware, get_metrics, HealthChecker, setup_structured_logging

if not database.use_dynamodb():
    models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="AeroLink Booking Service")
SERVICE_NAME = "booking_service"
app.add_middleware(RequestIDMiddleware, service_name=SERVICE_NAME)
logger = setup_structured_logging(SERVICE_NAME)
health_checker = HealthChecker(SERVICE_NAME)


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


# This URL points to the other service using Docker's internal network
FLIGHT_SERVICE_BASE_URL = os.getenv("FLIGHT_SERVICE_URL", "http://flight_service:8002")
FLIGHT_SERVICE_URL = f"{FLIGHT_SERVICE_BASE_URL.rstrip('/')}/flights"


# Task 5: Fault Tolerance - Retry 3 times if the flight service is busy/down
@retry(stop=stop_after_attempt(3), wait=wait_fixed(2))
def call_flight_service(flight_id):
    response = requests.patch(f"{FLIGHT_SERVICE_URL}/{flight_id}/reserve", timeout=5)
    if response.status_code != 200:
        raise Exception("Flight Service Error")
    return response


class BookingStatusUpdate(BaseModel):
    status: str


def serialize_booking(booking: Union[models.Booking, Dict[str, Any]]) -> dict:
    if isinstance(booking, dict):
        return {
            "id": booking.get("booking_id", booking.get("id")),
            "passenger_name": booking.get("passenger_name"),
            "flight_id": booking.get("flight_id"),
            "status": booking.get("status"),
        }

    return {
        "id": booking.id,
        "passenger_name": booking.passenger_name,
        "flight_id": booking.flight_id,
        "status": booking.status,
    }


@app.post("/bookings")
def create_booking(name: str, flight_id: int, db: Session = Depends(database.get_db)):
    try:
        # Use our retry-enabled function
        call_flight_service(flight_id)

        if database.use_dynamodb():
            booking = database.create_booking_item(name, flight_id, status="PENDING_PAYMENT")
            return serialize_booking(booking)

        new_booking = models.Booking(passenger_name=name, flight_id=flight_id, status="PENDING_PAYMENT")
        db.add(new_booking)
        db.commit()
        db.refresh(new_booking)
        return serialize_booking(new_booking)
    except Exception:
        raise HTTPException(status_code=503, detail="Service temporarily unavailable. Please try again.")


@app.get("/bookings/{booking_id}")
def get_booking(booking_id: str, db: Session = Depends(database.get_db)):
    if database.use_dynamodb():
        booking = database.get_booking_item(booking_id)
    else:
        try:
            sqlite_booking_id = int(booking_id)
        except ValueError:
            sqlite_booking_id = None
        booking = None if sqlite_booking_id is None else db.query(models.Booking).filter(models.Booking.id == sqlite_booking_id).first()

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return serialize_booking(booking)


@app.patch("/bookings/{booking_id}/status")
def update_booking_status(booking_id: str, payload: BookingStatusUpdate, db: Session = Depends(database.get_db)):
    if database.use_dynamodb():
        booking = database.update_booking_status_item(booking_id, payload.status)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        return serialize_booking(booking)

    try:
        sqlite_booking_id = int(booking_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking = db.query(models.Booking).filter(models.Booking.id == sqlite_booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking.status = payload.status
    db.commit()
    db.refresh(booking)
    return serialize_booking(booking)