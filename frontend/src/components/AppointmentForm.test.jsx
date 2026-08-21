import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import AppointmentForm from './AppointmentForm';
import api from '../services/api';

vi.mock('../services/api', () => ({
    default: { post: vi.fn(), put: vi.fn() },
}));

vi.mock('react-toastify', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from 'react-toastify';

describe('AppointmentForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('mostra "Agendar Horário" quando não está editando', () => {
        render(<AppointmentForm onAppointmentAdded={vi.fn()} />);
        expect(screen.getByRole('button', { name: /agendar horário/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /cancelar edição/i })).not.toBeInTheDocument();
    });

    it('pré-preenche os campos e mostra "Salvar Alterações" quando está editando', () => {
        const editingAppointment = {
            id: 1,
            client_name: 'Maria',
            service: 'Corte',
            date_time: '2026-09-10T14:30:00',
        };
        render(<AppointmentForm editingAppointment={editingAppointment} onAppointmentAdded={vi.fn()} onCancelEdit={vi.fn()} />);

        expect(screen.getByLabelText(/nome do cliente/i)).toHaveValue('Maria');
        expect(screen.getByLabelText(/serviço/i)).toHaveValue('Corte');
        expect(screen.getByRole('button', { name: /salvar alterações/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /cancelar edição/i })).toBeInTheDocument();
    });

    it('envia POST /appointments/ ao criar um novo agendamento', async () => {
        api.post.mockResolvedValueOnce({ data: { id: 1 } });
        const onAppointmentAdded = vi.fn();
        const user = userEvent.setup();

        render(<AppointmentForm onAppointmentAdded={onAppointmentAdded} />);

        await user.type(screen.getByLabelText(/nome do cliente/i), 'Cliente Teste');
        await user.type(screen.getByLabelText(/serviço/i), 'Barba');
        await user.type(screen.getByLabelText(/data e horário/i), '2026-09-10T10:00');
        await user.click(screen.getByRole('button', { name: /agendar horário/i }));

        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/appointments/', {
            client_name: 'Cliente Teste',
            service: 'Barba',
            date_time: '2026-09-10T10:00',
            client_email: null,
        }));
        expect(toast.success).toHaveBeenCalled();
        expect(onAppointmentAdded).toHaveBeenCalled();
    });

    it('envia o e-mail do cliente quando preenchido', async () => {
        api.post.mockResolvedValueOnce({ data: { id: 1 } });
        const user = userEvent.setup();

        render(<AppointmentForm onAppointmentAdded={vi.fn()} />);

        await user.type(screen.getByLabelText(/nome do cliente/i), 'Cliente Teste');
        await user.type(screen.getByLabelText(/serviço/i), 'Barba');
        await user.type(screen.getByLabelText(/data e horário/i), '2026-09-10T10:00');
        await user.type(screen.getByLabelText(/e-mail do cliente/i), 'cliente@teste.com');
        await user.click(screen.getByRole('button', { name: /agendar horário/i }));

        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/appointments/', expect.objectContaining({
            client_email: 'cliente@teste.com',
        })));
    });

    it('mostra o aviso de conflito de horário quando a API responde 409', async () => {
        api.post.mockRejectedValueOnce({
            response: { status: 409, data: { detail: 'Já existe um agendamento seu nesse horário.' } },
        });
        const user = userEvent.setup();

        render(<AppointmentForm onAppointmentAdded={vi.fn()} />);

        await user.type(screen.getByLabelText(/nome do cliente/i), 'Cliente Teste');
        await user.type(screen.getByLabelText(/serviço/i), 'Barba');
        await user.type(screen.getByLabelText(/data e horário/i), '2026-09-10T10:00');
        await user.click(screen.getByRole('button', { name: /agendar horário/i }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Já existe um agendamento seu nesse horário.'));
    });
});
