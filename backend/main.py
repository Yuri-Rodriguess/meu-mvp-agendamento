import os
from fastapi import FastAPI, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone

# Duração assumida de cada agendamento (o calendário do frontend também
# desenha os eventos com 1h de duração — ver AppointmentList.jsx)
DURACAO_AGENDAMENTO = timedelta(hours=1)
import subprocess
import sys
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv

import models
import schemas
from database import engine, SessionLocal

load_dotenv()

# Origens autorizadas a consumir a API (nunca usar "*" fora de um teste rápido local)
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

# Chave exigida para acionar o pipeline de testes via API (ver .env.example)
TEST_RUNNER_API_KEY = os.getenv("TEST_RUNNER_API_KEY")

# Cria as tabelas no banco de dados
models.Base.metadata.create_all(bind=engine)


def _garantir_coluna_owner_id():
    """create_all() só cria tabelas novas — como 'appointments' já existia
    antes da coluna owner_id ser adicionada, precisamos de uma migração
    manual simples (o projeto não usa Alembic)."""
    inspector = inspect(engine)
    if "appointments" not in inspector.get_table_names():
        return
    colunas = [col["name"] for col in inspector.get_columns("appointments")]
    if "owner_id" not in colunas:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE appointments ADD COLUMN owner_id INTEGER REFERENCES users(id)"))


_garantir_coluna_owner_id()

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

# Dependência para pegar a sessão do banco
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def verify_test_runner_key(x_api_key: str | None = Header(None)):
    """Protege a rota que dispara o Pytest: sem isso, qualquer visitante
    poderia acionar execução de processos no servidor repetidamente."""
    if not TEST_RUNNER_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="TEST_RUNNER_API_KEY não configurada no servidor (veja .env.example).",
        )
    if x_api_key != TEST_RUNNER_API_KEY:
        raise HTTPException(status_code=401, detail="Chave de API inválida.")

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def _chave_secreta() -> str:
    if not SECRET_KEY:
        raise HTTPException(
            status_code=500,
            detail="SECRET_KEY não configurada no servidor (veja .env.example).",
        )
    return SECRET_KEY

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, _chave_secreta(), algorithm=ALGORITHM)

# Função que verifica se o usuário está logado em cada requisição
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, _chave_secreta(), algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(models.UserDB).filter(models.UserDB.username == username).first()
    if user is None:
        raise credentials_exception
    return user

# --- ROTAS DE AUTENTICAÇÃO ---
@app.post("/register")
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    user_exists = db.query(models.UserDB).filter(models.UserDB.username == user.username).first()
    if user_exists:
        raise HTTPException(status_code=400, detail="Usuário já existe")
    hashed_pw = get_password_hash(user.password)
    new_user = models.UserDB(username=user.username, hashed_password=hashed_pw)
    db.add(new_user)
    db.commit()
    return {"message": "Usuário criado com sucesso!"}

@app.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.UserDB).filter(models.UserDB.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Usuário ou senha incorretos")
    
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# Configuração de CORS para permitir que o React converse com o FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _tem_conflito_de_horario(db: Session, owner_id: int, date_time: datetime, ignorar_id: int | None = None) -> bool:
    """Verifica se o horário pedido colide com outro agendamento do mesmo
    usuário, assumindo que cada agendamento ocupa DURACAO_AGENDAMENTO.
    Busca candidatos numa janela de tempo e compara em Python, para não
    depender de aritmética de data no SQL (nem todo dialeto suporta bem)."""
    novo_inicio = date_time
    novo_fim = date_time + DURACAO_AGENDAMENTO
    candidatos = db.query(models.AppointmentDB).filter(
        models.AppointmentDB.owner_id == owner_id,
        models.AppointmentDB.date_time > novo_inicio - DURACAO_AGENDAMENTO,
        models.AppointmentDB.date_time < novo_fim,
    )
    if ignorar_id is not None:
        candidatos = candidatos.filter(models.AppointmentDB.id != ignorar_id)
    return any(
        existente.date_time < novo_fim and existente.date_time + DURACAO_AGENDAMENTO > novo_inicio
        for existente in candidatos
    )

@app.post("/appointments/", response_model=schemas.AppointmentResponse)
def create_appointment(appointment: schemas.AppointmentCreate, db: Session = Depends(get_db), current_user: models.UserDB = Depends(get_current_user)):
    if _tem_conflito_de_horario(db, current_user.id, appointment.date_time):
        raise HTTPException(status_code=409, detail="Já existe um agendamento seu nesse horário.")
    db_appointment = models.AppointmentDB(**appointment.model_dump(), owner_id=current_user.id)
    db.add(db_appointment)
    db.commit()
    db.refresh(db_appointment)
    return db_appointment

@app.get("/appointments/", response_model=list[schemas.AppointmentResponse])
def list_appointments(db: Session = Depends(get_db), current_user: models.UserDB = Depends(get_current_user)):
    # Cada usuário só enxerga os próprios agendamentos
    return db.query(models.AppointmentDB).filter(models.AppointmentDB.owner_id == current_user.id).all()

@app.put("/appointments/{appointment_id}", response_model=schemas.AppointmentResponse)
def update_appointment(
    appointment_id: int,
    appointment: schemas.AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user),
):
    db_appointment = (
        db.query(models.AppointmentDB)
        .filter(models.AppointmentDB.id == appointment_id, models.AppointmentDB.owner_id == current_user.id)
        .first()
    )
    if not db_appointment:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    if _tem_conflito_de_horario(db, current_user.id, appointment.date_time, ignorar_id=appointment_id):
        raise HTTPException(status_code=409, detail="Já existe um agendamento seu nesse horário.")
    db_appointment.client_name = appointment.client_name
    db_appointment.service = appointment.service
    db_appointment.date_time = appointment.date_time
    db.commit()
    db.refresh(db_appointment)
    return db_appointment

@app.delete("/appointments/{appointment_id}")
def delete_appointment(appointment_id: int, db: Session = Depends(get_db), current_user: models.UserDB = Depends(get_current_user)):
    db_appointment = (
        db.query(models.AppointmentDB)
        .filter(models.AppointmentDB.id == appointment_id, models.AppointmentDB.owner_id == current_user.id)
        .first()
    )
    if not db_appointment:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    db.delete(db_appointment)
    db.commit()
    return {"message": "Agendamento cancelado com sucesso"}

@app.get("/api/run-tests", dependencies=[Depends(verify_test_runner_key)])
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
    
@app.get("/users/", response_model=list[schemas.UserResponse])
def list_users(db: Session = Depends(get_db), current_user: models.UserDB = Depends(get_current_user)):
    """Lista todos os administradores cadastrados no sistema (Rota Protegida)"""
    return db.query(models.UserDB).all()

@app.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.UserDB = Depends(get_current_user)):
    """Rota protegida: Apenas o super admin 'Yuri' pode deletar contas"""
    
    # 1. A Trava de Segurança (God Mode)
    if current_user.username.lower() != "yuri":
        raise HTTPException(status_code=403, detail="Acesso Negado: Apenas o administrador Yuri tem permissão para deletar usuários.")
    
    # 2. Busca o usuário que será deletado
    user_to_delete = db.query(models.UserDB).filter(models.UserDB.id == user_id).first()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
        
    # 3. Proteção extra: Yuri não pode deletar a si mesmo sem querer
    if user_to_delete.id == current_user.id:
        raise HTTPException(status_code=400, detail="Você não pode deletar a sua própria conta de Super Administrador.")
        
    # 4. Executa a deleção
    db.delete(user_to_delete)
    db.commit()
    return {"message": "Administrador removido com sucesso"}