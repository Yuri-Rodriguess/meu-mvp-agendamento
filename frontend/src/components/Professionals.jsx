import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function Professionals({ onChange }) {
    const [professionals, setProfessionals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    const fetchProfessionals = async () => {
        try {
            const response = await api.get('/professionals/');
            setProfessionals(response.data);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Erro ao carregar a lista de profissionais.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfessionals();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('/professionals/', { name });
            toast.success('Profissional cadastrado com sucesso!');
            setName('');
            await fetchProfessionals();
            onChange && onChange();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Erro ao cadastrar profissional.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id, professionalName) => {
        const confirmar = window.confirm(`Remover "${professionalName}" da equipe? Agendamentos já criados com ele(a) continuam existindo, só perdem essa atribuição.`);
        if (!confirmar) return;

        setDeletingId(id);
        try {
            await api.delete(`/professionals/${id}`);
            toast.success('Profissional removido com sucesso!');
            setProfessionals((atual) => atual.filter((p) => p.id !== id));
            onChange && onChange();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Erro ao remover profissional.');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div>
            <form onSubmit={handleSubmit} className="appointment-form" style={{ flexDirection: 'row', alignItems: 'flex-end', maxWidth: '520px' }}>
                <div style={{ flex: 1 }}>
                    <label className="field-label" htmlFor="professional-name">Nome do profissional</label>
                    <input
                        id="professional-name"
                        type="text"
                        placeholder="Ex: Carlos (Barbeiro)"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="form-field"
                        style={{ width: '100%' }}
                    />
                </div>
                <button type="submit" disabled={saving} className="btn btn-primary">
                    {saving && <span className="spinner" aria-hidden="true" />}
                    {saving ? 'Salvando...' : 'Adicionar'}
                </button>
            </form>

            <h3 className="section-title" style={{ marginTop: '28px' }}>Equipe cadastrada</h3>

            {loading ? (
                <div className="empty-state">
                    <span className="spinner spinner-dark" aria-hidden="true" style={{ width: '24px', height: '24px', margin: '0 auto 10px' }} />
                    <p>Carregando profissionais...</p>
                </div>
            ) : professionals.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-state-icon" aria-hidden="true">🧑‍💼</span>
                    <p>Nenhum profissional cadastrado ainda.</p>
                </div>
            ) : (
                <ul className="list-panel" style={{ listStyleType: 'none' }}>
                    {professionals.map((professional) => (
                        <li key={professional.id} className="list-item">
                            <div className="list-item-info">
                                <div className="avatar-circle" aria-hidden="true">
                                    {professional.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div className="list-item-title">{professional.name}</div>
                            </div>
                            <div className="list-item-actions">
                                <button
                                    onClick={() => handleDelete(professional.id, professional.name)}
                                    disabled={deletingId === professional.id}
                                    className="btn btn-danger btn-sm"
                                >
                                    {deletingId === professional.id && <span className="spinner" aria-hidden="true" />}
                                    {deletingId === professional.id ? 'Removendo...' : 'Remover'}
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
