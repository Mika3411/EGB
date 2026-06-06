import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import AuthEntry from '../domains/auth/AuthEntry.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AuthEntry account type', () => {
  test('envoie le type de compte pro pendant l inscription', async () => {
    const onRegister = vi.fn(async () => ({}));
    const { container } = render(
      <AuthEntry
        initialMode="register"
        onLogin={vi.fn()}
        onRegister={onRegister}
        onRequestPasswordReset={vi.fn()}
        onUpdatePassword={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Ex. Marion'), { target: { value: 'Marion' } });
    fireEvent.click(screen.getByLabelText('Pro'));
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'facilitator' } });
    fireEvent.change(screen.getByPlaceholderText('École, association, entreprise...'), { target: { value: 'Atelier test' } });
    fireEvent.change(screen.getByPlaceholderText('marion@email.com'), { target: { value: 'marion@example.com' } });
    fireEvent.change(container.querySelector('input[type="password"]'), { target: { value: 'secret123' } });
    fireEvent.change(screen.getByPlaceholderText('Répète le mot de passe'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Créer le compte' }));

    await waitFor(() => {
      expect(onRegister).toHaveBeenCalledTimes(1);
    });
    expect(onRegister.mock.calls[0][0]).toMatchObject({
      accountType: 'pro',
      profileType: 'facilitator',
      organization: 'Atelier test',
      email: 'marion@example.com',
    });
  });
});
