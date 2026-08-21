import os
import smtplib
from datetime import datetime
from email.mime.text import MIMEText

import httpx

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USERNAME)

# Bot gratuito do Telegram (criado via @BotFather — ver .env.example) usado
# para o lembrete de "faltam 2h para o seu horário". Diferente de SMTP, um
# bot não pode escrever pra um número/chat que nunca falou com ele antes;
# por isso o vínculo é feito via link de ativação (ver telegram_link_token
# em models.py e processar_atualizacoes_telegram logo abaixo).
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

# Guarda em memória o id da última atualização já processada do Telegram,
# para o "long polling" (ver processar_atualizacoes_telegram) não reprocessar
# a mesma mensagem de novo. É reiniciado a cada deploy — inofensivo, na pior
# das hipóteses um /start antigo é reprocessado uma vez a mais.
_telegram_update_offset: int | None = None


def _telegram_api_url(metodo: str) -> str:
    return f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/{metodo}"


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


def telegram_configurado() -> bool:
    return bool(TELEGRAM_BOT_TOKEN)


def enviar_lembrete_telegram(chat_id: str, client_name: str, service: str, date_time: datetime) -> None:
    """Envia o lembrete de "faltam 2h" via Telegram. Chamado pelo job
    periódico em main.py (enviar_lembretes_pendentes).

    Sem bot configurado (ver TELEGRAM_BOT_TOKEN no .env.example), só
    registra no log e segue — mesmo espírito do e-mail via SMTP acima: uma
    notificação que falha nunca deve derrubar o agendamento em si."""
    if not telegram_configurado():
        print(f"[notifications] Bot do Telegram não configurado — pulando lembrete para chat {chat_id}.", flush=True)
        return

    texto = (
        f"Olá, {client_name}! ⏰\n\n"
        f'Seu agendamento de "{service}" é daqui a 2 horas, às '
        f"{date_time.strftime('%H:%M')}.\n\nAté já!"
    )
    try:
        httpx.post(_telegram_api_url("sendMessage"), json={"chat_id": chat_id, "text": texto}, timeout=10)
    except Exception as e:
        print(f"[notifications] Erro ao enviar lembrete via Telegram para chat {chat_id}: {e}", flush=True)


def buscar_novas_ativacoes_telegram() -> list[dict]:
    """Consulta o Telegram (long polling via getUpdates) por mensagens
    "/start <token>" novas e devolve [{"token": ..., "chat_id": ...}] para
    quem chamou (main.py) vincular ao agendamento certo.

    Este módulo é só a fronteira de integração externa — não toca no banco,
    igual ao SMTP acima; quem decide o que fazer com cada ativação é o
    chamador."""
    global _telegram_update_offset
    if not telegram_configurado():
        return []

    params = {"timeout": 0}
    if _telegram_update_offset is not None:
        params["offset"] = _telegram_update_offset

    try:
        resposta = httpx.get(_telegram_api_url("getUpdates"), params=params, timeout=10)
        resposta.raise_for_status()
        atualizacoes = resposta.json().get("result", [])
    except Exception as e:
        print(f"[notifications] Erro ao consultar atualizações do Telegram: {e}", flush=True)
        return []

    ativacoes = []
    for atualizacao in atualizacoes:
        _telegram_update_offset = atualizacao["update_id"] + 1
        mensagem = atualizacao.get("message", {})
        texto = mensagem.get("text", "")
        chat_id = mensagem.get("chat", {}).get("id")
        if chat_id is None or not texto.startswith("/start "):
            continue
        token = texto.removeprefix("/start ").strip()
        if token:
            ativacoes.append({"token": token, "chat_id": str(chat_id)})

    return ativacoes


def confirmar_ativacao_telegram(chat_id: str) -> None:
    """Confirma pro cliente, assim que o vínculo é feito, que o lembrete
    ficou ativado (ver processar_ativacoes_telegram em main.py)."""
    if not telegram_configurado():
        return
    try:
        httpx.post(
            _telegram_api_url("sendMessage"),
            json={"chat_id": chat_id, "text": "✅ Lembrete ativado! Vamos te avisar por aqui 2h antes do seu horário."},
            timeout=10,
        )
    except Exception as e:
        print(f"[notifications] Erro ao confirmar ativação do Telegram para chat {chat_id}: {e}", flush=True)
