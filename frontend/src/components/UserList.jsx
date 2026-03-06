import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

// Função para descobrir quem está logado lendo o Token JWT
const getLoggedUsername = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
        // O JWT é dividido em 3 partes separadas por ponto. A segunda é o payload (os dados)
        const payloadBase64 = token.split('.')[1];
        const decodedJson = atob(payloadBase64); // Decodifica a base64
        const payload = JSON.parse(decodedJson);
        return payload.sub; // No FastAPI, salvamos o username no campo "sub"
    } catch (e) {
        return null;
    }
};

export default function UserList() {
    const [users, setUsers] = useState([]);
    
    // Descobre quem é o usuário atual e se ele é o Super Admin
    const currentUser = getLoggedUsername();
    const isSuperAdmin = currentUser && currentUser.toLowerCase() === 'yuri';

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await api.get('/users/');
                setUsers(response.data);
            } catch (error) {
                toast.error("Erro ao carregar a lista de administradores.");
            }
        };
        fetchUsers();
    }, []);

    const handleDeleteUser = async (userId, username) => {
        const confirm = window.confirm(`ALERTA: Tem certeza que deseja banir o administrador "${username}" do sistema?`);
        if (!confirm) return;

        try {
            await api.delete(`/users/${userId}`);
            toast.success(`Administrador ${username} removido com sucesso!`);
            setUsers(users.filter(u => u.id !== userId)); 
        } catch (error) {
            toast.error(error.response?.data?.detail || "Erro ao deletar usuário.");
        }
    };

    return (
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginTop: '20px' }}>
            <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '15px', color: '#2c3e50' }}>
                Administradores do Sistema
            </h3>
            
            {users.length === 0 ? (
                <p>Nenhum usuário encontrado.</p>
            ) : (
                <ul style={{ listStyleType: 'none', padding: 0 }}>
                    {users.map((user) => (
                        <li key={user.id} style={{ 
                            padding: '15px', 
                            borderBottom: '1px solid #eee', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center'
                        }}>
                            <div>
                                <strong style={{ fontSize: '1.1rem' }}>{user.username}</strong> <br/>
                                <span style={{ color: '#7f8c8d', fontSize: '0.9rem' }}>ID: #{user.id}</span>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <span style={{ backgroundColor: '#2ecc71', color: 'white', padding: '5px 12px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                    ✅ Ativo
                                </span>
                                
                                {/* O botão só aparece se for o Yuri logado E se o usuário da linha não for o próprio Yuri */}
                                {isSuperAdmin && user.username.toLowerCase() !== 'yuri' && (
                                    <button 
                                        onClick={() => handleDeleteUser(user.id, user.username)}
                                        style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                        Deletar
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