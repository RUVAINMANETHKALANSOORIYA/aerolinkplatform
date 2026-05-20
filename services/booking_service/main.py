from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from tenacity import retry, stop_after_attempt, wait_fixed
import requests
import models, database
import sys
from pathlib import Path

# Import observability utilities (works both locally and in Docker)
services_dir = Path(__file__).parent.parent
if str(services_dir) not in sys.path:
    sys.path.insert(0, str(services_dir))
from shared_observability import RequestIDMiddleware, get_metrics, HealthChecker, setup_structured_logging

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="AeroLink Booking Service")
SERVICE_NAME = "booking_service"
app.add_middleware(RequestIDMiddleware, service_name=SERVICE_NAME)
logger = setup_structured_logging(SERVICE_NAME)
health_checker = HealthChecker(SERVICE_NAME)

@app.get("/health")
def health(db: Session = Depends(database.get_db)):
    try:
        db_status = health_checker.check_database(db)
    except Exception as e:
        db_status = f"error: {str(e)}"
    return health_checker.get_health_status(db_status=db_status, rabbitmq_status="not_configured")

@app.get("/metrics")
def metrics_endpoint():
    return get_metrics(SERVICE_NAME)

# This URL points to the other service using Docker's internal network
FLIGHT_SERVICE_URL = "http://flight_service:8000/flights"

# Task 5: Fault Tolerance - Retry 3 times if the flight service is busy/down
@retry(stop=stop_after_attempt(3), wait=wait_fixed(2))
def call_flight_service(flight_id):
    response = requests.patch(f"{FLIGHT_SERVICE_URL}/{flight_id}/reserve", timeout=5)
    if response.status_code != 200:
        raise Exception("Flight Service Error")
    return response

@app.post("/bookings")
def create_booking(name: str, flight_id: int, db: Session = Depends(database.get_db)):
    try:
        # Use our retry-enabled function
        call_flight_service(flight_id)
        
        new_booking = models.Booking(passenger_name=name, flight_id=flight_id, status="Confirmed")
        db.add(new_booking)
        db.commit()
        db.refresh(new_booking)
        return new_booking
    except Exception as e:
        raise HTTPException(status_code=503, detail="Service temporarily unavailable. Please try again.")