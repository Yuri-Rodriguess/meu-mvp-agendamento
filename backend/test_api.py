from fastapi.testclient import TestClient
from main import app, get_current_user
from models import UserDB
import datetime

# --- O PASSE VIP DO ROBÔ ---
# Cria um usuário falso na memória apenas para os testes passarem pela barreira de segurança
def override_get_current_user():
    return UserDB(id=999, username="robo_de_teste", hashed_password="123")

# Avisa o FastAPI para ignorar a verificação de token oficial e usar o nosso Passe VIP
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