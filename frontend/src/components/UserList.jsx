import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

// Lê os dados do usuário logado a partir do payload do token JWT
const getLoggedUserInfo = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
        // O JWT é dividido em 3 partes separadas por ponto. A segunda é o payload (os dados)
        const payloadBase64 = token.split('.')[1];
        const decodedJson = atob(payloadBase64); // Decodifica a base64
        const payload = JSON.parse(decodedJson);
        return { username: payload.sub, role: payload.role };
    } catch {
        return null;
    }
};

export default function UserList() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);

    // Descobre quem é o usuário atual e se ele tem permissão de admin
    // (mesma checagem que o backend faz a partir do banco, ver main.py)
    const currentUser = getLoggedUserInfo();
    const isAdmin = currentUser?.role === 'admin';

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await api.get('/users/');
                setUsers(response.data);
            } catch (error) {
                toast.error(error.response?.data?.detail || "Erro ao carregar a lista de administradores.");
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    const handleDeleteUser = async (userId, username) => {
        const confirm = window.confirm(`ALERTA: Tem certeza que deseja banir o administrador "${username}" do sistema?`);
        if (!confirm) return;

        setDeletingId(userId);
        try {
            await api.delete(`/users/${userId}`);
            toast.success(`Administrador ${username} removido com sucesso!`);
            setUsers(users.filter(u => u.id !== userId));
        } catch (error) {
            toast.error(error.response?.data?.detail || "Erro ao deletar usuário.");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="list-panel" style={{ padding: '4px 0' }}>
            <h3 className="section-title" style={{ padding: '18px 18px 12px', marginBottom: 0 }}>
                Administradores do Sistema
            </h3>

            {loading ? (
                <div className="empty-state">
                    <span className="spinner spinner-dark" aria-hidden="true" style={{ width: '24px', height: '24px', margin: '0 auto 10px' }} />
                    <p>Carregando administradores...</p>
                </div>
            ) : users.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-state-icon" aria-hidden="true">👥</span>
                    <p>Nenhum usuário encontrado.</p>
                </div>
            ) : (
                <ul style={{ listStyleType: 'none' }}>
                    {users.map((user) => (
                        <li key={user.id} className="list-item">
                            <div className="list-item-info">
                                <div className="avatar-circle" aria-hidden="true">
                                    {user.username.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <div className="list-item-title">{user.username}</div>
                                    <div className="list-item-subtitle">ID: #{user.id}</div>
                                </div>
                            </div>

                            <div className="list-item-actions" style={{ alignItems: 'center' }}>
                                {user.role === 'admin' && (
                                    <span className="pill pill-admin">👑 Admin</span>
                                )}
                                <span className="pill pill-active">✅ Ativo</span>

                                {/* O botão só aparece para admins, e nunca para a própria conta logada */}
                                {isAdmin && user.username !== currentUser.username && (
                                    <button
                                        onClick={() => handleDeleteUser(user.id, user.username)}
                                        disabled={deletingId === user.id}
                                        className="btn btn-danger btn-sm"
                                    >
                                        {deletingId === user.id && <span className="spinner" aria-hidden="true" />}
                                        {deletingId === user.id ? 'Removendo...' : 'Deletar'}
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}