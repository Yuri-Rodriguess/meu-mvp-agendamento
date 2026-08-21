import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
});

api.interceptors.request.use(async config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// A rota /api/run-tests exige uma chave de API (ver backend/.env.example)
// para impedir que qualquer visitante dispare o pipeline de testes.
export const runTests = () =>
    api.get('/api/run-tests', {
        headers: { 'X-API-Key': import.meta.env.VITE_TEST_RUNNER_API_KEY },
    });

export default api;