from pydantic import BaseModel, ConfigDict, EmailStr
from datetime import datetime

class AppointmentCreate(BaseModel):
    client_name: str
    service: str
    date_time: datetime
    # Opcional: se informado, o cliente recebe um e-mail de confirmação
    # (ver backend/notifications.py e a variável SMTP_HOST no .env.example)
    client_email: EmailStr | None = None

class AppointmentResponse(AppointmentCreate):
    id: int
    
    model_config = ConfigDict(from_attributes=True)

class UserCreate(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class RefreshRequest(BaseModel):
    refresh_token: str

class UserResponse(BaseModel):
    id: int
    username: str
    role: str

    # Permite ler direto do banco de dados (SQLAlchemy)
    model_config = ConfigDict(from_attributes=True)