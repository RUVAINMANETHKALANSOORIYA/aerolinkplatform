from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String

from database import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, index=True, nullable=False)
    amount = Column(Float, nullable=False)
    payment_method = Column(String(32), nullable=False)
    payment_status = Column(String(32), nullable=False)
    transaction_reference = Column(String(64), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
