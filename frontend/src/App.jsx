import React, { useState, useEffect } from 'react';
import api, { runTests } from './services/api';
import AppointmentForm from './components/AppointmentForm';
import AppointmentList from './components/AppointmentList';
import Login from './components/Login';
import ThemeSettings from './components/ThemeSettings';
import Professionals from './components/Professionals';
import './App.css';
import UserList from './components/UserList';
import { toast } from 'react-toastify';
import { loadTheme, saveTheme, applyTheme } from './theme';

// Lê o nome do usuário logado a partir do payload do token JWT, só para
// exibir na sidebar (mesma técnica usada em components/UserList.jsx)
const getLoggedUsername = (token) => {
    if (!token) return null;
    try {
        const payloadBase64 = token.split('.')[1];
        const payload = JSON.parse(atob(payloadBase64));
        return payload.sub ?? null;
    } catch {
        return null;
    }
};

const NAV_ITEMS = [
    { key: 'cadastro', label: 'Fazer um Cadastro', icon: '📅' },
    { key: 'lista', label: 'Verificar Cadastros', icon: '📋' },
    { key: 'profissionais', label: 'Profissionais', icon: '🧑‍💼' },
    { key: 'testes', label: 'Resultados de Testes', icon: '⚙️' },
    { key: 'usuarios', label: 'Administradores', icon: '👥' },
];

