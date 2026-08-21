import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify'; // Importando a função de popup

// O componente pai passa uma "key" diferente para cada agendamento em edição
// (e outra para "novo agendamento"), então o formulário já nasce com os
// valores certos sem precisar de um useEffect para sincronizar o estado.
export default function AppointmentForm({ onAppointmentAdded, editingAppointment, onCancelEdit }) {
    const [clientName, setClientName] = useState(editingAppointment?.client_name ?? '');
    const [service, setService] = useState(editingAppointment?.service ?? '');
    const [dateTime, setDateTime] = useState(editingAppointment?.date_time.slice(0, 16) ?? ''); // "AAAA-MM-DDTHH:mm"
    const [clientEmail, setClientEmail] = useState(editingAppointment?.client_email ?? '');
    const [clientPhone, setClientPhone] = useState(editingAppointment?.client_phone ?? '');
    const [professionalId, setProfessionalId] = useState(editingAppointment?.professional_id ?? '');
    const [professionals, setProfessionals] = useState([]);
    const [saving, setSaving] = useState(false);

    const isEditing = Boolean(editingAppointment);

    useEffect(() => {
        api.get('/professionals/')
            .then((response) => setProfessionals(response.data))
            .catch(() => {
                // Silencioso de propósito: sem profissionais cadastrados
                // (ou erro pontual), o formulário continua utilizável —
                // o campo só fica sem opções pra escolher.
            });
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            client_name: clientName,
            service: service,
            date_time: dateTime,
            // Vazio vira null: o backend só aceita e-mail válido ou nenhum,
            // nunca uma string vazia (violaria a validação de EmailStr)
            client_email: clientEmail.trim() || null,
            client_phone: clientPhone.trim() || null,
            professional_id: professionalId ? Number(professionalId) : null,
        };
        setSaving(true);
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
            setClientEmail('');
            setClientPhone('');
            setProfessionalId('');

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
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="appointment-form">
            <div>
                <label className="field-label" htmlFor="appt-client-name">Nome do Cliente</label>
                <input
                    id="appt-client-name"
                    type="text"
                    placeholder="Nome do Cliente"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    required
                    className="form-field"
                    style={{ width: '100%' }}
                />
            </div>
            <div>
                <label className="field-label" htmlFor="appt-service">Serviço</label>
                <input
                    id="appt-service"
                    type="text"
                    placeholder="Serviço (ex: Corte de Cabelo)"
                    value={service}
                    onChange={e => setService(e.target.value)}
                    required
                    className="form-field"
                    style={{ width: '100%' }}
                />
            </div>
            <div>
                <label className="field-label" htmlFor="appt-date-time">Data e horário</label>
                <input
                    id="appt-date-time"
                    type="datetime-local"
                    value={dateTime}
                    onChange={e => setDateTime(e.target.value)}
                    required
                    className="form-field"
                    style={{ width: '100%' }}
                />
            </div>
            <div>
                <label className="field-label" htmlFor="appt-professional">Profissional (opcional)</label>
                <select
                    id="appt-professional"
                    value={professionalId}
                    onChange={e => setProfessionalId(e.target.value)}
                    className="form-field"
                    style={{ width: '100%' }}
                >
                    <option value="">Sem preferência / não atribuído</option>
                    {professionals.map((professional) => (
                        <option key={professional.id} value={professional.id}>{professional.name}</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="field-label" htmlFor="appt-client-email">E-mail do cliente (opcional)</label>
                <input
                    id="appt-client-email"
                    type="email"
                    placeholder="E-mail do cliente (opcional, envia confirmação)"
                    value={clientEmail}
                    onChange={e => setClientEmail(e.target.value)}
                    className="form-field"
                    style={{ width: '100%' }}
                />
            </div>
            <div>
                <label className="field-label" htmlFor="appt-client-phone">Celular do cliente (opcional)</label>
                <input
                    id="appt-client-phone"
                    type="tel"
                    placeholder="Celular do cliente (opcional, ex: (11) 91234-5678)"
                    value={clientPhone}
                    onChange={e => setClientPhone(e.target.value)}
                    className="form-field"
                    style={{ width: '100%' }}
                />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
                    {saving && <span className="spinner" aria-hidden="true" />}
                    {saving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Agendar Horário'}
                </button>
                {isEditing && (
                    <button type="button" onClick={onCancelEdit} disabled={saving} className="btn btn-secondary">
                        Cancelar Edição
                    </button>
                )}
            </div>
        </form>
    );
}