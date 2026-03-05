import React, { useState } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify'; // Importando a função de popup

export default function Login({ setToken }) {
    const [isRegistering, setIsRegistering] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isRegistering) {
                await api.post('/register', { username, password });
                toast.success('Conta criada! Agora faça o login.'); // Popup Verde!
                setIsRegistering(false);
            } else {
                const params = new URLSearchParams();
                params.append('username', username);
                params.append('password', password);
                
                const response = await api.post('/login', params);
                const token = response.data.access_token;
                localStorage.setItem('token', token);
                
                toast.success('Login realizado com sucesso!'); // Popup Verde!
                setToken(token); 
            }
        } catch (error) {
            toast.error('Erro: ' + (error.response?.data?.detail || 'Falha de comunicação')); // Popup Vermelho!
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#2c3e50' }}>
            <div style={{ background: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', width: '350px' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#2c3e50' }}>
                    {isRegistering ? 'Nova Conta' : 'Acesso Restrito'}
                </h2>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <input type="text" placeholder="Nome de usuário" value={username} onChange={e => setUsername(e.target.value)} required style={{ padding: '12px', border: '1px solid #ccc', borderRadius: '4px' }} />
                    <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} required style={{ padding: '12px', border: '1px solid #ccc', borderRadius: '4px' }} />
                    <button type="submit" style={{ padding: '12px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
                        {isRegistering ? 'Cadastrar' : 'Entrar'}
                    </button>
                </form>
                <p style={{ textAlign: 'center', marginTop: '20px', cursor: 'pointer', color: '#7f8c8d', fontSize: '14px' }} onClick={() => setIsRegistering(!isRegistering)}>
                    {isRegistering ? 'Já tenho uma conta. Fazer Login.' : 'Não tem conta? Crie uma aqui.'}
                </p>
            </div>
        </div>
    );
}