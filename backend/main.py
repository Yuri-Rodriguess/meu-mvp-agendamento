import os
import secrets
import subprocess
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import BackgroundTasks, FastAPI, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from jose import JWTError, jwt
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

import models
import notifications
import schemas
from database import SessionLocal

load_dotenv()

# Duração assumida de cada agendamento (o calendário do frontend também
# desenha os eventos com 1h de duração — ver AppointmentList.jsx)
DURACAO_AGENDAMENTO = timedelta(hours=1)

# Origens autorizadas a consumir a API (nunca usar "*" fora de um teste rápido local)
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

# Chave exigida para acionar o pipeline de testes via API (ver .env.example)
TEST_RUNNER_API_KEY = os.getenv("TEST_RUNNER_API_KEY")

# O schema do banco é criado/atualizado via Alembic (rode "alembic upgrade
# head" antes de iniciar o servidor — veja README), não mais em tempo de
# execução aqui. Isso substitui o antigo create_all() + ALTER TABLE manual.

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

# Janela usada pelo lembrete de Telegram: um agendamento entra na fila assim
# que faltar 2h ou menos para ele (ver enviar_lembretes_pendentes).
JANELA_LEMBRETE_TELEGRAM = timedelta(hours=2)

def processar_ativacoes_telegram():
    """Job periódico e leve (roda a cada 15s): pergunta ao Telegram se
    alguém apertou "Start" no link de ativação (ver telegram_link_token em
    models.py) e, se sim, vincula aquele chat ao agendamento certo."""
    if not notifications.telegram_configurado():
        return
    ativacoes = notifications.buscar_novas_ativacoes_telegram()
    if not ativacoes:
        return
    db = SessionLocal()
    try:
        for ativacao in ativacoes:
            agendamento = db.query(models.AppointmentDB).filter(
                models.AppointmentDB.telegram_link_token == ativacao["token"]
            ).first()
            if agendamento is None:
                continue
            agendamento.telegram_chat_id = ativacao["chat_id"]
            db.commit()
            notifications.confirmar_ativacao_telegram(ativacao["chat_id"])
    finally:
        db.close()

def enviar_lembretes_pendentes():
    """Job periódico (a cada 15min): dispara o lembrete via Telegram para
    agendamentos a ~2h de distância que já têm o chat vinculado e ainda não
    foram avisados."""
    db = SessionLocal()
    try:
        agora = datetime.now()
        candidatos = db.query(models.AppointmentDB).filter(
            models.AppointmentDB.telegram_chat_id.isnot(None),
            models.AppointmentDB.reminder_sent.is_(False),
            models.AppointmentDB.date_time > agora,
            models.AppointmentDB.date_time <= agora + JANELA_LEMBRETE_TELEGRAM,
        ).all()
        for agendamento in candidatos:
            notifications.enviar_lembrete_telegram(
                agendamento.telegram_chat_id,
                agendamento.client_name,
                agendamento.service,
                agendamento.date_time,
            )
            agendamento.reminder_sent = True
            db.commit()
    finally:
        db.close()

# O 'lifespan' garante que o relógio inicie quando a API ligar, e desligue quando a API parar
@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = BackgroundScheduler()
    # Configura para rodar todos os dias, exatamente às 22h e 00 minutos
    scheduler.add_job(tarefa_testes_diarios, 'cron', hour=22, minute=0)
    # Sem TELEGRAM_BOT_TOKEN configurado essas duas funções só retornam na
    # hora (ver notifications.telegram_configurado) — não custa nada deixá-
    # las agendadas sempre.
    scheduler.add_job(processar_ativacoes_telegram, 'interval', seconds=15, id='telegram_polling')
    scheduler.add_job(enviar_lembretes_pendentes, 'interval', minutes=15, id='lembretes_telegram')
    scheduler.start()
    print("⏰ Agendador ativado! Testes programados para as 22:00.")
    yield
    scheduler.shutdown()
    print("⏰ Agendador desligado.")

# --- INICIALIZAÇÃO DA APLICAÇÃO FASTAPI ---
# Adicionamos o lifespan aqui na criação do app
app = FastAPI(title="MVP Agendamento Online", lifespan=lifespan)

