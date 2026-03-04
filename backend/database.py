from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Configuração do SQLite
SQLALCHEMY_DATABASE_URL = "sqlite:///./agendamento.db"

# check_same_thread=False é necessário apenas para SQLite no FastAPI
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()