from pydantic import BaseModel, ConfigDict
from datetime import datetime

class AppointmentCreate(BaseModel):
    client_name: str
    service: str
    date_time: datetime

class AppointmentResponse(AppointmentCreate):
    id: int
    
    model_config = ConfigDict(from_attributes=True)

class UserCreate(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    id: int
    username: str
    
    # Permite ler direto do banco de dados (SQLAlchemy)
    model_config = ConfigDict(from_attributes=True)