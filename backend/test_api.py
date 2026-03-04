from fastapi.testclient import TestClient
from main import app
import datetime

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
    
    assert response.status_code == 200
    assert "id" in response.json()