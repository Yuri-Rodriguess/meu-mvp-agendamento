import React, { useState, useEffect } from 'react';
import api from './services/api';
import AppointmentForm from './components/AppointmentForm';
import AppointmentList from './components/AppointmentList';
import Login from './components/Login';
import './App.css';

function App() {
    // 1. TODOS OS ESTADOS DEVEM FICAR AQUI NO TOPO (Regra do React)
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [appointments, setAppointments] = useState([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [currentView, setCurrentView] = useState('cadastro');
    const [testStatus, setTestStatus] = useState('pendente');

    // 2. FUNÇÕES DE LÓGICA
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
            // Se o token estiver vencido ou inválido, desloga automaticamente
            if (error.response && error.response.status === 401) {
                handleLogout();
            }
        }
    };

    useEffect(() => {
        fetchAppointments();
    }, [token]); // Atualiza sempre que o token mudar

    const handleMenuClick = (view) => {
        setCurrentView(view);
        if (window.innerWidth < 768) {
            setIsMenuOpen(false);
        }
    };

    // 3. TRAVA DE SEGURANÇA: Deve vir ANTES do visual e DEPOIS dos Hooks
    if (!token) {
        return <Login setToken={setToken} />;
    }

    // 4. VISUAL PRINCIPAL (O DASHBOARD)
    return (
        <div className="app-container">
            {/* --- MENU LATERAL --- */}
            <div className={`sidebar ${isMenuOpen ? 'open' : ''}`}>
                <button className="close-btn" onClick={() => setIsMenuOpen(false)}>×</button>
                <h2>Painel Ágil</h2>
                <ul>
                    <li className={currentView === 'cadastro' ? 'active' : ''} onClick={() => handleMenuClick('cadastro')}>
                        📅 Fazer um Cadastro
                    </li>
                    <li className={currentView === 'lista' ? 'active' : ''} onClick={() => handleMenuClick('lista')}>
                        📋 Verificar Cadastros
                    </li>
                    <li className={currentView === 'testes' ? 'active' : ''} onClick={() => handleMenuClick('testes')}>
                        ⚙️ Resultados de Testes
                    </li>
                    <li onClick={handleLogout} style={{ color: '#e74c3c', marginTop: '20px', fontWeight: 'bold' }}>
                        🚪 Sair do Sistema
                    </li>
                </ul>
            </div>

            {/* --- CONTEÚDO PRINCIPAL --- */}
            <div className={`main-content ${isMenuOpen ? 'shifted' : ''}`}>
                <button className="hamburger-btn" onClick={() => setIsMenuOpen(true)}>
                    ☰ Menu
                </button>

                <div className="content-card">
                    {currentView === 'cadastro' && (
                        <div>
                            <h1 style={{marginBottom: '20px'}}>Agendar Horário</h1>
                            <AppointmentForm onAppointmentAdded={fetchAppointments} />
                        </div>
                    )}

                    {currentView === 'lista' && (
                        <div>
                            <h1 style={{marginBottom: '20px'}}>Gestão de Agenda</h1>
                            <AppointmentList appointments={appointments} onAppointmentDeleted={fetchAppointments} />
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
                                onClick={async () => {
                                    setTestStatus('pendente');
                                    document.getElementById('terminal-testes').innerText = "Iniciando pipeline de testes no servidor...\nExecutando pytest...";
                                    
                                    try {
                                        const response = await api.get('/api/run-tests');
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
                                    }
                                }}
                                style={{ padding: '10px 20px', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                🔄 Atualizar Log de Testes
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
                </div>
            </div>
        </div>
    );
}

export default App;