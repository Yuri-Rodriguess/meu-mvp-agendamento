import datetime
import os

# Os testes não devem depender de um .env real (nem existir no ambiente de
# CI): definimos valores de teste antes de importar main.py, que lê essas
# variáveis assim que o módulo é carregado.
os.environ.setdefault("SECRET_KEY", "chave-de-teste-nao-use-em-producao")
os.environ.setdefault("TEST_RUNNER_API_KEY", "chave-de-teste-run-tests")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:5173")

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

def test_busca_agendamentos_por_nome_ou_servico():
    """A busca deve filtrar por nome do cliente OU serviço, ignorando maiúsculas/minúsculas"""
    client.post("/appointments/", json={
        "client_name": "Maria Fernanda", "service": "Manicure", "date_time": "2026-09-04T09:00:00",
    })
    client.post("/appointments/", json={
        "client_name": "Joao Pedro", "service": "Corte de Cabelo", "date_time": "2026-09-04T10:00:00",
    })

    por_nome = client.get("/appointments/", params={"search": "maria"})
    assert por_nome.status_code == 200
    assert any(a["client_name"] == "Maria Fernanda" for a in por_nome.json())
    assert all("joao" not in a["client_name"].lower() for a in por_nome.json())

    por_servico = client.get("/appointments/", params={"search": "corte"})
    assert any(a["service"] == "Corte de Cabelo" for a in por_servico.json())

def test_login_devolve_access_e_refresh_token():
    assert client.post("/register", json={"username": "refresh_tester", "password": "senha12345"}).status_code == 200

    resposta_login = client.post("/login", data={"username": "refresh_tester", "password": "senha12345"})
    assert resposta_login.status_code == 200
    corpo = resposta_login.json()
    assert "access_token" in corpo
    assert "refresh_token" in corpo

def test_refresh_token_gera_novo_access_token():
    assert client.post("/register", json={"username": "refresh_tester_2", "password": "senha12345"}).status_code == 200
    refresh_token = client.post("/login", data={"username": "refresh_tester_2", "password": "senha12345"}).json()["refresh_token"]

    resposta_refresh = client.post("/refresh", json={"refresh_token": refresh_token})
    assert resposta_refresh.status_code == 200
    assert "access_token" in resposta_refresh.json()

def test_refresh_rejeita_access_token_usado_no_lugar_do_refresh():
    """Um access token não deve funcionar como refresh token, mesmo sendo
    um JWT válido — a rota checa a claim "type" dentro do token."""
    assert client.post("/register", json={"username": "refresh_tester_3", "password": "senha12345"}).status_code == 200
    access_token = client.post("/login", data={"username": "refresh_tester_3", "password": "senha12345"}).json()["access_token"]

    resposta_refresh = client.post("/refresh", json={"refresh_token": access_token})
    assert resposta_refresh.status_code == 401