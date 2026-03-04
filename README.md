# 📅 MVP - Sistema de Agendamento Online

Este projeto é um Produto Mínimo Viável (MVP) desenvolvido como trabalho prático para a disciplina de Fábrica de Software com Gestão Ágil. O objetivo é simular um ambiente real de desenvolvimento ágil, entregando valor rapidamente através de um ciclo curto (Sprint de 4 dias).

## 🚀 Proposta de Valor
Plataforma web responsiva para clínicas, salões e consultorias gerenciarem suas marcações de forma digital, eliminando atritos no agendamento e organizando a rotina através de um calendário interativo.

## 🛠️ Stack Tecnológica
O projeto foi construído utilizando uma arquitetura moderna cliente-servidor:
* **Frontend:** React, Vite, Axios, React Big Calendar (SPA com interface responsiva).
* **Backend:** Python, FastAPI, SQLAlchemy, Pydantic (API RESTful de alta performance).
* **Banco de Dados:** SQLite (Persistência leve e rápida para o MVP).
* **Qualidade e Automação:** Pytest (Testes de integração) e APScheduler (Cron Jobs).

## ✨ Funcionalidades Entregues
- [x] **Gestão de Agendamentos (CRUD):** Criação, listagem e cancelamento de horários.
- [x] **Visualização Avançada:** Calendário interativo mensal/semanal (estilo Google Calendar) com filtros dinâmicos.
- [x] **Dashboard de CI/CD:** Tela dedicada no frontend que aciona e exibe logs do Pytest rodando no servidor em tempo real.
- [x] **Rotina Autônoma (Background Task):** Agendador interno (APScheduler) configurado para executar testes automáticos de integridade todos os dias às 22h.

---

## ⚙️ Como executar o projeto localmente

Para rodar o sistema, você precisará ter o **Node.js** e o **Python 3+** instalados na sua máquina.

### 1. Clonar o repositório
```bash
git clone [https://github.com/SEU_USUARIO/meu-mvp-agendamento.git](https://github.com/SEU_USUARIO/meu-mvp-agendamento.git)
cd meu-mvp-agendamento