# Limita tentativas de login/cadastro por IP: sem isso, nada impedia um
# ataque de força bruta contra a senha de qualquer conta.
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter


def _limite_excedido(request: Request, exc: RateLimitExceeded):
    # Resposta no mesmo formato ({"detail": ...}) usado pelo resto da API,
    # em vez do {"error": ...} padrão do slowapi
    return JSONResponse(
        status_code=429,
        content={"detail": "Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente."},
    )


app.add_exception_handler(RateLimitExceeded, _limite_excedido)

# Dependência para pegar a sessão do banco
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
# O access token dura pouco de propósito (era 60min sem refresh token;
# agora que existe /refresh, reduzir a exposição em caso de vazamento
# compensa mais do que a conveniência de durar mais).
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

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
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, _chave_secreta(), algorithm=ALGORITHM)

def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
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
        # Garante que um refresh token (de vida longa) não seja aceito
        # como se fosse um access token
        if payload.get("type") != "access":
            raise credentials_exception
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
@limiter.limit("5/minute")
def register(request: Request, user: schemas.UserCreate, db: Session = Depends(get_db)):
    user_exists = db.query(models.UserDB).filter(models.UserDB.username == user.username).first()
    if user_exists:
        raise HTTPException(status_code=400, detail="Usuário já existe")
    hashed_pw = get_password_hash(user.password)
    # Mantém o comportamento original: quem se cadastra como "yuri" nasce
    # super admin. A diferença é que agora isso é um dado (role), não uma
    # comparação de string espalhada pelas rotas.
    role = "admin" if user.username.lower() == "yuri" else "user"
    new_user = models.UserDB(username=user.username, hashed_password=hashed_pw, role=role)
    db.add(new_user)
    db.commit()
    return {"message": "Usuário criado com sucesso!"}

