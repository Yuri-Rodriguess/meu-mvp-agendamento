from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import sys
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime

import models
import schemas
from database import engine, SessionLocal

# Cria as tabelas no banco de dados
models.Base.metadata.create_all(bind=engine)

def tarefa_testes_diarios():
    """Função que o agendador vai executar sozinho no horário marcado"""
    print(f"\n[{datetime.now()}] ⚙️ Iniciando bateria de testes automáticos das 22h...")
    try:
        subprocess.run(
            [sys.executable, "-m", "pytest", "-v", "test_api.py"],
            capture_output=True,
            text=True
        )
        print(f"[{datetime.now()}] ✅ Testes das 22h finalizados com sucesso!")
    except Exception as e:
        print(f"[{datetime.now()}] ❌ Erro ao rodar testes automáticos: {e}")

# O 'lifespan' garante que o relógio inicie quando a API ligar, e desligue quando a API parar
@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = BackgroundScheduler()
    # Configura para rodar todos os dias, exatamente às 22h e 00 minutos
    scheduler.add_job(tarefa_testes_diarios, 'cron', hour=22, minute=0)
    scheduler.start()
    print("⏰ Agendador ativado! Testes programados para as 22:00.")
    yield
    scheduler.shutdown()
    print("⏰ Agendador desligado.")

# --- INICIALIZAÇÃO DA APLICAÇÃO FASTAPI ---
# Adicionamos o lifespan aqui na criação do app
app = FastAPI(title="MVP Agendamento Online", lifespan=lifespan)

# Configuração de CORS para permitir que o React converse com o FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependência para pegar a sessão do banco
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/appointments/", response_model=schemas.AppointmentResponse)
def create_appointment(appointment: schemas.AppointmentCreate, db: Session = Depends(get_db)):
    db_appointment = models.AppointmentDB(**appointment.model_dump())
    db.add(db_appointment)
    db.commit()
    db.refresh(db_appointment)
    return db_appointment

@app.get("/appointments/", response_model=list[schemas.AppointmentResponse])
def list_appointments(db: Session = Depends(get_db)):
    return db.query(models.AppointmentDB).all()

@app.delete("/appointments/{appointment_id}")
def delete_appointment(appointment_id: int, db: Session = Depends(get_db)):
    db_appointment = db.query(models.AppointmentDB).filter(models.AppointmentDB.id == appointment_id).first()
    if not db_appointment:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    db.delete(db_appointment)
    db.commit()
    return {"message": "Agendamento cancelado com sucesso"}

@app.get("/api/run-tests")
def rodar_testes_automatizados():
    """Endpoint exclusivo para o Dashboard que aciona o Pytest sob demanda"""
    try:
        # Executa o pytest e captura o texto do terminal
        result = subprocess.run(
            [sys.executable, "-m", "pytest", "-v", "test_api.py"],
            capture_output=True,
            text=True
        )
        return {"log": result.stdout + result.stderr}
    except Exception as e:
        return {"log": f"Erro crítico ao executar pipeline: {str(e)}"}