from sqlalchemy import Column, Integer, String, Float
from database import Base

class Flight(Base):
    __tablename__ = "flights"
    id = Column(Integer, primary_key=True, index=True)
    flight_number = Column(String, unique=True)
    origin = Column(String)
    destination = Column(String)
    available_seats = Column(Integer)
    price = Column(Float)