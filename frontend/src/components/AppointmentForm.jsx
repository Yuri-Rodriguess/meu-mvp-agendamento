import React, { useState } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify'; // Importando a função de popup

export default function AppointmentForm({ onAppointmentAdded }) {
    const [clientName, setClientName] = useState('');
    const [service, setService] = useState('');
    const [dateTime, setDateTime] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/appointments/', {
                client_name: clientName,
                service: service,
                date_time: dateTime
            });
            
            // Dispara o Popup de Sucesso!
            toast.success('Horário agendado com sucesso!');
            
            // Limpa os campos após salvar
            setClientName('');
            setService('');
            setDateTime('');
            
            if (onAppointmentAdded) {
                onAppointmentAdded();
            }
        } catch (error) {
            console.error("Erro ao criar agendamento", error);
            // Dispara o Popup de Erro se algo der errado
            toast.error('Erro ao salvar o agendamento.');
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '400px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
            <input type="text" placeholder="Nome do Cliente" value={clientName} onChange={e => setClientName(e.target.value)} required style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
            <input type="text" placeholder="Serviço (ex: Corte de Cabelo)" value={service} onChange={e => setService(e.target.value)} required style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
            <input type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)} required style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
            <button type="submit" style={{ padding: '10px', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                Agendar Horário
            </button>
        </form>
    );
}