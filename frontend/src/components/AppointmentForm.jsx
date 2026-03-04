import React, { useState } from 'react';
import api from '../services/api';

export default function AppointmentForm({ onAppointmentAdded }) {
    const [formData, setFormData] = useState({ client_name: '', service: '', date_time: '' });

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const formattedDate = new Date(formData.date_time).toISOString();
            await api.post('/appointments/', { ...formData, date_time: formattedDate });
            onAppointmentAdded(); // Atualiza a lista na tela principal
            setFormData({ client_name: '', service: '', date_time: '' }); // Limpa os campos
        } catch (error) {
            console.error("Erro ao criar agendamento", error);
        }
    };

    return (
        <div style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
            <h2>Novo Agendamento</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input type="text" name="client_name" placeholder="Nome do Cliente" value={formData.client_name} onChange={handleChange} required style={{ padding: '8px' }}/>
                <input type="text" name="service" placeholder="Serviço (ex: Corte de Cabelo)" value={formData.service} onChange={handleChange} required style={{ padding: '8px' }}/>
                <input type="datetime-local" name="date_time" value={formData.date_time} onChange={handleChange} required style={{ padding: '8px' }}/>
                <button type="submit" style={{ padding: '10px', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Agendar Horário</button>
            </form>
        </div>
    );
}