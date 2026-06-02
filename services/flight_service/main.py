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

if not database.use_dynamodb():
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
        db_status = database.backend_health() if database.use_dynamodb() else health_checker.check_database(db)
    except Exception as e:
        db_status = f"error: {str(e)}"
    return health_checker.get_health_status(db_status=db_status, rabbitmq_status="not_configured")

@app.get("/metrics")
def metrics_endpoint():
    return get_metrics(SERVICE_NAME)


RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")

def serialize_flight(flight):
    if isinstance(flight, dict):
        return {
            "id": flight.get("flight_id"),
            "flight_number": flight.get("flight_no"),
            "flight_id": flight.get("flight_id"),
            "flight_no": flight.get("flight_no"),
            "origin": flight.get("origin"),
            "destination": flight.get("destination"),
            "price": flight.get("price"),
            "total_seats": flight.get("total_seats"),
            "available_seats": flight.get("available_seats"),
            "created_at": flight.get("created_at"),
            "updated_at": flight.get("updated_at"),
        }
    return {
        "id": flight.id,
        "flight_number": flight.flight_number,
        "origin": flight.origin,
        "destination": flight.destination,
        "price": flight.price,
        "available_seats": flight.available_seats
    }

@app.get("/flights")
def get_all_flights(db: Session = Depends(database.get_db)):
    if database.use_dynamodb():
        return [serialize_flight(f) for f in database.list_flight_items()]
    return [serialize_flight(f) for f in db.query(models.Flight).all()]

@app.post("/flights")
def create_flight(
    flight_no: str,
    seats: int,
    origin: str,
    destination: str,
    price: float,
    db: Session = Depends(database.get_db)
):
    flight_no = flight_no.strip()
    origin = origin.strip().upper()
    destination = destination.strip().upper()

    if not flight_no:
        raise HTTPException(status_code=400, detail="Flight number cannot be empty")
    if len(origin) != 3 or not origin.isalpha():
        raise HTTPException(status_code=400, detail="Origin must be exactly 3 alphabetical characters")
    if len(destination) != 3 or not destination.isalpha():
        raise HTTPException(status_code=400, detail="Destination must be exactly 3 alphabetical characters")
    if origin == destination:
        raise HTTPException(status_code=400, detail="Origin and destination cannot be the same")
    if price <= 0:
        raise HTTPException(status_code=400, detail="Price must be greater than zero")
    if seats <= 0:
        raise HTTPException(status_code=400, detail="Seats must be greater than zero")

    if database.use_dynamodb():
        existing = [f for f in database.list_flight_items() if f.get("flight_no") == flight_no]
        if existing:
            raise HTTPException(status_code=400, detail="Flight number already exists")
        try:
            return serialize_flight(database.create_flight_item(flight_no, seats, origin, destination, price))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # Check if flight exists to avoid 500 errors
    existing = db.query(models.Flight).filter(models.Flight.flight_number == flight_no).first()
    if existing:
        raise HTTPException(status_code=400, detail="Flight number already exists")

    try:
        new_flight = models.Flight(flight_number=flight_no, available_seats=seats, origin=origin, destination=destination, price=price)
        db.add(new_flight)
        db.commit()
        db.refresh(new_flight) # <--- ADD THIS LINE
        return serialize_flight(new_flight)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Critical for the Saga Pattern: This updates seats when a booking happens
@app.patch("/flights/{flight_id}/reserve")
def reserve_seat(flight_id: str, db: Session = Depends(database.get_db)):
    if database.use_dynamodb():
        flight = database.reserve_seat_item(flight_id)
        if not flight:
            raise HTTPException(status_code=400, detail="No seats available or flight not found")
        return {"status": "success", "remaining_seats": flight["available_seats"]}

    try:
        sqlite_flight_id = int(flight_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Flight not found")
    flight = db.query(models.Flight).filter(models.Flight.id == sqlite_flight_id).first()
    if not flight or flight.available_seats <= 0:
        raise HTTPException(status_code=400, detail="No seats available")
    flight.available_seats -= 1
    db.commit()
    return {"status": "success", "remaining_seats": flight.available_seats}

def send_event(event_type, data):
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
            properties=pika.BasicProperties(delivery_mode=2) # make message persistent
        )
        connection.close()
        print(f" [x] Sent Event: {event_type}")
    except Exception as e:
        print(f"FAILED TO SEND EVENT. Error: {str(e)}") # This will tell us EXACTLY what is wrong

@app.patch("/flights/{flight_id}/price")
def update_price(flight_id: str, new_price: float, db: Session = Depends(database.get_db)):
    if database.use_dynamodb():
        flight = database.update_price_item(flight_id, new_price)
        if not flight:
            raise HTTPException(status_code=404, detail="Flight not found")
    else:
        try:
            sqlite_flight_id = int(flight_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="Flight not found")
        flight = db.query(models.Flight).filter(models.Flight.id == sqlite_flight_id).first()
        if not flight:
            raise HTTPException(status_code=404, detail="Flight not found")
        flight.price = new_price
        db.commit()
    # Task 4: Real-time sync event
    send_event("PRICE_UPDATED", {"flight_id": flight_id, "new_price": new_price})
    return {"message": "Price updated and broadcasted"}