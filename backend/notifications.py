import os
import smtplib
from datetime import datetime
from email.mime.text import MIMEText

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USERNAME)


def smtp_configurado() -> bool:
    return bool(SMTP_HOST and SMTP_USERNAME and SMTP_PASSWORD)


def enviar_confirmacao_agendamento(destinatario: str, client_name: str, service: str, date_time: datetime) -> None:
    """Envia um e-mail de confirmação para o cliente. Roda em background
    (ver BackgroundTasks em main.py) para não atrasar a resposta da API.

    Se o SMTP não estiver configurado (não há credenciais de terceiros
    fornecidas por padrão neste projeto — ver .env.example), só registra
    no log e segue: um e-mail que não sai nunca deveria derrubar a
    criação do agendamento em si."""
    if not smtp_configurado():
        print(f"[notifications] SMTP não configurado — pulando e-mail de confirmação para {destinatario}.", flush=True)
        return

    corpo = (
        f"Olá, {client_name}!\n\n"
        f'Seu agendamento de "{service}" foi confirmado para '
        f"{date_time.strftime('%d/%m/%Y às %H:%M')}.\n\n"
        f"Até lá!"
    )
    mensagem = MIMEText(corpo, "plain", "utf-8")
    mensagem["Subject"] = "Confirmação de agendamento"
    mensagem["From"] = SMTP_FROM_EMAIL
    mensagem["To"] = destinatario

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as servidor:
            servidor.starttls()
            servidor.login(SMTP_USERNAME, SMTP_PASSWORD)
            servidor.send_message(mensagem)
    except Exception as e:
        # Idem: um erro de envio não deve propagar e derrubar nada além
        # do próprio e-mail (a rota que chamou isso já respondeu 200).
        print(f"[notifications] Erro ao enviar e-mail de confirmação para {destinatario}: {e}", flush=True)
