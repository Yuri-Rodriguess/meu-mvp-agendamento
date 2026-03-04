import React from 'react';
import api from '../services/api';

export default function AppointmentList({ appointments, onAppointmentDeleted }) {
    const handleDelete = async (id) => {
        try {
            await api.delete(`/appointments/${id}`);
            onAppointmentDeleted(); // Atualiza a lista após deletar
        } catch (error) {
            console.error("Erro ao deletar agendamento", error);
        }
    };

    return (
        <div>
            <h2>Agenda do Dia</h2>
            {appointments.length === 0 ? (
                <p>Nenhum agendamento para hoje.</p>
            ) : (
                <ul style={{ listStyleType: 'none', padding: 0 }}>
                    {appointments.map((appt) => (
                        <li key={appt.id} style={{ padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <strong>{appt.client_name}</strong> - {appt.service} <br/>
                                <span style={{ color: '#666' }}>{new Date(appt.date_time).toLocaleString()}</span>
                            </div>
                            <button onClick={() => handleDelete(appt.id)} style={{ backgroundColor: '#DC3545', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '5px', cursor: 'pointer' }}>
                                Cancelar
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}