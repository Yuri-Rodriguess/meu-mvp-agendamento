import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000', // URL onde o FastAPI está rodando
});

export default api;