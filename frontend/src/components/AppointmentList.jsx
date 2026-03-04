import React, { useState } from 'react';
import api from '../services/api';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Configurando o calendário para o idioma Português (Brasil)
const locales = {
  'pt-BR': ptBR,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

// --- NOVA BARRA DE FERRAMENTAS CUSTOMIZADA COM DROPDOWN ---
const CustomToolbar = (toolbar) => {
    const goToBack = () => { toolbar.onNavigate('PREV'); };
    const goToNext = () => { toolbar.onNavigate('NEXT'); };
    const goToCurrent = () => { toolbar.onNavigate('TODAY'); };

    const meses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    // Anos disponíveis no dropdown (você pode aumentar essa lista)
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
            
            {/* O SEGREDO ESTÁ AQUI: Dropdowns de Mês e Ano */}
            <span className="rbc-toolbar-label" style={{ display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center' }}>
                <select 
                    value={toolbar.date.getMonth()} 
                    onChange={handleMesChange}
                    style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1rem', cursor: 'pointer', backgroundColor: 'white' }}
                >
                    {meses.map((mes, index) => (
                        <option key={index} value={index}>{mes}</option>
                    ))}
                </select>

                <select 
                    value={toolbar.date.getFullYear()} 
                    onChange={handleAnoChange}
                    style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1rem', cursor: 'pointer', backgroundColor: 'white' }}
                >
                    {anos.map((ano) => (
                        <option key={ano} value={ano}>{ano}</option>
                    ))}
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

    // Converte os dados do nosso banco (FastAPI) para o formato que o Calendário entende
    const calendarEvents = appointments.map((appt) => {
        const dataAgendamento = new Date(appt.date_time);
        return {
            id: appt.id,
            title: `${appt.client_name} - ${appt.service}`,
            start: dataAgendamento,
            end: new Date(dataAgendamento.getTime() + 60 * 60 * 1000), // Duração de 1 hora
            resource: appt
        };
    });

    const handleSelectEvent = async (event) => {
        const confirmar = window.confirm(`Deseja cancelar o agendamento de:\n${event.title}?`);
        if (confirmar) {
            try {
                await api.delete(`/appointments/${event.id}`);
                onAppointmentDeleted(); // Atualiza a tela
                alert("Agendamento cancelado com sucesso!");
            } catch (error) {
                console.error("Erro ao deletar agendamento", error);
                alert("Erro ao cancelar o agendamento.");
            }
        }
    };

    return (
        <div>
            {/* --- VISUALIZAÇÃO EM CALENDÁRIO --- */}
            <div style={{ height: '500px', marginBottom: '40px', backgroundColor: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <Calendar
                    localizer={localizer}
                    events={calendarEvents}
                    startAccessor="start"
                    endAccessor="end"
                    culture="pt-BR"
                    // --- SUBSTITUINDO A BARRA PADRÃO PELA NOSSA BARRA CUSTOMIZADA ---
                    components={{
                        toolbar: CustomToolbar
                    }}
                    date={currentDate}
                    onNavigate={(newDate) => setCurrentDate(newDate)}
                    view={currentView}
                    onView={(newView) => setCurrentView(newView)}
                    onSelectEvent={handleSelectEvent}
                    style={{ height: '100%' }}
                />
            </div>

            {/* --- LISTA TRADICIONAL --- */}
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