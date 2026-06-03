import os
import requests
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, validator
import sys
from pathlib import Path
from typing import Optional
from botocore.exceptions import ClientError

# Import observability utilities (works both locally and in Docker)
services_dir = Path(__file__).parent.parent
if str(services_dir) not in sys.path:
    sys.path.insert(0, str(services_dir))
from shared_observability import RequestIDMiddleware, get_metrics, HealthChecker, setup_structured_logging

import database

app = FastAPI(title="AeroLink Baggage Service")
SERVICE_NAME = "baggage_service"
app.add_middleware(RequestIDMiddleware, service_name=SERVICE_NAME)
logger = setup_structured_logging(SERVICE_NAME)
health_checker = HealthChecker(SERVICE_NAME)

VALID_STATUSES = {"CHECKED_IN", "SCREENED", "LOADED", "IN_TRANSIT", "ARRIVED", "COLLECTED", "DELAYED"}
BOOKING_SERVICE_URL = os.getenv("BOOKING_SERVICE_URL", "http://booking_service:8000")

class BaggageCreate(BaseModel):
    booking_id: str
    tag_number: str
    weight_kg: Optional[float] = None

    @validator('booking_id', 'tag_number')
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Must not be empty or whitespace')
        return v.strip()

    @validator('weight_kg')
    def weight_positive(cls, v):
        if v is not None and v <= 0:
            raise ValueError('Weight must be greater than 0')
        return v

class BaggageStatusUpdate(BaseModel):
    status: str

@app.get("/")
def read_root():
    return {"message": "AeroLink Baggage Service is Online"}

@app.get("/health")
def health():
    try:
        db_status = database.backend_health()
    except Exception as e:
        db_status = f"error: {str(e)}"
    return health_checker.get_health_status(db_status=db_status, rabbitmq_status="not_configured")

@app.get("/metrics")
def metrics_endpoint():
    return get_metrics(SERVICE_NAME)

@app.post("/baggage", status_code=201)
def create_baggage(payload: BaggageCreate):
    """Staff only creation."""
    # Check for duplicate tag_number
    if database.check_tag_exists(payload.tag_number):
        raise HTTPException(status_code=400, detail="Baggage tag number already exists")

    # Call Booking Service internally
    try:
        booking_resp = requests.get(f"{BOOKING_SERVICE_URL.rstrip('/')}/bookings/{payload.booking_id}", timeout=5)
    except requests.RequestException:
        raise HTTPException(status_code=503, detail="Booking service unavailable")
        
    if booking_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Invalid booking_id")
    
    booking = booking_resp.json()
    passenger_sub = booking.get("passenger_sub")
    if not passenger_sub or booking.get("status") != "CONFIRMED":
        raise HTTPException(status_code=400, detail="Booking must be CONFIRMED and have a passenger_sub")
    
    new_baggage = database.create_baggage_item(
        booking_id=payload.booking_id,
        passenger_sub=passenger_sub,
        flight_id=str(booking.get("flight_id", "")),
        flight_no=booking.get("flight_no", ""),
        origin=booking.get("origin", ""),
        destination=booking.get("destination", ""),
        tag_number=payload.tag_number,
        weight_kg=payload.weight_kg,
        status="CHECKED_IN"
    )
    new_baggage.pop("passenger_sub", None)
    return new_baggage

@app.get("/baggage")
def get_all_baggage():
    """Retrieve all baggage records (Staff only)."""
    items = database.list_baggage_items()
    safe_items = []
    for bag in items:
        bag.pop("passenger_sub", None)
        safe_items.append(bag)
    return {"items": safe_items}

@app.get("/baggage/me")
def get_my_baggage(request: Request):
    """Passenger only."""
    passenger_sub = request.headers.get("x-passenger-sub")
    if not passenger_sub:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    try:
        items = database.list_passenger_baggage_items(passenger_sub)
    except ClientError as e:
        if e.response.get('Error', {}).get('Code') == 'ValidationException':
            raise HTTPException(status_code=503, detail="Passenger baggage tracking is not configured yet.")
        raise HTTPException(status_code=503, detail="Service temporarily unavailable.")

    safe_items = []
    for bag in items:
        safe_items.append({
            "tag_number": bag.get("tag_number"),
            "flight_no": bag.get("flight_no"),
            "origin": bag.get("origin"),
            "destination": bag.get("destination"),
            "status": bag.get("status"),
            "updated_at": bag.get("updated_at"),
            "weight_kg": bag.get("weight_kg"),
        })
    return {"items": safe_items}

@app.get("/baggage/{baggage_id}")
def get_baggage(baggage_id: str):
    bag = database.get_baggage_item(baggage_id)
    if not bag:
        raise HTTPException(status_code=404, detail="Baggage not found")
    
    bag.pop("passenger_sub", None)
    return bag

@app.patch("/baggage/{baggage_id}/status")
def update_baggage_status(baggage_id: str, payload: BaggageStatusUpdate):
    new_status = payload.status
    if new_status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}")

    try:
        bag = database.update_baggage_status_item(baggage_id, new_status)
        if not bag:
            raise HTTPException(status_code=404, detail="Baggage not found")
        bag.pop("passenger_sub", None)
        return bag
    except ClientError:
        raise HTTPException(status_code=503, detail="Service temporarily unavailable.")