@app.post("/login", response_model=schemas.Token)
@limiter.limit("10/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.UserDB).filter(models.UserDB.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Usuário ou senha incorretos")

    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    refresh_token = create_refresh_token(data={"sub": user.username})
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@app.post("/refresh", response_model=schemas.Token)
@limiter.limit("20/minute")
def refresh_access_token(request: Request, body: schemas.RefreshRequest, db: Session = Depends(get_db)):
    """Troca um refresh token válido por um novo access token, sem exigir
    login de novo — é o que permite a sessão continuar depois que o access
    token (de vida curta) expira."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Refresh token inválido ou expirado. Faça login novamente.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(body.refresh_token, _chave_secreta(), algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise credentials_exception
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.UserDB).filter(models.UserDB.username == username).first()
    if user is None:
        raise credentials_exception

    # Busca o role atual do banco (não do token antigo), para o caso de ter
    # mudado entre o login original e essa renovação
    novo_access_token = create_access_token(data={"sub": user.username, "role": user.role})
    return {"access_token": novo_access_token, "refresh_token": body.refresh_token, "token_type": "bearer"}

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

def _validar_profissional(db: Session, owner_id: int, professional_id: int | None) -> None:
    """Garante que o profissional escolhido existe e pertence à mesma
    conta — sem isso, um usuário poderia atribuir agendamentos a um
    profissional de outra conta só adivinhando o id."""
    if professional_id is None:
        return
    existe = db.query(models.ProfessionalDB).filter(
        models.ProfessionalDB.id == professional_id,
        models.ProfessionalDB.owner_id == owner_id,
    ).first()
    if not existe:
        raise HTTPException(status_code=404, detail="Profissional não encontrado.")

@app.post("/appointments/", response_model=schemas.AppointmentResponse)
def create_appointment(
    appointment: schemas.AppointmentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user),
):
    if _tem_conflito_de_horario(db, current_user.id, appointment.date_time):
        raise HTTPException(status_code=409, detail="Já existe um agendamento seu nesse horário.")
    _validar_profissional(db, current_user.id, appointment.professional_id)
    db_appointment = models.AppointmentDB(
        **appointment.model_dump(),
        owner_id=current_user.id,
        # Usado no link de ativação do lembrete via Telegram (t.me/<bot>?start=<token>)
        telegram_link_token=secrets.token_urlsafe(8),
    )
    db.add(db_appointment)
    db.commit()
    db.refresh(db_appointment)
    if db_appointment.client_email:
        # Em background: o e-mail não deve atrasar a resposta da API nem
        # fazer o agendamento falhar se o envio der problema.
        background_tasks.add_task(
            notifications.enviar_confirmacao_agendamento,
            db_appointment.client_email,
            db_appointment.client_name,
            db_appointment.service,
            db_appointment.date_time,
        )
    return db_appointment

@app.get("/appointments/", response_model=list[schemas.AppointmentResponse])
def list_appointments(
    search: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user),
):
    # Cada usuário só enxerga os próprios agendamentos
    query = db.query(models.AppointmentDB).filter(models.AppointmentDB.owner_id == current_user.id)
    if search:
        termo = f"%{search}%"
        query = query.filter(
            or_(
                models.AppointmentDB.client_name.ilike(termo),
                models.AppointmentDB.service.ilike(termo),
            )
        )
    return query.order_by(models.AppointmentDB.date_time).offset(skip).limit(limit).all()

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
    _validar_profissional(db, current_user.id, appointment.professional_id)
    if db_appointment.date_time != appointment.date_time:
        # Horário mudou: o lembrete de "faltam 2h" precisa poder disparar
        # de novo para o novo horário.
        db_appointment.reminder_sent = False
    db_appointment.client_name = appointment.client_name
    db_appointment.service = appointment.service
    db_appointment.date_time = appointment.date_time
    db_appointment.client_email = appointment.client_email
    db_appointment.client_phone = appointment.client_phone
    db_appointment.professional_id = appointment.professional_id
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

# --- ROTAS DE PROFISSIONAIS (equipe que atende os agendamentos) ---
@app.post("/professionals/", response_model=schemas.ProfessionalResponse)
def create_professional(
    professional: schemas.ProfessionalCreate,
    db: Session = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user),
):
    db_professional = models.ProfessionalDB(name=professional.name, owner_id=current_user.id)
    db.add(db_professional)
    db.commit()
    db.refresh(db_professional)
    return db_professional

@app.get("/professionals/", response_model=list[schemas.ProfessionalResponse])
def list_professionals(db: Session = Depends(get_db), current_user: models.UserDB = Depends(get_current_user)):
    # Cada conta só enxerga a própria equipe
    return (
        db.query(models.ProfessionalDB)
        .filter(models.ProfessionalDB.owner_id == current_user.id)
        .order_by(models.ProfessionalDB.name)
        .all()
    )

@app.delete("/professionals/{professional_id}")
def delete_professional(
    professional_id: int,
    db: Session = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user),
):
    db_professional = (
        db.query(models.ProfessionalDB)
        .filter(models.ProfessionalDB.id == professional_id, models.ProfessionalDB.owner_id == current_user.id)
        .first()
    )
    if not db_professional:
        raise HTTPException(status_code=404, detail="Profissional não encontrado.")

    # Agendamentos que apontavam pra esse profissional continuam existindo,
    # só perdem a atribuição (em vez de serem bloqueados ou apagados junto).
    db.query(models.AppointmentDB).filter(
        models.AppointmentDB.professional_id == professional_id
    ).update({"professional_id": None})

    db.delete(db_professional)
    db.commit()
    return {"message": "Profissional removido com sucesso"}

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
    """Rota protegida: apenas contas com role="admin" podem deletar usuários"""

    # 1. A Trava de Segurança — antes comparava o username com "yuri" na
    # unha; agora qualquer conta marcada como admin tem essa permissão.
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso Negado: apenas administradores podem deletar usuários.")

    # 2. Busca o usuário que será deletado
    user_to_delete = db.query(models.UserDB).filter(models.UserDB.id == user_id).first()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    # 3. Proteção extra: um admin não pode deletar a si mesmo sem querer
    if user_to_delete.id == current_user.id:
        raise HTTPException(status_code=400, detail="Você não pode deletar a sua própria conta de administrador.")
        
    # 4. Executa a deleção
    db.delete(user_to_delete)
    db.commit()
    return {"message": "Administrador removido com sucesso"}