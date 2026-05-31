from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import pika
import json
import os
import models
import database
import sys
from pathlib import Path

# Import observability utilities (works both locally and in Docker)
services_dir = Path(__file__).parent.parent
if str(services_dir) not in sys.path:
    sys.path.insert(0, str(services_dir))
from shared_observability import RequestIDMiddleware, get_metrics, HealthChecker, setup_structured_logging

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="AeroLink Baggage Service")
SERVICE_NAME = "baggage_service"
app.add_middleware(RequestIDMiddleware, service_name=SERVICE_NAME)
logger = setup_structured_logging(SERVICE_NAME)
health_checker = HealthChecker(SERVICE_NAME)

VALID_STATUSES = {"CHECKED_IN", "LOADED", "IN_TRANSIT", "ARRIVED", "LOST"}


@app.get("/")
def read_root():
    return {"message": "AeroLink Baggage Service is Online"}


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


RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")


def send_event(event_type: str, data: dict):
    """Publish an event to RabbitMQ."""
    try:
        connection = pika.BlockingConnection(
            pika.URLParameters(RABBITMQ_URL)
        )
        channel = connection.channel()
        channel.queue_declare(queue='aerolink_events', durable=True)
        message = {"type": event_type, "data": data}
        channel.basic_publish(
            exchange='',
            routing_key='aerolink_events',
            body=json.dumps(message),
            properties=pika.BasicProperties(delivery_mode=2)
        )
        connection.close()
        print(f" [x] Sent Event: {event_type}")
    except Exception as e:
        print(f"FAILED TO SEND EVENT. Error: {str(e)}")


@app.post("/baggage", status_code=201)
def create_baggage(
    passenger_name: str,
    flight_id: int,
    tag_number: str,
    db: Session = Depends(database.get_db)
):
    """
    Create a new baggage record.
    Initial status is CHECKED_IN.
    """
    existing = db.query(models.Baggage).filter(models.Baggage.tag_number == tag_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Baggage tag number already exists")

    new_baggage = models.Baggage(
        passenger_name=passenger_name,
        flight_id=flight_id,
        tag_number=tag_number,
        status="CHECKED_IN",
        last_updated=datetime.utcnow()
    )
    db.add(new_baggage)
    db.commit()
    db.refresh(new_baggage)

    # Publish event
    send_event("BAGGAGE_STATUS_UPDATED", {
        "baggage_id": new_baggage.id,
        "passenger_name": new_baggage.passenger_name,
        "flight_id": new_baggage.flight_id,
        "tag_number": new_baggage.tag_number,
        "old_status": None,
        "new_status": "CHECKED_IN",
        "timestamp": datetime.utcnow().isoformat()
    })

    return new_baggage


@app.get("/baggage")
def get_all_baggage(db: Session = Depends(database.get_db)):
    """Retrieve all baggage records."""
    return db.query(models.Baggage).all()


@app.get("/baggage/{baggage_id}")
def get_baggage(baggage_id: int, db: Session = Depends(database.get_db)):
    """Retrieve a baggage record by ID."""
    baggage = db.query(models.Baggage).filter(models.Baggage.id == baggage_id).first()
    if not baggage:
        raise HTTPException(status_code=404, detail="Baggage not found")
    return baggage


@app.get("/baggage/passenger/{passenger_name}")
def get_baggage_by_passenger(passenger_name: str, db: Session = Depends(database.get_db)):
    """Retrieve all baggage records for a passenger."""
    baggage_records = db.query(models.Baggage).filter(
        models.Baggage.passenger_name == passenger_name
    ).all()
    if not baggage_records:
        raise HTTPException(status_code=404, detail="No baggage found for this passenger")
    return baggage_records


@app.patch("/baggage/{baggage_id}/status")
def update_baggage_status(
    baggage_id: int,
    new_status: str,
    db: Session = Depends(database.get_db)
):
    """
    Update the status of a baggage record.
    Valid statuses: CHECKED_IN, LOADED, IN_TRANSIT, ARRIVED, LOST
    """
    if new_status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}"
        )

    baggage = db.query(models.Baggage).filter(models.Baggage.id == baggage_id).first()
    if not baggage:
        raise HTTPException(status_code=404, detail="Baggage not found")

    old_status = baggage.status
    baggage.status = new_status
    baggage.last_updated = datetime.utcnow()
    db.commit()

    # Publish event
    send_event("BAGGAGE_STATUS_UPDATED", {
        "baggage_id": baggage.id,
        "passenger_name": baggage.passenger_name,
        "flight_id": baggage.flight_id,
        "tag_number": baggage.tag_number,
        "old_status": old_status,
        "new_status": new_status,
        "timestamp": datetime.utcnow().isoformat()
    })

    return {"message": "Baggage status updated and broadcasted", "baggage": baggage}
