import contextlib
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

# Os testes de /register e /login fazem várias chamadas reais em sequência,
# todas "vindas" do mesmo IP fake do TestClient — sem isso, o rate limiting
# (pensado para tráfego real) derrubaria a própria suíte de testes com 429.
app.state.limiter.enabled = False

# Os testes rodam contra um banco SQLite isolado, nunca contra o
# agendamento.db real: assim o pipeline de CI não cria "sujeira" nos
# dados de produção toda vez que é acionado (manualmente ou às 22h).
TEST_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_agendamento.db")

# Vários testes usam dados fixos (mesmo horário, mesmo username) e não
# limpam o que criam. Rodar a suíte duas vezes seguidas sem apagar o banco
# anterior gera 409/400 de "já existe" — por isso começamos cada execução
# derrubando o arquivo da vez anterior, garantindo um banco sempre vazio.
for suffix in ("", "-journal", "-wal", "-shm"):
    path = TEST_DB_PATH + suffix
    if os.path.exists(path):
        os.remove(path)

TEST_DATABASE_URL = f"sqlite:///{TEST_DB_PATH}"
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


@contextlib.contextmanager
def autenticacao_real():
    """O Passe VIP do robô vale para toda rota que dependa de
    get_current_user — inclusive /users/. Testes de permissão por role
    precisam que a validação de token rode de verdade a partir do
    Authorization header, então desligamos o bypass só durante eles."""
    app.dependency_overrides.pop(get_current_user, None)
    try:
        yield
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user

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

def test_criar_agendamento_com_email_nao_quebra_mesmo_sem_smtp_configurado():
    """O envio de e-mail roda em background e nunca deve impedir a criação
    do agendamento, mesmo quando o SMTP não está configurado no ambiente
    de teste (ver notifications.py e SMTP_* no .env.example)."""
    resposta = client.post("/appointments/", json={
        "client_name": "Cliente Com Email",
        "service": "Corte",
        "date_time": "2026-09-05T09:00:00",
        "client_email": "cliente@teste.com",
    })
    assert resposta.status_code == 200
    assert resposta.json()["client_email"] == "cliente@teste.com"

def test_criar_agendamento_gera_token_de_ativacao_do_telegram():
    """Todo agendamento novo já nasce com um token para o link de ativação
    do lembrete via Telegram (ver telegram_link_token em models.py), mas
    ainda não vinculado a nenhum chat."""
    resposta = client.post("/appointments/", json={
        "client_name": "Cliente Telegram",
        "service": "Corte",
        "date_time": "2026-09-06T09:00:00",
    })
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["telegram_link_token"]
    assert corpo["telegram_linked"] is False

def test_client_phone_e_salvo_e_retornado():
    resposta = client.post("/appointments/", json={
        "client_name": "Cliente Com Celular",
        "service": "Corte",
        "date_time": "2026-09-06T10:00:00",
        "client_phone": "11912345678",
    })
    assert resposta.status_code == 200
    assert resposta.json()["client_phone"] == "11912345678"

def test_editar_agendamento_atualiza_celular():
    criado = client.post("/appointments/", json={
        "client_name": "Cliente Sem Celular", "service": "Corte", "date_time": "2026-09-06T11:00:00",
    }).json()

    editado = client.put(f"/appointments/{criado['id']}", json={
        "client_name": "Cliente Sem Celular", "service": "Corte",
        "date_time": "2026-09-06T11:00:00", "client_phone": "11987654321",
    })
    assert editado.status_code == 200
    assert editado.json()["client_phone"] == "11987654321"

def test_editar_horario_reseta_lembrete_ja_enviado():
    """Se o horário muda, o lembrete de 2h precisa poder disparar de novo
    (ver reminder_sent em main.py/update_appointment)."""
    criado = client.post("/appointments/", json={
        "client_name": "Cliente Remarcado", "service": "Corte", "date_time": "2026-09-06T12:00:00",
    }).json()

    # Simula que o lembrete já tinha sido enviado para o horário original
    db = TestingSessionLocal()
    try:
        agendamento = db.query(models.AppointmentDB).filter(models.AppointmentDB.id == criado["id"]).first()
        agendamento.reminder_sent = True
        db.commit()
    finally:
        db.close()

    client.put(f"/appointments/{criado['id']}", json={
        "client_name": "Cliente Remarcado", "service": "Corte", "date_time": "2026-09-06T13:00:00",
    })

    db = TestingSessionLocal()
    try:
        agendamento = db.query(models.AppointmentDB).filter(models.AppointmentDB.id == criado["id"]).first()
        assert agendamento.reminder_sent is False
    finally:
        db.close()

