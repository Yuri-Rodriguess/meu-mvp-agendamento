import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import Login from './Login';
import api from '../services/api';

vi.mock('../services/api', () => ({
    default: { post: vi.fn() },
}));

vi.mock('react-toastify', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from 'react-toastify';

describe('Login', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('começa na tela de login, não de cadastro', () => {
        render(<Login setToken={vi.fn()} />);
        expect(screen.getByRole('button', { name: /^entrar$/i })).toBeInTheDocument();
    });

    it('alterna para o modo de cadastro ao clicar no link', async () => {
        const user = userEvent.setup();
        render(<Login setToken={vi.fn()} />);

        await user.click(screen.getByText(/não tem conta\? crie uma aqui\./i));

        expect(screen.getByRole('button', { name: /^cadastrar$/i })).toBeInTheDocument();
    });

    it('faz login e guarda access token + refresh token', async () => {
        api.post.mockResolvedValueOnce({
            data: { access_token: 'token-fake', refresh_token: 'refresh-fake', token_type: 'bearer' },
        });
        const setToken = vi.fn();
        const user = userEvent.setup();

        render(<Login setToken={setToken} />);

        await user.type(screen.getByLabelText(/nome de usuário/i), 'yuri');
        await user.type(screen.getByLabelText(/^senha$/i), 'senha12345');
        await user.click(screen.getByRole('button', { name: /^entrar$/i }));

        await waitFor(() => expect(setToken).toHaveBeenCalledWith('token-fake'));
        expect(localStorage.getItem('token')).toBe('token-fake');
        expect(localStorage.getItem('refresh_token')).toBe('refresh-fake');
        expect(toast.success).toHaveBeenCalled();
    });

    it('mostra o detalhe do erro vindo da API quando o login falha', async () => {
        api.post.mockRejectedValueOnce({
            response: { data: { detail: 'Usuário ou senha incorretos' } },
        });
        const user = userEvent.setup();

        render(<Login setToken={vi.fn()} />);

        await user.type(screen.getByLabelText(/nome de usuário/i), 'yuri');
        await user.type(screen.getByLabelText(/^senha$/i), 'senha-errada');
        await user.click(screen.getByRole('button', { name: /^entrar$/i }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erro: Usuário ou senha incorretos'));
    });
});
