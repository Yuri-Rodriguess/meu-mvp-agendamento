import React, { useState, useEffect } from 'react';
import api from './services/api';
import AppointmentForm from './components/AppointmentForm';
import AppointmentList from './components/AppointmentList';
import './App.css'; // Importando o nosso novo visual!

function App() {
    const [appointments, setAppointments] = useState([]);
    
    // Controles de estado para o Menu e para a Tela Atual
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [currentView, setCurrentView] = useState('cadastro'); // 'cadastro', 'lista', 'testes'

    const fetchAppointments = async () => {
        try {
            const response = await api.get('/appointments/');
            setAppointments(response.data);
        } catch (error) {
            console.error("Erro ao buscar agendamentos", error);
        }
    };

    useEffect(() => {
        fetchAppointments();
    }, []);

    // Função auxiliar para trocar de tela e fechar o menu no celular
    const handleMenuClick = (view) => {
        setCurrentView(view);
        if (window.innerWidth < 768) {
            setIsMenuOpen(false);
        }
    };

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
                </ul>
            </div>

            {/* --- CONTEÚDO PRINCIPAL --- */}
            <div className={`main-content ${isMenuOpen ? 'shifted' : ''}`}>
                <button className="hamburger-btn" onClick={() => setIsMenuOpen(true)}>
                    ☰ Menu
                </button>

                <div className="content-card">
                    {/* Renderização Condicional: Mostra apenas a tela selecionada */}
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
                            <h1 style={{marginBottom: '20px'}}>Automação de Testes (CI)</h1>
                            <p>O pipeline de testes automatizados do backend será exibido aqui.</p>
                            <div style={{padding: '15px', backgroundColor: '#fff3cd', color: '#856404', borderRadius: '5px', marginTop: '10px'}}>
                                Aguardando execução do pytest no backend...
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;