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
