from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
import pika
import json
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

app = FastAPI(title="AeroLink Schedule Service")
SERVICE_NAME = "schedule_service"
app.add_middleware(RequestIDMiddleware, service_name=SERVICE_NAME)
logger = setup_structured_logging(SERVICE_NAME)
health_checker = HealthChecker(SERVICE_NAME)

VALID_STATUSES = {"SCHEDULED", "DELAYED", "BOARDING", "DEPARTED", "CANCELLED"}


class ScheduleCreate(BaseModel):
    flight_no: str
    origin: str
    destination: str
    departure_time: datetime
    arrival_time: datetime
    gate: str = None


class ScheduleUpdate(BaseModel):
    status: str = None
    gate: str = None
    departure_time: datetime = None
    arrival_time: datetime = None


@app.get("/")
def read_root():
    return {"message": "AeroLink Schedule Service is Online"}


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


def send_event(event_type: str, data: dict):
    """Publish an event to RabbitMQ."""
    try:
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(host='rabbitmq', heartbeat=600, blocked_connection_timeout=300)
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


@app.post("/schedules", status_code=201)
def create_schedule(schedule: ScheduleCreate, db: Session = Depends(database.get_db)):
    """
    Create a new flight schedule.
    Initial status is SCHEDULED.
    """
    existing = db.query(models.Schedule).filter(models.Schedule.flight_no == schedule.flight_no).first()
    if existing:
        raise HTTPException(status_code=400, detail="Flight number already exists")

    new_schedule = models.Schedule(
        flight_no=schedule.flight_no,
        origin=schedule.origin,
        destination=schedule.destination,
        departure_time=schedule.departure_time,
        arrival_time=schedule.arrival_time,
        status="SCHEDULED",
        gate=schedule.gate
    )
    db.add(new_schedule)
    db.commit()
    db.refresh(new_schedule)

    # Publish event
    send_event("FLIGHT_SCHEDULE_UPDATED", {
        "schedule_id": new_schedule.id,
        "flight_no": new_schedule.flight_no,
        "old_status": None,
        "new_status": "SCHEDULED",
        "gate": new_schedule.gate,
        "departure_time": new_schedule.departure_time.isoformat(),
        "timestamp": datetime.utcnow().isoformat()
    })

    return new_schedule


@app.get("/schedules")
def get_all_schedules(db: Session = Depends(database.get_db)):
    """Retrieve all flight schedules."""
    return db.query(models.Schedule).all()


@app.get("/schedules/{schedule_id}")
def get_schedule(schedule_id: int, db: Session = Depends(database.get_db)):
    """Retrieve a schedule by ID."""
    schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule


@app.patch("/schedules/{schedule_id}")
def update_schedule(
    schedule_id: int,
    update: ScheduleUpdate,
    db: Session = Depends(database.get_db)
):
    """
    Update a flight schedule.
    Valid statuses: SCHEDULED, DELAYED, BOARDING, DEPARTED, CANCELLED
    """
    schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    old_status = schedule.status
    event_data = {
        "schedule_id": schedule.id,
        "flight_no": schedule.flight_no,
        "old_status": old_status,
        "gate": schedule.gate,
        "departure_time": schedule.departure_time.isoformat() if schedule.departure_time else None,
        "timestamp": datetime.utcnow().isoformat()
    }

    # Update status if provided
    if update.status:
        if update.status not in VALID_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}"
            )
        schedule.status = update.status
        event_data["new_status"] = update.status

    # Update gate if provided
    if update.gate:
        schedule.gate = update.gate
        event_data["gate"] = update.gate

    # Update departure_time if provided
    if update.departure_time:
        schedule.departure_time = update.departure_time
        event_data["departure_time"] = update.departure_time.isoformat()

    # Update arrival_time if provided
    if update.arrival_time:
        schedule.arrival_time = update.arrival_time

    db.commit()

    # Publish event only if status changed
    if update.status:
        send_event("FLIGHT_SCHEDULE_UPDATED", event_data)

    return {
        "message": "Schedule updated and broadcasted",
        "schedule": {
            "id": schedule.id,
            "flight_no": schedule.flight_no,
            "origin": schedule.origin,
            "destination": schedule.destination,
            "departure_time": schedule.departure_time,
            "arrival_time": schedule.arrival_time,
            "status": schedule.status,
            "gate": schedule.gate,
        },
    }
