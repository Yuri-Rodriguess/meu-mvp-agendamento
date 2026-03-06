from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
import subprocess
import sys
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler

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

# Dependência para pegar a sessão do banco
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

SECRET_KEY = "chave-super-secreta-do-mvp-agendamento"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# Função que verifica se o usuário está logado em cada requisição
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
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
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/appointments/", response_model=schemas.AppointmentResponse)
def create_appointment(appointment: schemas.AppointmentCreate, db: Session = Depends(get_db), current_user: models.UserDB = Depends(get_current_user)):
    db_appointment = models.AppointmentDB(**appointment.model_dump())
    db.add(db_appointment)
    db.commit()
    db.refresh(db_appointment)
    return db_appointment

@app.get("/appointments/", response_model=list[schemas.AppointmentResponse])
def list_appointments(db: Session = Depends(get_db), current_user: models.UserDB = Depends(get_current_user)):
    return db.query(models.AppointmentDB).all()

@app.delete("/appointments/{appointment_id}")
def delete_appointment(appointment_id: int, db: Session = Depends(get_db), current_user: models.UserDB = Depends(get_current_user)):
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