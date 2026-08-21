import datetime

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models
from main import app, get_current_user, get_db
from models import UserDB

# Os testes rodam contra um banco SQLite isolado, nunca contra o
# agendamento.db real: assim o pipeline de CI não cria "sujeira" nos
# dados de produção toda vez que é acionado (manualmente ou às 22h).
TEST_DATABASE_URL = "sqlite:///./test_agendamento.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

models.Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- O PASSE VIP DO ROBÔ ---
# Cria um usuário falso na memória apenas para os testes passarem pela barreira de segurança
def override_get_current_user():
    return UserDB(id=999, username="robo_de_teste", hashed_password="123")

# Avisa o FastAPI para ignorar a verificação de token oficial e usar o nosso Passe VIP,
# e para usar o banco de testes isolado em vez do agendamento.db real
app.dependency_overrides[get_current_user] = override_get_current_user
app.dependency_overrides[get_db] = override_get_db

# ---------------------------

client = TestClient(app)

def test_listar_agendamentos_online():
    """Verifica se a listagem de agendamentos está respondendo corretamente"""
    response = client.get("/appointments/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_criar_agendamento_pipeline_ci():
    """Simula a criação de um agendamento com dados dinâmicos e valida o banco"""
    agora = datetime.datetime.now().isoformat()
    novo_agendamento = {
        "client_name": "Usuário de Teste (CI/CD)",
        "service": "Validação Automática do Sistema",
        "date_time": agora
    }
    response = client.post("/appointments/", json=novo_agendamento)
    
    # Garante que o item foi criado com sucesso (Status 200) e recebeu um ID
    assert response.status_code == 200
    assert "id" in response.json()

def test_bloqueia_conflito_de_horario():
    """Não deve permitir dois agendamentos do mesmo usuário no mesmo horário"""
    horario = "2026-09-01T15:00:00"
    primeiro = {"client_name": "Cliente 1", "service": "Corte", "date_time": horario}
    segundo = {"client_name": "Cliente 2", "service": "Barba", "date_time": horario}

    resposta_1 = client.post("/appointments/", json=primeiro)
    assert resposta_1.status_code == 200

    resposta_2 = client.post("/appointments/", json=segundo)
    assert resposta_2.status_code == 409

def test_editar_agendamento():
    """Deve permitir atualizar um agendamento existente"""
    original = {"client_name": "Cliente Original", "service": "Corte", "date_time": "2026-09-02T09:00:00"}
    resposta_criacao = client.post("/appointments/", json=original)
    assert resposta_criacao.status_code == 200
    appointment_id = resposta_criacao.json()["id"]

    atualizado = {"client_name": "Cliente Editado", "service": "Corte e Barba", "date_time": "2026-09-02T09:00:00"}
    resposta_edicao = client.put(f"/appointments/{appointment_id}", json=atualizado)
    assert resposta_edicao.status_code == 200
    assert resposta_edicao.json()["client_name"] == "Cliente Editado"
    assert resposta_edicao.json()["service"] == "Corte e Barba"

def test_editar_agendamento_inexistente_retorna_404():
    resposta = client.put(
        "/appointments/999999",
        json={"client_name": "X", "service": "Y", "date_time": "2026-09-03T09:00:00"},
    )
    assert resposta.status_code == 404