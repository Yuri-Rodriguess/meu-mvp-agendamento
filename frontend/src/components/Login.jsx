import React, { useState } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify'; // Importando a função de popup

export default function Login({ setToken }) {
    const [isRegistering, setIsRegistering] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isRegistering) {
                await api.post('/register', { username, password });
                toast.success('Conta criada! Agora faça o login.'); // Popup Verde!
                setIsRegistering(false);
                setPassword('');
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
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--color-text)', padding: '20px' }}>
            <div style={{ background: 'white', padding: '40px', borderRadius: 'var(--radius)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', width: '100%', maxWidth: '350px' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '20px', color: 'var(--color-text)' }}>
                    {isRegistering ? 'Nova Conta' : 'Acesso Restrito'}
                </h2>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <label className="visually-hidden" htmlFor="login-username">Nome de usuário</label>
                    <input
                        id="login-username"
                        type="text"
                        placeholder="Nome de usuário"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        required
                        autoComplete="username"
                        className="form-field"
                    />
                    <label className="visually-hidden" htmlFor="login-password">Senha</label>
                    <input
                        id="login-password"
                        type="password"
                        placeholder="Senha"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        autoComplete={isRegistering ? 'new-password' : 'current-password'}
                        className="form-field"
                    />
                    <button type="submit" disabled={loading} className="btn btn-primary btn-block">
                        {loading && <span className="spinner" aria-hidden="true" />}
                        {loading ? 'Aguarde...' : isRegistering ? 'Cadastrar' : 'Entrar'}
                    </button>
                </form>
                <p
                    style={{ textAlign: 'center', marginTop: '20px', cursor: 'pointer', color: 'var(--color-text-soft)', fontSize: '14px' }}
                    onClick={() => setIsRegistering(!isRegistering)}
                >
                    {isRegistering ? 'Já tenho uma conta. Fazer Login.' : 'Não tem conta? Crie uma aqui.'}
                </p>
            </div>
        </div>
    );
}