function App() {

    const [token, setToken] = useState(localStorage.getItem('token'));
    const [appointments, setAppointments] = useState([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [currentView, setCurrentView] = useState('cadastro');
    const [testStatus, setTestStatus] = useState('pendente');
    const [editingAppointment, setEditingAppointment] = useState(null);
    const [runningTests, setRunningTests] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [theme, setTheme] = useState(loadTheme);
    const [showThemeSettings, setShowThemeSettings] = useState(false);

    // Aplica o tema (claro/escuro + cor de marca) no <html> sempre que
    // mudar, e persiste no navegador. Roda antes do "if (!token)" abaixo
    // de propósito — assim a tela de login também recebe a personalização.
    useEffect(() => {
        applyTheme(theme);
        saveTheme(theme);
    }, [theme]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        setToken(null);
    };

    const fetchAppointments = async () => {
        if (!token) return; // Só busca se tiver token
        try {
            const response = await api.get('/appointments/', {
                params: searchTerm ? { search: searchTerm } : {},
            });
            setAppointments(response.data);
        } catch (error) {
            console.error("Erro ao buscar agendamentos", error);
            // 401 já é tratado de forma centralizada pelo interceptor do axios
            // (services/api.js): ele tenta renovar o token e, se não conseguir,
            // desloga com aviso — evita duplicar essa lógica aqui.
            if (error.response?.status !== 401) {
                toast.error('Não foi possível carregar os agendamentos. Tente novamente.');
            }
        }
    };

    useEffect(() => {
        if (!token) return;
        // Debounce: espera parar de digitar antes de buscar de novo
        const timeout = setTimeout(() => {
            fetchAppointments();
        }, 300);
        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, searchTerm]);

    // Disparado pelo interceptor do axios (services/api.js) quando o access
    // token expira e a renovação via refresh token também falha
    useEffect(() => {
        const handleAutoLogout = () => setToken(null);
        window.addEventListener('auth:logout', handleAutoLogout);
        return () => window.removeEventListener('auth:logout', handleAutoLogout);
    }, []);

    // Fecha o menu lateral com a tecla Esc (acessibilidade de teclado)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsMenuOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleMenuClick = (view) => {
        setCurrentView(view);
        if (view !== 'cadastro') {
            setEditingAppointment(null); // Sai do modo edição ao trocar de tela
        }
        if (window.innerWidth < 768) {
            setIsMenuOpen(false);
        }
    };

    const handleEditAppointment = (appointment) => {
        setEditingAppointment(appointment);
        setCurrentView('cadastro');
    };

    const handleAppointmentSaved = () => {
        setEditingAppointment(null);
        fetchAppointments();
    };

    if (!token) {
        return <Login setToken={setToken} />;
    }

    const loggedUsername = getLoggedUsername(token);

    return (
        <div className="app-container">
            {/* --- MENU LATERAL --- */}
            <div className={`sidebar ${isMenuOpen ? 'open' : ''}`}>
                <button className="close-btn" onClick={() => setIsMenuOpen(false)} aria-label="Fechar menu">×</button>
                <div className="sidebar-brand">
                    <div className="sidebar-brand-icon" aria-hidden="true">📅</div>
                    <div className="sidebar-brand-text">
                        <strong>Painel Ágil</strong>
                        <span>Agendamento Online</span>
                    </div>
                </div>
                <nav>
                    <ul>
                        {NAV_ITEMS.map((item) => (
                            <li key={item.key} className={currentView === item.key ? 'active' : ''}>
                                <button className="sidebar-link" onClick={() => handleMenuClick(item.key)}>
                                    <span className="icon" aria-hidden="true">{item.icon}</span>
                                    {item.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>
                <div className="sidebar-footer">
                    {loggedUsername && (
                        <div className="sidebar-user">
                            <div className="sidebar-user-avatar" aria-hidden="true">
                                {loggedUsername.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="sidebar-user-name">{loggedUsername}</span>
                        </div>
                    )}
                    <ul>
                        <li>
                            <button className="sidebar-link" onClick={() => setShowThemeSettings(true)}>
                                <span className="icon" aria-hidden="true">🎨</span>
                                Aparência
                            </button>
                        </li>
                        <li>
                            <button className="sidebar-link sidebar-logout" onClick={handleLogout}>
                                <span className="icon" aria-hidden="true">🚪</span>
                                Sair do Sistema
                            </button>
                        </li>
                    </ul>
                </div>
            </div>

            {showThemeSettings && (
                <ThemeSettings theme={theme} onChange={setTheme} onClose={() => setShowThemeSettings(false)} />
            )}

            {/* Escurece o fundo e permite fechar o menu clicando fora dele (mobile) */}
            <div
                className={`sidebar-overlay ${isMenuOpen ? 'open' : ''}`}
                onClick={() => setIsMenuOpen(false)}
                aria-hidden="true"
            />

            {/* --- CONTEÚDO PRINCIPAL --- */}
            <div className={`main-content ${isMenuOpen ? 'shifted' : ''}`}>
                <div className="top-bar">
                    <button className="hamburger-btn" onClick={() => setIsMenuOpen(true)} aria-label="Abrir menu">
                        ☰ Menu
                    </button>
                    <button
                        className="hamburger-btn"
                        style={{ marginLeft: 'auto' }}
                        onClick={() => setTheme((atual) => ({ ...atual, mode: atual.mode === 'dark' ? 'light' : 'dark' }))}
                        aria-label={theme.mode === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                        title={theme.mode === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                    >
                        {theme.mode === 'dark' ? '☀️' : '🌙'}
                    </button>
                </div>

                <div className="content-card">
                    {currentView === 'cadastro' && (
                        <div>
                            <div className="page-header">
                                <h1>{editingAppointment ? 'Editar Agendamento' : 'Agendar Horário'}</h1>
                                <p>Preencha os dados abaixo para {editingAppointment ? 'atualizar' : 'criar'} um agendamento.</p>
                            </div>
                            <AppointmentForm
                                key={editingAppointment ? editingAppointment.id : 'novo'}
                                onAppointmentAdded={handleAppointmentSaved}
                                editingAppointment={editingAppointment}
                                onCancelEdit={() => setEditingAppointment(null)}
                            />
                        </div>
                    )}

                    {currentView === 'lista' && (
                        <div>
                            <div className="page-header">
                                <h1>Gestão de Agenda</h1>
                                <p>Veja o calendário completo e a lista detalhada dos seus horários.</p>
                            </div>
                            <label className="visually-hidden" htmlFor="busca-agendamentos">Buscar por cliente ou serviço</label>
                            <input
                                id="busca-agendamentos"
                                type="search"
                                placeholder="🔍 Buscar por cliente ou serviço..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="form-field search-field"
                            />
                            <AppointmentList
                                appointments={appointments}
                                onAppointmentDeleted={fetchAppointments}
                                onEdit={handleEditAppointment}
                                isFiltered={Boolean(searchTerm)}
                            />
                        </div>
                    )}

                    {currentView === 'profissionais' && (
                        <div>
                            <div className="page-header">
                                <h1>Profissionais</h1>
                                <p>Cadastre a equipe que atende os clientes para poder escolher quem atende cada agendamento.</p>
                            </div>
                            <Professionals />
                        </div>
                    )}

                    {currentView === 'testes' && (
                        <div>
                            <div className="dashboard-header">
                                <div className="page-header" style={{ marginBottom: 0 }}>
                                    <h1>Automação de Testes (CI)</h1>
                                </div>
                                {testStatus === 'pendente' && <div className="status-badge pendente">⏳ Status: Aguardando Execução</div>}
                                {testStatus === 'sucesso' && <div className="status-badge sucesso">✅ Status: Todos os testes passaram!</div>}
                                {testStatus === 'falha' && <div className="status-badge falha">❌ Status: Falha nos testes</div>}
                            </div>

                            <p style={{ color: 'var(--color-text-soft)', marginBottom: '20px' }}>
                                Validação contínua do Backend (FastAPI). Clique no botão abaixo para capturar o último log gerado pelo Pytest.
                            </p>

                            <button
                                disabled={runningTests}
                                onClick={async () => {
                                    setRunningTests(true);
                                    setTestStatus('pendente');
                                    document.getElementById('terminal-testes').innerText = "Iniciando pipeline de testes no servidor...\nExecutando pytest...";

                                    try {
                                        const response = await runTests();
                                        const logTexto = response.data.log;

                                        document.getElementById('terminal-testes').innerText = logTexto;

                                        if (logTexto.includes('FAILED') || logTexto.includes('ERRORS')) {
                                            setTestStatus('falha');
                                        } else if (logTexto.includes('passed')) {
                                            setTestStatus('sucesso');
                                        } else {
                                            setTestStatus('pendente');
                                        }

                                        fetchAppointments();

                                    } catch (e) {
                                        console.error("Erro na integração", e);
                                        document.getElementById('terminal-testes').innerText = "Falha ao conectar com o Backend.";
                                        setTestStatus('falha');
                                        toast.error(e.response?.data?.detail || 'Falha ao conectar com o backend para rodar os testes.');
                                    } finally {
                                        setRunningTests(false);
                                    }
                                }}
                                className="btn btn-primary"
                            >
                                {runningTests && <span className="spinner" aria-hidden="true" />}
                                {runningTests ? 'Rodando...' : '🔄 Atualizar Log de Testes'}
                            </button>

                            <div className="terminal-container">
                                <div className="terminal-header">
                                    <div className="terminal-dot dot-red"></div>
                                    <div className="terminal-dot dot-yellow"></div>
                                    <div className="terminal-dot dot-green"></div>
                                    <span className="terminal-title">bash — pytest -v</span>
                                </div>
                                <pre id="terminal-testes" className="terminal-body">
                                    Aguardando carregamento dos logs...
                                </pre>
                            </div>
                        </div>
                    )}
                    {currentView === 'usuarios' && (
                        <div>
                            <div className="page-header">
                                <h1>Gestão de Acesso</h1>
                                <p>Visualize as contas com permissão de administrador no painel.</p>
                            </div>
                            <UserList />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;