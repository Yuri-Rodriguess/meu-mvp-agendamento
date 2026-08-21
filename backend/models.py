from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class AppointmentDB(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    client_name = Column(String, index=True)
    service = Column(String)
    date_time = Column(DateTime)
    # Cada agendamento pertence a um usuário — isola os dados de cada
    # conta. Fica anulável só para não quebrar linhas criadas antes
    # desta migração; agendamentos novos sempre têm dono.
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    # Opcional: se preenchido, dispara um e-mail de confirmação (ver
    # notifications.py). Sem e-mail, o agendamento funciona normalmente.
    client_email = Column(String, nullable=True)
    # Opcional: só um contato de referência para a equipe (não dispara nada
    # sozinho — quem envia o lembrete é o Telegram, ver campos abaixo).
    client_phone = Column(String, nullable=True)
    # Token público (gerado na criação) usado no link de ativação do bot do
    # Telegram (t.me/<bot>?start=<token>). Não é secreto sensível: só serve
    # para o bot saber a qual agendamento vincular o chat que apertar "Start".
    telegram_link_token = Column(String, nullable=True, unique=True, index=True)
    # Preenchido pelo bot (ver notifications.processar_atualizacoes_telegram)
    # quando o cliente abre o link e aperta "Start" — é o destino do lembrete.
    telegram_chat_id = Column(String, nullable=True)
    # Evita reenviar o mesmo lembrete a cada execução do job periódico
    # (ver enviar_lembretes_pendentes em main.py).
    reminder_sent = Column(Boolean, nullable=False, server_default="0")
    # Opcional: qual funcionário vai atender (ver ProfessionalDB abaixo).
    # Anulável porque nem todo negócio precisa dessa granularidade, e para
    # não quebrar agendamentos criados antes desta coluna existir.
    professional_id = Column(Integer, ForeignKey("professionals.id"), nullable=True, index=True)
    professional = relationship("ProfessionalDB")

    @property
    def telegram_linked(self) -> bool:
        return self.telegram_chat_id is not None

    @property
    def professional_name(self) -> str | None:
        return self.professional.name if self.professional else None

class UserDB(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    # "user" (padrão) ou "admin". Antes disso, o "super admin" era um
    # username fixo ("yuri") comparado direto no código — não escalava
    # para mais de uma pessoa administrar o sistema.
    role = Column(String, nullable=False, server_default="user")

class ProfessionalDB(Base):
    __tablename__ = "professionals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    # Cada profissional pertence à conta que o cadastrou — um salão não
    # enxerga (nem pode escalar) a equipe de outra conta, mesmo isolamento
    # já usado em AppointmentDB.owner_id.
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)