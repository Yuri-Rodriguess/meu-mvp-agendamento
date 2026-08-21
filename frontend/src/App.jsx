import React, { useState, useEffect } from 'react';
import api, { runTests } from './services/api';
import AppointmentForm from './components/AppointmentForm';
import AppointmentList from './components/AppointmentList';
import Login from './components/Login';
import './App.css';
import UserList from './components/UserList';
import { toast } from 'react-toastify';

function App() {

    const [token, setToken] = useState(localStorage.getItem('token'));
    const [appointments, setAppointments] = useState([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [currentView, setCurrentView] = useState('cadastro');
    const [testStatus, setTestStatus] = useState('pendente');
    const [editingAppointment, setEditingAppointment] = useState(null);
    const [runningTests, setRunningTests] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('token');
        setToken(null);
    };

    const fetchAppointments = async () => {
        if (!token) return; // Só busca se tiver token
        try {
            const response = await api.get('/appointments/');
            setAppointments(response.data);
        } catch (error) {
            console.error("Erro ao buscar agendamentos", error);
            // Se o token estiver vencido ou inválido, avisa e desloga automaticamente
            if (error.response && error.response.status === 401) {
                toast.error('Sua sessão expirou. Faça login novamente.');
                handleLogout();
            } else {
                toast.error('Não foi possível carregar os agendamentos. Tente novamente.');
            }
        }
    };

    useEffect(() => {
        fetchAppointments();
    }, [token]); // Atualiza sempre que o token mudar

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

    return (
        <div className="app-container">
            {/* --- MENU LATERAL --- */}
            <div className={`sidebar ${isMenuOpen ? 'open' : ''}`}>
                <button className="close-btn" onClick={() => setIsMenuOpen(false)} aria-label="Fechar menu">×</button>
                <h2>Painel Ágil</h2>
                <ul>
                    <li className={currentView === 'cadastro' ? 'active' : ''}>
                        <button className="sidebar-link" onClick={() => handleMenuClick('cadastro')}>
                            📅 Fazer um Cadastro
                        </button>
                    </li>
                    <li className={currentView === 'lista' ? 'active' : ''}>
                        <button className="sidebar-link" onClick={() => handleMenuClick('lista')}>
                            📋 Verificar Cadastros
                        </button>
                    </li>
                    <li className={currentView === 'testes' ? 'active' : ''}>
                        <button className="sidebar-link" onClick={() => handleMenuClick('testes')}>
                            ⚙️ Resultados de Testes
                        </button>
                    </li>
                    <li className={currentView === 'usuarios' ? 'active' : ''}>
                        <button className="sidebar-link" onClick={() => handleMenuClick('usuarios')}>
                            👥 Administradores
                        </button>
                    </li>
                    <li style={{ marginTop: '20px' }}>
                        <button className="sidebar-link" onClick={handleLogout} style={{ color: '#e74c3c', fontWeight: 'bold' }}>
                            🚪 Sair do Sistema
                        </button>
                    </li>
                </ul>
            </div>

            {/* Escurece o fundo e permite fechar o menu clicando fora dele (mobile) */}
            <div
                className={`sidebar-overlay ${isMenuOpen ? 'open' : ''}`}
                onClick={() => setIsMenuOpen(false)}
                aria-hidden="true"
            />

            {/* --- CONTEÚDO PRINCIPAL --- */}
            <div className={`main-content ${isMenuOpen ? 'shifted' : ''}`}>
                <button className="hamburger-btn" onClick={() => setIsMenuOpen(true)} aria-label="Abrir menu">
                    ☰ Menu
                </button>

                <div className="content-card">
                    {currentView === 'cadastro' && (
                        <div>
                            <h1 style={{marginBottom: '20px'}}>{editingAppointment ? 'Editar Agendamento' : 'Agendar Horário'}</h1>
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
                            <h1 style={{marginBottom: '20px'}}>Gestão de Agenda</h1>
                            <AppointmentList
                                appointments={appointments}
                                onAppointmentDeleted={fetchAppointments}
                                onEdit={handleEditAppointment}
                            />
                        </div>
                    )}

                    {currentView === 'testes' && (
                        <div>
                            <div className="dashboard-header">
                                <h1>Automação de Testes (CI)</h1>
                                {testStatus === 'pendente' && <div className="status-badge pendente">⏳ Status: Aguardando Execução</div>}
                                {testStatus === 'sucesso' && <div className="status-badge sucesso">✅ Status: Todos os testes passaram!</div>}
                                {testStatus === 'falha' && <div className="status-badge falha">❌ Status: Falha nos testes</div>}
                            </div>
                            
                            <p style={{ color: '#666', marginBottom: '20px' }}>
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
                            <h1 style={{marginBottom: '20px'}}>Gestão de Acesso</h1>
                            <p style={{ color: '#666' }}>Visualize as contas com permissão de administrador no painel.</p>
                            <UserList />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;