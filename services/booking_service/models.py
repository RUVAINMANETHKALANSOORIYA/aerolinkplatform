from sqlalchemy import Column, Integer, String
from database import Base

class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True, index=True)
    passenger_name = Column(String)
    flight_id = Column(Integer)
    status = Column(String) # e.g., "Confirmed"