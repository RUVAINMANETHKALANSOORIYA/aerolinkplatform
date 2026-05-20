from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
import models, database
import pika, json, os
import sys
from pathlib import Path

# Import observability utilities (works both locally and in Docker)
services_dir = Path(__file__).parent.parent
if str(services_dir) not in sys.path:
    sys.path.insert(0, str(services_dir))
from shared_observability import RequestIDMiddleware, get_metrics, HealthChecker, setup_structured_logging

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="AeroLink Flight Service")

# Add observability middleware
SERVICE_NAME = "flight_service"
app.add_middleware(RequestIDMiddleware, service_name=SERVICE_NAME)
logger = setup_structured_logging(SERVICE_NAME)
health_checker = HealthChecker(SERVICE_NAME)

@app.get("/")
def read_root():
    return {"message": "AeroLink Flight Operations Service is Online"}

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

@app.get("/flights")
def get_all_flights(db: Session = Depends(database.get_db)):
    return db.query(models.Flight).all()

@app.post("/flights")
def create_flight(flight_no: str, seats: int, db: Session = Depends(database.get_db)):
    # Check if flight exists to avoid 500 errors
    existing = db.query(models.Flight).filter(models.Flight.flight_number == flight_no).first()
    if existing:
        raise HTTPException(status_code=400, detail="Flight number already exists")

    try:
        new_flight = models.Flight(flight_number=flight_no, available_seats=seats, origin="LHR", destination="JFK", price=450.0)
        db.add(new_flight)
        db.commit()
        db.refresh(new_flight) # <--- ADD THIS LINE
        return new_flight
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Critical for the Saga Pattern: This updates seats when a booking happens
@app.patch("/flights/{flight_id}/reserve")
def reserve_seat(flight_id: int, db: Session = Depends(database.get_db)):
    flight = db.query(models.Flight).filter(models.Flight.id == flight_id).first()
    if not flight or flight.available_seats <= 0:
        raise HTTPException(status_code=400, detail="No seats available")
    flight.available_seats -= 1
    db.commit()
    return {"status": "success", "remaining_seats": flight.available_seats}

def send_event(event_type, data):
    try:
        # We use the service name 'rabbitmq' defined in docker-compose
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
            properties=pika.BasicProperties(delivery_mode=2) # make message persistent
        )
        connection.close()
        print(f" [x] Sent Event: {event_type}")
    except Exception as e:
        print(f"FAILED TO SEND EVENT. Error: {str(e)}") # This will tell us EXACTLY what is wrong

@app.patch("/flights/{flight_id}/price")
def update_price(flight_id: int, new_price: float, db: Session = Depends(database.get_db)):
    flight = db.query(models.Flight).filter(models.Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    flight.price = new_price
    db.commit()
    # Task 4: Real-time sync event
    send_event("PRICE_UPDATED", {"flight_id": flight_id, "new_price": new_price})
    return {"message": "Price updated and broadcasted"}