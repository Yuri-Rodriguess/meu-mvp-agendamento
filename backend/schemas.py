from pydantic import BaseModel, ConfigDict
from datetime import datetime

class AppointmentCreate(BaseModel):
    client_name: str
    service: str
    date_time: datetime

class AppointmentResponse(AppointmentCreate):
    id: int
    
    model_config = ConfigDict(from_attributes=True)