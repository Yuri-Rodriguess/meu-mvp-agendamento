# 📅 MVP - Sistema de Agendamento Online

[![CI](https://github.com/Yuri-Rodriguess/meu-mvp-agendamento/actions/workflows/ci.yml/badge.svg)](https://github.com/Yuri-Rodriguess/meu-mvp-agendamento/actions/workflows/ci.yml)

Este projeto é um Produto Mínimo Viável (MVP) desenvolvido como trabalho prático para a disciplina de Fábrica de Software com Gestão Ágil. O objetivo é simular um ambiente real de desenvolvimento ágil, entregando valor rapidamente através de um ciclo curto (Sprint de 4 dias).

## 🚀 Proposta de Valor
Plataforma web responsiva para clínicas, salões e consultorias gerenciarem suas marcações de forma digital, eliminando atritos no agendamento e organizando a rotina através de um calendário interativo.

## 🛠️ Stack Tecnológica
O projeto foi construído utilizando uma arquitetura moderna cliente-servidor:
* **Frontend:** React, Vite, Axios, React Big Calendar (SPA com interface responsiva).
* **Backend:** Python, FastAPI, SQLAlchemy, Pydantic (API RESTful de alta performance).
* **Banco de Dados:** SQLite (Persistência leve e rápida para o MVP), com versionamento de schema via Alembic.
* **Qualidade e Automação:** Pytest (testes de integração do backend), Vitest + React Testing Library (testes do frontend) e APScheduler (Cron Jobs).

## ✨ Funcionalidades Entregues
- [x] **Gestão de Agendamentos (CRUD):** Criação, listagem, edição e cancelamento de horários, com busca por cliente/serviço.
- [x] **Visualização Avançada:** Calendário interativo mensal/semanal (estilo Google Calendar) com filtros dinâmicos.
- [x] **Dashboard de CI/CD:** Tela dedicada no frontend que aciona e exibe logs do Pytest rodando no servidor em tempo real.
- [x] **Rotina Autônoma (Background Task):** Agendador interno (APScheduler) configurado para executar testes automáticos de integridade todos os dias às 22h.
- [x] **CI real (GitHub Actions):** todo push/PR roda o Pytest do backend e o lint + testes + build do frontend automaticamente — o dashboard e o agendador continuam existindo, mas quem garante que a branch está saudável agora é o CI, não um clique manual.
- [x] **E-mail de confirmação (opcional):** se o cliente tiver e-mail cadastrado no agendamento, recebe uma confirmação automática assim que ele é criado (requer configurar um SMTP — ver `.env.example`; sem isso, o app funciona normal e só não manda o e-mail).

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

Para rodar os testes do frontend (Vitest + React Testing Library):
npm run test

---

## 🐛 Troubleshooting

**Erro `sqlite3.OperationalError: no such table: users` (ou `appointments`) ao usar a API:**
O SQLAlchemy cria o arquivo `agendamento.db` assim que conecta, mesmo vazio — mas as tabelas só existem depois que as migrations do Alembic rodam. Se você iniciou o backend sem antes rodar as migrations (ou apagou/recriou o `.db`), rode dentro de `backend/`:
```
alembic upgrade head
```
Não é preciso reiniciar o `uvicorn --reload` depois disso; ele já enxerga as tabelas novas na próxima requisição.

## 🗄️ Alterando o schema do banco

Sempre que mudar um model em `backend/models.py`, gere uma nova migration em vez de editar o banco na mão:
alembic revision --autogenerate -m "descreva a mudança aqui"
alembic upgrade head
Revise o arquivo gerado em `backend/alembic/versions/` antes de commitar — o autogenerate nem sempre acerta 100% (ex.: renomear uma coluna vira "remover + adicionar" por padrão).

## ☁️ Publicando em produção (deploy)

O projeto ainda não está publicado — isso exige criar contas em serviços de hospedagem, o que só você pode fazer. Um caminho simples e gratuito para começar:

**Backend (FastAPI) — Render ou Railway:**
1. Crie um "Web Service" apontando para a pasta `backend/` deste repositório.
2. Build command: `pip install -r requirements.txt`
3. Start command: `alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Configure as variáveis de ambiente do `backend/.env.example` (gere valores novos de `SECRET_KEY`/`TEST_RUNNER_API_KEY` — nunca reaproveite os de desenvolvimento) e ajuste `ALLOWED_ORIGINS` para a URL do frontend publicado.
5. **Atenção:** SQLite grava num arquivo local no disco do servidor. Na maioria dessas plataformas o disco não é persistente entre deploys (o banco "reseta"), a menos que você contrate um disco persistente/volume — pesquise a opção específica da plataforma escolhida, ou migre para Postgres (a própria Render/Railway oferecem um banco gerenciado) se quiser persistência de verdade sem depender de disco.

**Frontend (React/Vite) — Vercel ou Netlify:**
1. Aponte para a pasta `frontend/`, com build command `npm run build` e diretório de saída `dist`.
2. Configure `VITE_API_URL` (URL do backend publicado) e `VITE_TEST_RUNNER_API_KEY` (mesmo valor do backend) nas variáveis de ambiente da plataforma.

## 🔒 Notas de segurança

- Cadastre-se pela própria tela de login (rota `/register`) para criar sua conta. Cada conta tem um `role` (`user` por padrão); o painel "Administradores" e a permissão de excluir contas ficam restritos a quem tem `role="admin"`. Por compatibilidade com o comportamento original do projeto, cadastrar-se com o usuário `yuri` continua concedendo `role="admin"` automaticamente — para promover outra conta a admin, atualize a coluna `role` diretamente no banco (não há tela para isso ainda).
- A rota `/api/run-tests` exige o header `X-API-Key`, validado contra `TEST_RUNNER_API_KEY`. Isso evita que qualquer visitante dispare execuções de processo no servidor repetidamente. **Atenção:** como é uma SPA sem backend próprio, essa chave fica embutida no bundle do frontend — ela barra abuso casual/automatizado, mas não substitui um sistema de login real caso o projeto vá para produção com múltiplos usuários.
- O CORS agora é restrito às origens listadas em `ALLOWED_ORIGINS` (por padrão, apenas `http://localhost:5173`). Ajuste essa variável ao publicar o frontend em outro domínio.
- Cada agendamento pertence ao usuário que o criou (`owner_id`); a listagem e o cancelamento só enxergam agendamentos da própria conta.
- Os testes automatizados (`pytest`) rodam contra um banco SQLite isolado (`test_agendamento.db`), não contra `agendamento.db` — assim o pipeline de CI não insere dados fictícios no banco real.
- `/login` e `/register` têm rate limiting por IP (10 e 5 requisições por minuto, respectivamente), para dificultar ataques de força bruta contra senha. Ao estourar o limite, a API responde `429`.
- O access token dura só 30 minutos. `/login` também devolve um refresh token (7 dias); o frontend usa `/refresh` para renovar o access token silenciosamente quando ele expira, sem pedir login de novo. Se o refresh token também estiver inválido/expirado, o usuário é deslogado com aviso.

## 📧 E-mail de confirmação

Não usamos nenhum serviço de terceiros pago — o envio é feito por SMTP puro (`smtplib`, já vem no Python). Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` e `SMTP_FROM_EMAIL` em `backend/.env` (veja o `.env.example` para um exemplo usando Gmail). Sem essas variáveis, o app roda normalmente e apenas registra no log que pulou o envio — nunca falha a criação do agendamento por causa de e-mail. Só cobre e-mail por enquanto; SMS ficaria por conta de um serviço de terceiros (Twilio e similares), que exige uma conta e número próprios — não incluído aqui.
