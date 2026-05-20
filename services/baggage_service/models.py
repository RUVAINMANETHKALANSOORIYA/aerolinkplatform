from sqlalchemy import Column, Integer, String, DateTime
from database import Base
from datetime import datetime

class Baggage(Base):
    __tablename__ = "baggage"
    id = Column(Integer, primary_key=True, index=True)
    passenger_name = Column(String, nullable=False)
    flight_id = Column(Integer, nullable=False)
    tag_number = Column(String, unique=True, nullable=False)
    status = Column(String, default="CHECKED_IN")  # CHECKED_IN, LOADED, IN_TRANSIT, ARRIVED, LOST
    last_updated = Column(DateTime, default=datetime.utcnow)
