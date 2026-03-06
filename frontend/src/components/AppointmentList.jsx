import React, { useState } from 'react';
import api from '../services/api';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify'; // Importando o Toast
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { 'pt-BR': ptBR };

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
                <select value={toolbar.date.getMonth()} onChange={handleMesChange} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc' }}>
                    {meses.map((mes, index) => <option key={index} value={index}>{mes}</option>)}
                </select>
                <select value={toolbar.date.getFullYear()} onChange={handleAnoChange} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc' }}>
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

export default function AppointmentList({ appointments, onAppointmentDeleted }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [currentView, setCurrentView] = useState('month');
    
    // --- ESTADOS DO MODAL DE EXCLUSÃO ---
    const [showModal, setShowModal] = useState(false);
    const [eventToDelete, setEventToDelete] = useState(null);

    const calendarEvents = appointments.map((appt) => {
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
        
        try {
            await api.delete(`/appointments/${eventToDelete.id}`);
            onAppointmentDeleted(); 
            toast.success("Agendamento cancelado com sucesso!"); // Toast animado!
        } catch (error) {
            console.error("Erro ao deletar agendamento", error);
            toast.error("Erro ao cancelar o agendamento.");
        } finally {
            // Fecha o modal e limpa a seleção independentemente de dar erro ou sucesso
            setShowModal(false);
            setEventToDelete(null);
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
                            <button className="btn-cancel" onClick={() => setShowModal(false)}>Voltar</button>
                            <button className="btn-confirm" onClick={confirmDelete}>Sim, Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ height: '500px', marginBottom: '40px', backgroundColor: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
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

            <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>Lista Detalhada</h3>
            {appointments.length === 0 ? (
                <p>Nenhum agendamento encontrado.</p>
            ) : (
                <ul style={{ listStyleType: 'none', padding: 0 }}>
                    {appointments.map((appt) => (
                        <li key={appt.id} style={{ padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <strong>{appt.client_name}</strong> - {appt.service} <br/>
                                <span style={{ color: '#666' }}>{new Date(appt.date_time).toLocaleString('pt-BR')}</span>
                            </div>
                            <button 
                                onClick={() => handleSelectEvent({ id: appt.id, title: appt.client_name })} 
                                style={{ backgroundColor: '#DC3545', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '5px', cursor: 'pointer' }}
                            >
                                Cancelar
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}