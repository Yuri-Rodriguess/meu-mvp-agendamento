import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import AppointmentList from './AppointmentList';
import api from '../services/api';

// O calendário em si é um componente de terceiros — o que importa testar
// aqui é a "Lista Detalhada" e as ações de editar/cancelar.
vi.mock('react-big-calendar', () => ({
    Calendar: () => <div data-testid="calendar-mock" />,
    dateFnsLocalizer: vi.fn(() => ({})),
}));

vi.mock('../services/api', () => ({
    default: { delete: vi.fn() },
}));

vi.mock('react-toastify', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

const agendamentos = [
    { id: 1, client_name: 'Maria', service: 'Corte', date_time: '2026-09-10T14:00:00' },
    { id: 2, client_name: 'João', service: 'Barba', date_time: '2026-09-11T15:00:00' },
];

describe('AppointmentList', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('mostra o estado vazio padrão quando não há agendamentos', () => {
        render(<AppointmentList appointments={[]} onAppointmentDeleted={vi.fn()} onEdit={vi.fn()} />);
        expect(screen.getByText(/nenhum agendamento encontrado/i)).toBeInTheDocument();
    });

    it('mostra uma mensagem diferente quando a lista vazia veio de uma busca filtrada', () => {
        render(<AppointmentList appointments={[]} onAppointmentDeleted={vi.fn()} onEdit={vi.fn()} isFiltered />);
        expect(screen.getByText(/nenhum resultado para essa busca/i)).toBeInTheDocument();
    });

    it('lista os agendamentos recebidos', () => {
        render(<AppointmentList appointments={agendamentos} onAppointmentDeleted={vi.fn()} onEdit={vi.fn()} />);
        expect(screen.getByText(/maria/i)).toBeInTheDocument();
        expect(screen.getByText(/joão/i)).toBeInTheDocument();
    });

    it('chama onEdit com o agendamento certo ao clicar em Editar', async () => {
        const onEdit = vi.fn();
        const user = userEvent.setup();
        render(<AppointmentList appointments={agendamentos} onAppointmentDeleted={vi.fn()} onEdit={onEdit} />);

        const botoesEditar = screen.getAllByRole('button', { name: /editar/i });
        await user.click(botoesEditar[0]);

        expect(onEdit).toHaveBeenCalledWith(agendamentos[0]);
    });

    it('pede confirmação e só cancela o agendamento depois do "Sim, Cancelar"', async () => {
        api.delete.mockResolvedValueOnce({});
        const onAppointmentDeleted = vi.fn();
        const user = userEvent.setup();
        render(<AppointmentList appointments={agendamentos} onAppointmentDeleted={onAppointmentDeleted} onEdit={vi.fn()} />);

        const botoesCancelar = screen.getAllByRole('button', { name: /^cancelar$/i });
        await user.click(botoesCancelar[0]);

        expect(screen.getByText(/cancelar agendamento\?/i)).toBeInTheDocument();
        expect(api.delete).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: /sim, cancelar/i }));

        await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/appointments/1'));
        expect(onAppointmentDeleted).toHaveBeenCalled();
    });
});
