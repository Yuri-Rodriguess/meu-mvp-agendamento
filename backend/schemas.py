from pydantic import BaseModel
from datetime import datetime

class AppointmentCreate(BaseModel):
    client_name: str
    service: str
    date_time: datetime

class AppointmentResponse(AppointmentCreate):
    id: int

    class Config:
        from_attributes = True