from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from typing import List

# --- 1. CONFIGURAÇÃO DO BANCO DE DADOS (SQLite) ---
SQLALCHEMY_DATABASE_URL = "sqlite:///./agendamento.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- 2. MODELO DO BANCO (SQLAlchemy) ---
class AppointmentDB(Base):
    __tablename__ = "appointments"
    id = Column(Integer, primary_key=True, index=True)
    client_name = Column(String, index=True)
    service = Column(String)
    date_time = Column(DateTime)

# Cria as tabelas no SQLite automaticamente
Base.metadata.create_all(bind=engine)

# --- 3. SCHEMAS DE VALIDAÇÃO (Pydantic) ---
class AppointmentCreate(BaseModel):
    client_name: str
    service: str
    date_time: datetime

class AppointmentResponse(AppointmentCreate):
    id: int
    # Pydantic v2 uses `model_config` and the key `from_attributes` to allow
    # conversion from ORM objects.  If you're on v1 the equivalent would be
    # `class Config: orm_mode = True`.
    # Using the new style here since our environment installed pydantic>=2.
    model_config = {"from_attributes": True}

# --- 4. APLICAÇÃO FASTAPI ---
app = FastAPI(title="MVP Agendamento Online")

# Permite que o React (rodando em outra porta) acesse a API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Em produção, coloque a URL exata do seu frontend
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- 5. ROTAS DO CRUD ---
@app.post("/appointments/", response_model=AppointmentResponse)
def create_appointment(appointment: AppointmentCreate, db: Session = Depends(get_db)):
    db_appointment = AppointmentDB(**appointment.model_dump())
    db.add(db_appointment)
    db.commit()
    db.refresh(db_appointment)
    return db_appointment

@app.get("/appointments/", response_model=List[AppointmentResponse])
def list_appointments(db: Session = Depends(get_db)):
    return db.query(AppointmentDB).all()

@app.delete("/appointments/{appointment_id}")
def delete_appointment(appointment_id: int, db: Session = Depends(get_db)):
    db_appointment = db.query(AppointmentDB).filter(AppointmentDB.id == appointment_id).first()
    if not db_appointment:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    db.delete(db_appointment)
    db.commit()
    return {"message": "Agendamento cancelado com sucesso"}