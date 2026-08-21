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
                const { access_token, refresh_token } = response.data;
                localStorage.setItem('token', access_token);
                localStorage.setItem('refresh_token', refresh_token);

                toast.success('Login realizado com sucesso!'); // Popup Verde!
                setToken(access_token);
            }
        } catch (error) {
            toast.error('Erro: ' + (error.response?.data?.detail || 'Falha de comunicação')); // Popup Vermelho!
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-shell">
                <div className="login-brand-panel" aria-hidden="true">
                    <div className="login-brand-icon">📅</div>
                    <h1>Painel Ágil</h1>
                    <p>Gerencie agendamentos, acompanhe sua agenda e mantenha o controle da sua equipe em um só lugar.</p>
                </div>
                <div className="login-form-panel">
                    <div className="login-card">
                        <h2>{isRegistering ? 'Nova Conta' : 'Acesso Restrito'}</h2>
                        <p className="login-subtitle">
                            {isRegistering ? 'Crie sua conta para começar a agendar.' : 'Entre com suas credenciais para continuar.'}
                        </p>
                        <form onSubmit={handleSubmit} className="login-form">
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
                        <p className="login-switch" onClick={() => setIsRegistering(!isRegistering)}>
                            {isRegistering ? 'Já tenho uma conta. Fazer Login.' : 'Não tem conta? Crie uma aqui.'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}