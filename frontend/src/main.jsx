import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Importações do Toastify
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    {/* Este é o componente que vai renderizar os popups na tela */}
    <ToastContainer position="top-right" autoClose={3000} theme="colored" />
  </StrictMode>,
)