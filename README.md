# 📅 MVP - Sistema de Agendamento Online

Este projeto é um Produto Mínimo Viável (MVP) desenvolvido como trabalho prático para a disciplina de Fábrica de Software com Gestão Ágil. O objetivo é simular um ambiente real de desenvolvimento ágil, entregando valor rapidamente através de um ciclo curto (Sprint de 4 dias).

## 🚀 Proposta de Valor
Plataforma web responsiva para clínicas, salões e consultorias gerenciarem suas marcações de forma digital, eliminando atritos no agendamento e organizando a rotina através de um calendário interativo.

## 🛠️ Stack Tecnológica
O projeto foi construído utilizando uma arquitetura moderna cliente-servidor:
* **Frontend:** React, Vite, Axios, React Big Calendar (SPA com interface responsiva).
* **Backend:** Python, FastAPI, SQLAlchemy, Pydantic (API RESTful de alta performance).
* **Banco de Dados:** SQLite (Persistência leve e rápida para o MVP), com versionamento de schema via Alembic.
* **Qualidade e Automação:** Pytest (Testes de integração) e APScheduler (Cron Jobs).

## ✨ Funcionalidades Entregues
- [x] **Gestão de Agendamentos (CRUD):** Criação, listagem e cancelamento de horários.
- [x] **Visualização Avançada:** Calendário interativo mensal/semanal (estilo Google Calendar) com filtros dinâmicos.
- [x] **Dashboard de CI/CD:** Tela dedicada no frontend que aciona e exibe logs do Pytest rodando no servidor em tempo real.
- [x] **Rotina Autônoma (Background Task):** Agendador interno (APScheduler) configurado para executar testes automáticos de integridade todos os dias às 22h.

---

## ⚙️ Como executar o projeto localmente

Para rodar o sistema, você precisará ter o **Node.js** e o **Python 3+** instalados na sua máquina.

O sistema é dividido em duas partes que devem rodar simultaneamente.

# 1. Clonar o repositório
git clone https://github.com/SEU_USUARIO/meu-mvp-agendamento.git
cd meu-mvp-agendamento

# 2. Rodar o Backend (FastAPI)
Abra um terminal e acesse a pasta do backend:

cd backend

Para instalar as dependências necessárias: 
pip install -r requirements.txt

Copie o arquivo de variáveis de ambiente de exemplo e gere suas próprias chaves:
cp .env.example .env
python -c "import secrets; print(secrets.token_hex(32))"
Cole o valor gerado em `SECRET_KEY` (usada para assinar os tokens de login) dentro de `backend/.env`. Faça o mesmo (com `token_hex(16)`) para `TEST_RUNNER_API_KEY`.

Crie/atualize o banco de dados rodando as migrations (Alembic):
alembic upgrade head
> Se você já tinha um `agendamento.db` de antes desta mudança (schema já compatível com os models atuais), rode `alembic stamp head` uma única vez em vez de `upgrade head` — isso só marca o banco como atualizado, sem tentar recriar tabelas que já existem.

Para iniciar o servidor de desenvolvimento: 
python -m uvicorn main:app --reload 


# 💡 Importante: A documentação automática da API (Swagger UI) ficará disponível em: http://127.0.0.1:8000/docs

# 3. Rodar o Frontend (React)
Abra um segundo terminal e acesse a pasta do frontend:

cd frontend

Para instalar as dependências do Node.js: 
npm install  

Copie o arquivo de variáveis de ambiente de exemplo:
cp .env.example .env
Em `frontend/.env`, defina `VITE_TEST_RUNNER_API_KEY` com o **mesmo valor** usado em `backend/.env` (é a chave que autoriza o botão "Atualizar Log de Testes" a acionar o Pytest no servidor).

Para iniciar a interface de usuário: 
npm run dev  

---

## 🗄️ Alterando o schema do banco

Sempre que mudar um model em `backend/models.py`, gere uma nova migration em vez de editar o banco na mão:
alembic revision --autogenerate -m "descreva a mudança aqui"
alembic upgrade head
Revise o arquivo gerado em `backend/alembic/versions/` antes de commitar — o autogenerate nem sempre acerta 100% (ex.: renomear uma coluna vira "remover + adicionar" por padrão).

## 🔒 Notas de segurança

- Cadastre-se pela própria tela de login (rota `/register`) para criar sua conta. O painel "Administradores" e a permissão de excluir contas ficam restritos a quem se cadastrar com o usuário `yuri`.
- A rota `/api/run-tests` exige o header `X-API-Key`, validado contra `TEST_RUNNER_API_KEY`. Isso evita que qualquer visitante dispare execuções de processo no servidor repetidamente. **Atenção:** como é uma SPA sem backend próprio, essa chave fica embutida no bundle do frontend — ela barra abuso casual/automatizado, mas não substitui um sistema de login real caso o projeto vá para produção com múltiplos usuários.
- O CORS agora é restrito às origens listadas em `ALLOWED_ORIGINS` (por padrão, apenas `http://localhost:5173`). Ajuste essa variável ao publicar o frontend em outro domínio.
- Cada agendamento pertence ao usuário que o criou (`owner_id`); a listagem e o cancelamento só enxergam agendamentos da própria conta.
- Os testes automatizados (`pytest`) rodam contra um banco SQLite isolado (`test_agendamento.db`), não contra `agendamento.db` — assim o pipeline de CI não insere dados fictícios no banco real.