def test_criar_e_listar_profissionais():
    resposta = client.post("/professionals/", json={"name": "Maria"})
    assert resposta.status_code == 200
    assert resposta.json()["name"] == "Maria"

    listagem = client.get("/professionals/")
    assert listagem.status_code == 200
    assert any(p["name"] == "Maria" for p in listagem.json())

def test_criar_agendamento_com_profissional_valido_retorna_nome():
    profissional = client.post("/professionals/", json={"name": "Carlos Barbeiro"}).json()
    resposta = client.post("/appointments/", json={
        "client_name": "Cliente X", "service": "Corte", "date_time": "2026-09-08T09:00:00",
        "professional_id": profissional["id"],
    })
    assert resposta.status_code == 200
    assert resposta.json()["professional_name"] == "Carlos Barbeiro"

def test_criar_agendamento_com_profissional_inexistente_retorna_404():
    resposta = client.post("/appointments/", json={
        "client_name": "Cliente X", "service": "Corte", "date_time": "2026-09-08T11:00:00",
        "professional_id": 999999,
    })
    assert resposta.status_code == 404

def test_deletar_profissional_remove_atribuicao_do_agendamento():
    """O agendamento continua existindo depois de excluir o profissional —
    só perde a atribuição (ver delete_professional em main.py)."""
    profissional = client.post("/professionals/", json={"name": "Ana Manicure"}).json()
    agendamento = client.post("/appointments/", json={
        "client_name": "Cliente Y", "service": "Manicure", "date_time": "2026-09-08T14:00:00",
        "professional_id": profissional["id"],
    }).json()

    assert client.delete(f"/professionals/{profissional['id']}").status_code == 200

    agendamentos = client.get("/appointments/").json()
    atualizado = next(a for a in agendamentos if a["id"] == agendamento["id"])
    assert atualizado["professional_id"] is None
    assert atualizado["professional_name"] is None

def test_profissional_e_isolado_por_conta():
    """Um salão não pode ver nem atribuir agendamentos ao profissional de
    outra conta (mesmo isolamento de appointments.owner_id)."""
    with autenticacao_real():
        client.post("/register", json={"username": "salao_a", "password": "senha12345"})
        client.post("/register", json={"username": "salao_b", "password": "senha12345"})
        token_a = client.post("/login", data={"username": "salao_a", "password": "senha12345"}).json()["access_token"]
        token_b = client.post("/login", data={"username": "salao_b", "password": "senha12345"}).json()["access_token"]

        criado = client.post(
            "/professionals/", json={"name": "Funcionária do Salão A"},
            headers={"Authorization": f"Bearer {token_a}"},
        )
        profissional_id = criado.json()["id"]

        listagem_b = client.get("/professionals/", headers={"Authorization": f"Bearer {token_b}"})
        assert all(p["id"] != profissional_id for p in listagem_b.json())

        resposta = client.post(
            "/appointments/",
            json={
                "client_name": "Cliente do Salão B", "service": "Corte", "date_time": "2026-09-09T09:00:00",
                "professional_id": profissional_id,
            },
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert resposta.status_code == 404

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

def test_usuario_comum_nao_pode_deletar_outra_conta():
    with autenticacao_real():
        assert client.post("/register", json={"username": "usuario_comum", "password": "senha12345"}).status_code == 200
        assert client.post("/register", json={"username": "vitima", "password": "senha12345"}).status_code == 200

        token_comum = client.post("/login", data={"username": "usuario_comum", "password": "senha12345"}).json()["access_token"]
        cabecalho = {"Authorization": f"Bearer {token_comum}"}

        usuarios = client.get("/users/", headers=cabecalho).json()
        vitima_id = next(u["id"] for u in usuarios if u["username"] == "vitima")

        resposta = client.delete(f"/users/{vitima_id}", headers=cabecalho)
        assert resposta.status_code == 403

def test_registrar_como_yuri_concede_role_admin():
    """Compatibilidade com o comportamento antigo: quem se cadastra com o
    username "yuri" nasce admin e pode deletar outras contas."""
    with autenticacao_real():
        assert client.post("/register", json={"username": "yuri", "password": "senha12345"}).status_code == 200
        assert client.post("/register", json={"username": "vitima_2", "password": "senha12345"}).status_code == 200

        token_yuri = client.post("/login", data={"username": "yuri", "password": "senha12345"}).json()["access_token"]
        cabecalho = {"Authorization": f"Bearer {token_yuri}"}

        usuarios = client.get("/users/", headers=cabecalho).json()
        yuri_na_lista = next(u for u in usuarios if u["username"] == "yuri")
        assert yuri_na_lista["role"] == "admin"

        vitima_id = next(u["id"] for u in usuarios if u["username"] == "vitima_2")
        resposta = client.delete(f"/users/{vitima_id}", headers=cabecalho)
        assert resposta.status_code == 200