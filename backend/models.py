from sqlalchemy import Column, Integer, String, DateTime
from database import Base

class AppointmentDB(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    client_name = Column(String, index=True)
    service = Column(String)
    date_time = Column(DateTime)