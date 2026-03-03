import React, { useState, useEffect } from 'react';
import axios from 'axios'; // Lembre-se de rodar: npm install axios

function App() {
  const [appointments, setAppointments] = useState([]);
  const [formData, setFormData] = useState({ client_name: '', service: '', date_time: '' });

  // Busca os agendamentos no backend FastAPI
  const fetchAppointments = async () => {
    try {
      const response = await axios.get('http://localhost:8000/appointments/');
      setAppointments(response.data);
    } catch (error) {
      console.error("Erro ao buscar agendamentos", error);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Converte a data do HTML para o formato ISO que o FastAPI espera
      const formattedDate = new Date(formData.date_time).toISOString();
      await axios.post('http://localhost:8000/appointments/', {
        ...formData,
        date_time: formattedDate
      });
      fetchAppointments(); // Atualiza a lista
      setFormData({ client_name: '', service: '', date_time: '' }); // Limpa o formulário
    } catch (error) {
      console.error("Erro ao criar agendamento", error);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Sistema de Agendamento Online</h1>
      
      <div style={{ marginBottom: '40px', padding: '20px', border: '1px solid #ccc' }}>
        <h2>Novo Agendamento</h2>
        <form onSubmit={handleSubmit}>
          <input type="text" name="client_name" placeholder="Nome do Cliente" value={formData.client_name} onChange={handleChange} required style={{ display: 'block', margin: '10px 0' }}/>
          <input type="text" name="service" placeholder="Serviço (ex: Corte de Cabelo)" value={formData.service} onChange={handleChange} required style={{ display: 'block', margin: '10px 0' }}/>
          <input type="datetime-local" name="date_time" value={formData.date_time} onChange={handleChange} required style={{ display: 'block', margin: '10px 0' }}/>
          <button type="submit">Agendar Horário</button>
        </form>
      </div>

      <h2>Agenda do Dia</h2>
      <ul>
        {appointments.map((appt) => (
          <li key={appt.id} style={{ marginBottom: '10px' }}>
            <strong>{appt.client_name}</strong> - {appt.service} <br/>
            {new Date(appt.date_time).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;