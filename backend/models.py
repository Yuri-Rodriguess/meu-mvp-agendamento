from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
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

class UserDB(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    # "user" (padrão) ou "admin". Antes disso, o "super admin" era um
    # username fixo ("yuri") comparado direto no código — não escalava
    # para mais de uma pessoa administrar o sistema.
    role = Column(String, nullable=False, server_default="user")