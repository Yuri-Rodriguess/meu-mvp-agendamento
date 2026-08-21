import React, { useState } from 'react';
import api from '../services/api';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify'; // Importando o Toast
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { 'pt-BR': ptBR };

// @username do bot do Telegram usado no lembrete de "faltam 2h" (ver
// backend/notifications.py e TELEGRAM_BOT_USERNAME no .env.example). Sem
// essa variável, o botão de ativação simplesmente não aparece.
const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;

const FILTROS_PERIODO = [
    { key: 'todos', label: 'Todos' },
    { key: 'proximos', label: 'Próximos' },
    { key: 'passados', label: 'Já ocorreram' },
];

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

const CustomToolbar = (toolbar) => {
    const goToBack = () => { toolbar.onNavigate('PREV'); };
    const goToNext = () => { toolbar.onNavigate('NEXT'); };
    const goToCurrent = () => { toolbar.onNavigate('TODAY'); };

    const meses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const anos = [2024, 2025, 2026, 2027, 2028, 2029];

    const handleMesChange = (event) => {
        const novoMes = parseInt(event.target.value, 10);
        const novaData = new Date(toolbar.date.getFullYear(), novoMes, 1);
        toolbar.onNavigate('DATE', novaData);
    };

    const handleAnoChange = (event) => {
        const novoAno = parseInt(event.target.value, 10);
        const novaData = new Date(novoAno, toolbar.date.getMonth(), 1);
        toolbar.onNavigate('DATE', novaData);
    };

    return (
        <div className="rbc-toolbar">
            <span className="rbc-btn-group">
                <button type="button" onClick={goToCurrent}>Hoje</button>
                <button type="button" onClick={goToBack}>Anterior</button>
                <button type="button" onClick={goToNext}>Próximo</button>
            </span>
            <span className="rbc-toolbar-label" style={{ display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center' }}>
                <select value={toolbar.date.getMonth()} onChange={handleMesChange} className="calendar-select">
                    {meses.map((mes, index) => <option key={index} value={index}>{mes}</option>)}
                </select>
                <select value={toolbar.date.getFullYear()} onChange={handleAnoChange} className="calendar-select">
                    {anos.map((ano) => <option key={ano} value={ano}>{ano}</option>)}
                </select>
            </span>
            <span className="rbc-btn-group">
                <button type="button" className={toolbar.view === 'month' ? 'rbc-active' : ''} onClick={() => toolbar.onView('month')}>Mês</button>
                <button type="button" className={toolbar.view === 'week' ? 'rbc-active' : ''} onClick={() => toolbar.onView('week')}>Semana</button>
                <button type="button" className={toolbar.view === 'day' ? 'rbc-active' : ''} onClick={() => toolbar.onView('day')}>Dia</button>
                <button type="button" className={toolbar.view === 'agenda' ? 'rbc-active' : ''} onClick={() => toolbar.onView('agenda')}>Agenda</button>
            </span>
        </div>
    );
};

export default function AppointmentList({ appointments, onAppointmentDeleted, onEdit, isFiltered }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [currentView, setCurrentView] = useState('month');
    const [timeFilter, setTimeFilter] = useState('todos');

    // --- ESTADOS DO MODAL DE EXCLUSÃO ---
    const [showModal, setShowModal] = useState(false);
    const [eventToDelete, setEventToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const agora = new Date();
    const appointmentsFiltrados = appointments.filter((appt) => {
        if (timeFilter === 'todos') return true;
        const eFuturo = new Date(appt.date_time) >= agora;
        return timeFilter === 'proximos' ? eFuturo : !eFuturo;
    });

    let mensagemVazia = 'Nenhum agendamento encontrado.';
    let iconeVazio = '🗓️';
    if (isFiltered) {
        mensagemVazia = 'Nenhum resultado para essa busca.';
        iconeVazio = '🔍';
    } else if (timeFilter !== 'todos' && appointments.length > 0) {
        mensagemVazia = timeFilter === 'proximos' ? 'Nenhum agendamento futuro.' : 'Nenhum agendamento passado.';
    }

    const calendarEvents = appointmentsFiltrados.map((appt) => {
        const dataAgendamento = new Date(appt.date_time);
        return {
            id: appt.id,
            title: `${appt.client_name} - ${appt.service}`,
            start: dataAgendamento,
            end: new Date(dataAgendamento.getTime() + 60 * 60 * 1000),
            resource: appt
        };
    });

    // Ao invés de deletar na hora, apenas abre o modal e guarda o evento
    const handleSelectEvent = (event) => {
        setEventToDelete(event);
        setShowModal(true);
    };

    // Função que realmente vai no banco e deleta
    const confirmDelete = async () => {
        if (!eventToDelete) return;

        setDeleting(true);
        try {
            await api.delete(`/appointments/${eventToDelete.id}`);
            onAppointmentDeleted();
            toast.success("Agendamento cancelado com sucesso!"); // Toast animado!
            setShowModal(false);
            setEventToDelete(null);
        } catch (error) {
            console.error("Erro ao deletar agendamento", error);
            toast.error("Erro ao cancelar o agendamento.");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div style={{ position: 'relative' }}>
            {/* --- O MODAL CUSTOMIZADO --- */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>⚠️ Cancelar Agendamento?</h3>
                        <p>Você tem certeza que deseja cancelar o agendamento de:<br/> <strong>{eventToDelete?.title}</strong>?</p>
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setShowModal(false)} disabled={deleting}>Voltar</button>
                            <button className="btn-confirm" onClick={confirmDelete} disabled={deleting}>
                                {deleting && <span className="spinner" aria-hidden="true" />}
                                {deleting ? 'Cancelando...' : 'Sim, Cancelar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="segmented-control" role="group" aria-label="Filtrar agendamentos por período">
                {FILTROS_PERIODO.map((filtro) => (
                    <button
                        key={filtro.key}
                        type="button"
                        className={timeFilter === filtro.key ? 'active' : ''}
                        onClick={() => setTimeFilter(filtro.key)}
                    >
                        {filtro.label}
                    </button>
                ))}
            </div>

            <div className="calendar-card">
                <Calendar
                    localizer={localizer}
                    events={calendarEvents}
                    startAccessor="start"
                    endAccessor="end"
                    culture="pt-BR"
                    components={{ toolbar: CustomToolbar }}
                    date={currentDate}
                    onNavigate={(newDate) => setCurrentDate(newDate)}
                    view={currentView}
                    onView={(newView) => setCurrentView(newView)}
                    onSelectEvent={handleSelectEvent}
                    style={{ height: '100%' }}
                />
            </div>

            <h3 className="section-title">Lista Detalhada</h3>
            {appointmentsFiltrados.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-state-icon" aria-hidden="true">{iconeVazio}</span>
                    <p>{mensagemVazia}</p>
                </div>
            ) : (
                <ul className="list-panel" style={{ listStyleType: 'none' }}>
                    {appointmentsFiltrados.map((appt) => (
                        <li key={appt.id} className="list-item">
                            <div className="list-item-info">
                                <div className="avatar-circle" aria-hidden="true">
                                    {appt.client_name.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <div className="list-item-title">
                                        {appt.client_name} <span style={{ fontWeight: 400, color: 'var(--color-text-soft)' }}>· {appt.service}</span>
                                        {appt.client_email && (
                                            <span title={`Confirmação enviada para ${appt.client_email}`} aria-label={`E-mail cadastrado: ${appt.client_email}`}> 📧</span>
                                        )}
                                    </div>
                                    <div className="list-item-subtitle">
                                        {new Date(appt.date_time).toLocaleString('pt-BR')}
                                        {appt.professional_name && ` · com ${appt.professional_name}`}
                                    </div>
                                </div>
                            </div>
                            <div className="list-item-actions">
                                {appt.client_phone && TELEGRAM_BOT_USERNAME && (
                                    appt.telegram_linked ? (
                                        <span className="pill pill-active" title="O cliente já ativou o lembrete no Telegram">
                                            🔔 Lembrete ativo
                                        </span>
                                    ) : (
                                        <a
                                            href={`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${appt.telegram_link_token}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-secondary btn-sm"
                                            title="Envie este link para o cliente ativar o lembrete no Telegram"
                                        >
                                            🔔 Ativar lembrete
                                        </a>
                                    )
                                )}
                                <button onClick={() => onEdit && onEdit(appt)} className="btn btn-primary btn-sm">
                                    Editar
                                </button>
                                <button
                                    onClick={() => handleSelectEvent({ id: appt.id, title: appt.client_name })}
                                    className="btn btn-danger btn-sm"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}