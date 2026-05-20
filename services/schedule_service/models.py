from sqlalchemy import Column, Integer, String, DateTime
from database import Base
from datetime import datetime

class Schedule(Base):
    __tablename__ = "schedules"
    id = Column(Integer, primary_key=True, index=True)
    flight_no = Column(String, unique=True, nullable=False)
    origin = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    departure_time = Column(DateTime, nullable=False)
    arrival_time = Column(DateTime, nullable=False)
    status = Column(String, default="SCHEDULED")  # SCHEDULED, DELAYED, BOARDING, DEPARTED, CANCELLED
    gate = Column(String, nullable=True)
