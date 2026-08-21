from pydantic import BaseModel, ConfigDict, EmailStr
from datetime import datetime

class AppointmentCreate(BaseModel):
    client_name: str
    service: str
    date_time: datetime
    # Opcional: se informado, o cliente recebe um e-mail de confirmação
    # (ver backend/notifications.py e a variável SMTP_HOST no .env.example)
    client_email: EmailStr | None = None
    # Opcional: só um contato de referência (não dispara nada sozinho).
    client_phone: str | None = None
    # Opcional: qual funcionário (ver ProfessionalDB) vai atender.
    professional_id: int | None = None

class AppointmentResponse(AppointmentCreate):
    id: int
    # Token usado para montar o link de ativação do lembrete via Telegram
    # (t.me/<bot>?start=<token>) — ver backend/notifications.py.
    telegram_link_token: str | None = None
    # True depois que o cliente abre o link e aperta "Start" no bot.
    telegram_linked: bool = False
    # Nome do profissional, já resolvido, pra lista não precisar cruzar com
    # GET /professionals/ toda vez.
    professional_name: str | None = None

    model_config = ConfigDict(from_attributes=True)

class ProfessionalCreate(BaseModel):
    name: str

class ProfessionalResponse(ProfessionalCreate):
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