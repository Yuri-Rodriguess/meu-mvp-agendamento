import axios from 'axios';
import { toast } from 'react-toastify';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Rotas que não devem disparar a tentativa de renovar o token (evita loop
// infinito: um 401 nelas não significa "token expirado", e sim credenciais
// erradas de fato)
const ROTAS_SEM_RENOVACAO = ['/login', '/register', '/refresh'];

// Só uma renovação por vez: se várias chamadas falharem com 401 ao mesmo
// tempo, todas esperam a mesma promise em vez de disparar N refreshes.
let refreshEmAndamento = null;

const renovarAccessToken = () => {
    if (!refreshEmAndamento) {
        const refreshToken = localStorage.getItem('refresh_token');
        refreshEmAndamento = (refreshToken
            ? axios.post(`${BASE_URL}/refresh`, { refresh_token: refreshToken })
            : Promise.reject(new Error('Sem refresh token salvo.'))
        )
            .then(({ data }) => {
                localStorage.setItem('token', data.access_token);
                return data.access_token;
            })
            .finally(() => {
                refreshEmAndamento = null;
            });
    }
    return refreshEmAndamento;
};

// Se o access token expirou (401), tenta renovar silenciosamente com o
// refresh token e repetir a requisição original antes de desistir. Só
// desloga o usuário (com aviso) se a renovação também falhar.
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const { config, response } = error;
        const rotaSemRenovacao = config && ROTAS_SEM_RENOVACAO.some((rota) => config.url?.includes(rota));

        if (response?.status === 401 && config && !config._jaTentouRenovar && !rotaSemRenovacao) {
            config._jaTentouRenovar = true;
            try {
                const novoToken = await renovarAccessToken();
                config.headers.Authorization = `Bearer ${novoToken}`;
                return api(config);
            } catch {
                localStorage.removeItem('token');
                localStorage.removeItem('refresh_token');
                toast.error('Sua sessão expirou. Faça login novamente.');
                window.dispatchEvent(new Event('auth:logout'));
            }
        }

        return Promise.reject(error);
    }
);

// A rota /api/run-tests exige uma chave de API (ver backend/.env.example)
// para impedir que qualquer visitante dispare o pipeline de testes.
export const runTests = () =>
    api.get('/api/run-tests', {
        headers: { 'X-API-Key': import.meta.env.VITE_TEST_RUNNER_API_KEY },
    });

export default api;