import datetime
import os
from unittest.mock import MagicMock, patch

os.environ.setdefault("SECRET_KEY", "chave-de-teste-nao-use-em-producao")

import notifications


def test_smtp_configurado_false_sem_variaveis(monkeypatch):
    monkeypatch.setattr(notifications, "SMTP_HOST", None)
    monkeypatch.setattr(notifications, "SMTP_USERNAME", None)
    monkeypatch.setattr(notifications, "SMTP_PASSWORD", None)
    assert notifications.smtp_configurado() is False


def test_nao_tenta_conectar_quando_smtp_nao_configurado(monkeypatch):
    monkeypatch.setattr(notifications, "SMTP_HOST", None)
    with patch("notifications.smtplib.SMTP") as smtp_mock:
        notifications.enviar_confirmacao_agendamento(
            "cliente@teste.com", "Cliente", "Corte", datetime.datetime(2026, 9, 1, 10, 0)
        )
        smtp_mock.assert_not_called()


def test_envia_email_quando_smtp_configurado(monkeypatch):
    monkeypatch.setattr(notifications, "SMTP_HOST", "smtp.teste.com")
    monkeypatch.setattr(notifications, "SMTP_USERNAME", "user@teste.com")
    monkeypatch.setattr(notifications, "SMTP_PASSWORD", "senha")
    monkeypatch.setattr(notifications, "SMTP_FROM_EMAIL", "user@teste.com")

    servidor_mock = MagicMock()
    with patch("notifications.smtplib.SMTP") as smtp_mock:
        smtp_mock.return_value.__enter__.return_value = servidor_mock
        notifications.enviar_confirmacao_agendamento(
            "cliente@teste.com", "Cliente", "Corte", datetime.datetime(2026, 9, 1, 10, 0)
        )

    servidor_mock.starttls.assert_called_once()
    servidor_mock.login.assert_called_once_with("user@teste.com", "senha")
    servidor_mock.send_message.assert_called_once()


def test_erro_no_envio_nao_propaga(monkeypatch):
    """Um SMTP fora do ar não pode derrubar a criação do agendamento."""
    monkeypatch.setattr(notifications, "SMTP_HOST", "smtp.teste.com")
    monkeypatch.setattr(notifications, "SMTP_USERNAME", "user@teste.com")
    monkeypatch.setattr(notifications, "SMTP_PASSWORD", "senha")

    with patch("notifications.smtplib.SMTP", side_effect=Exception("falha de rede")):
        notifications.enviar_confirmacao_agendamento(
            "cliente@teste.com", "Cliente", "Corte", datetime.datetime(2026, 9, 1, 10, 0)
        )  # não deve levantar exceção


def test_telegram_configurado_false_sem_token(monkeypatch):
    monkeypatch.setattr(notifications, "TELEGRAM_BOT_TOKEN", None)
    assert notifications.telegram_configurado() is False


def test_nao_tenta_enviar_lembrete_quando_telegram_nao_configurado(monkeypatch):
    monkeypatch.setattr(notifications, "TELEGRAM_BOT_TOKEN", None)
    with patch("notifications.httpx.post") as post_mock:
        notifications.enviar_lembrete_telegram("123456", "Cliente", "Corte", datetime.datetime(2026, 9, 1, 10, 0))
        post_mock.assert_not_called()


def test_envia_lembrete_quando_telegram_configurado(monkeypatch):
    monkeypatch.setattr(notifications, "TELEGRAM_BOT_TOKEN", "token-fake")
    with patch("notifications.httpx.post") as post_mock:
        notifications.enviar_lembrete_telegram("123456", "Cliente", "Corte", datetime.datetime(2026, 9, 1, 10, 0))
        post_mock.assert_called_once()
        url, kwargs = post_mock.call_args[0][0], post_mock.call_args[1]
        assert "token-fake" in url
        assert kwargs["json"]["chat_id"] == "123456"


def test_erro_no_envio_do_lembrete_nao_propaga(monkeypatch):
    monkeypatch.setattr(notifications, "TELEGRAM_BOT_TOKEN", "token-fake")
    with patch("notifications.httpx.post", side_effect=Exception("falha de rede")):
        notifications.enviar_lembrete_telegram(
            "123456", "Cliente", "Corte", datetime.datetime(2026, 9, 1, 10, 0)
        )  # não deve levantar exceção


def test_buscar_ativacoes_vazio_sem_telegram_configurado(monkeypatch):
    monkeypatch.setattr(notifications, "TELEGRAM_BOT_TOKEN", None)
    with patch("notifications.httpx.get") as get_mock:
        assert notifications.buscar_novas_ativacoes_telegram() == []
        get_mock.assert_not_called()


def test_buscar_ativacoes_reconhece_comando_start(monkeypatch):
    """Uma mensagem "/start <token>" recebida do Telegram deve virar uma
    ativação (token + chat_id); outras mensagens são ignoradas."""
    monkeypatch.setattr(notifications, "TELEGRAM_BOT_TOKEN", "token-fake")
    monkeypatch.setattr(notifications, "_telegram_update_offset", None)

    resposta_mock = MagicMock()
    resposta_mock.json.return_value = {
        "result": [
            {"update_id": 10, "message": {"chat": {"id": 555}, "text": "/start abc123"}},
            {"update_id": 11, "message": {"chat": {"id": 777}, "text": "oi"}},
        ]
    }
    with patch("notifications.httpx.get", return_value=resposta_mock):
        ativacoes = notifications.buscar_novas_ativacoes_telegram()

    assert ativacoes == [{"token": "abc123", "chat_id": "555"}]
    # O offset avança para não reprocessar essas mesmas atualizações
    assert notifications._telegram_update_offset == 12


def test_erro_ao_consultar_updates_nao_propaga(monkeypatch):
    monkeypatch.setattr(notifications, "TELEGRAM_BOT_TOKEN", "token-fake")
    with patch("notifications.httpx.get", side_effect=Exception("falha de rede")):
        assert notifications.buscar_novas_ativacoes_telegram() == []
