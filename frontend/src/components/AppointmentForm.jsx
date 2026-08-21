import React, { useState } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify'; // Importando a função de popup

// O componente pai passa uma "key" diferente para cada agendamento em edição
// (e outra para "novo agendamento"), então o formulário já nasce com os
// valores certos sem precisar de um useEffect para sincronizar o estado.
export default function AppointmentForm({ onAppointmentAdded, editingAppointment, onCancelEdit }) {
    const [clientName, setClientName] = useState(editingAppointment?.client_name ?? '');
    const [service, setService] = useState(editingAppointment?.service ?? '');
    const [dateTime, setDateTime] = useState(editingAppointment?.date_time.slice(0, 16) ?? ''); // "AAAA-MM-DDTHH:mm"

    const isEditing = Boolean(editingAppointment);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = { client_name: clientName, service: service, date_time: dateTime };
        try {
            if (isEditing) {
                await api.put(`/appointments/${editingAppointment.id}`, payload);
                toast.success('Agendamento atualizado com sucesso!');
            } else {
                await api.post('/appointments/', payload);
                toast.success('Horário agendado com sucesso!');
            }

            // Limpa os campos após salvar
            setClientName('');
            setService('');
            setDateTime('');

            if (onAppointmentAdded) {
                onAppointmentAdded();
            }
        } catch (error) {
            console.error("Erro ao salvar agendamento", error);
            if (error.response?.status === 409) {
                toast.error(error.response.data?.detail || 'Já existe um agendamento seu nesse horário.');
            } else {
                toast.error('Erro ao salvar o agendamento.');
            }
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '400px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
            <input type="text" placeholder="Nome do Cliente" value={clientName} onChange={e => setClientName(e.target.value)} required style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
            <input type="text" placeholder="Serviço (ex: Corte de Cabelo)" value={service} onChange={e => setService(e.target.value)} required style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
            <input type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)} required style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" style={{ flex: 1, padding: '10px', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {isEditing ? 'Salvar Alterações' : 'Agendar Horário'}
                </button>
                {isEditing && (
                    <button type="button" onClick={onCancelEdit} style={{ padding: '10px 15px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        Cancelar Edição
                    </button>
                )}
            </div>
        </form>
    );
}