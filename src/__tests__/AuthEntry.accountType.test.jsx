import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import AuthEntry from '../domains/auth/AuthEntry.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AuthEntry account type', () => {
  test('préselectionne le type de compte pro quand il est fourni', async () => {
    const onRegister = vi.fn(async () => ({}));
    const { container } = render(
      <AuthEntry
        initialMode="register"
        initialForm={{ accountType: 'pro' }}
        onLogin={vi.fn()}
        onRegister={onRegister}
        onRequestPasswordReset={vi.fn()}
        onUpdatePassword={vi.fn()}
      />,
    );

    expect(screen.getByText(/Crée un compte Escape Game Studio/)).toBeTruthy();
    expect(screen.queryByText(/Supabase/)).toBeNull();
    expect(screen.getByLabelText('Salle d’escape / pro').checked).toBe(true);
    expect(screen.getByLabelText('Particulier').checked).toBe(false);
    expect(screen.getAllByRole('combobox')[0].value).toBe('escape_room');

    fireEvent.change(screen.getByPlaceholderText('Ex. Marion'), { target: { value: 'Marion' } });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'facilitator' } });
    fireEvent.change(screen.getByPlaceholderText('Salle d’escape, école, association...'), { target: { value: 'Atelier test' } });
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
    });
  });

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
    fireEvent.click(screen.getByLabelText('Salle d’escape / pro'));
    expect(screen.getAllByRole('combobox')[0].value).toBe('escape_room');
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'facilitator' } });
    fireEvent.change(screen.getByPlaceholderText('Salle d’escape, école, association...'), { target: { value: 'Atelier test' } });
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

  test('adapte le type de profil au type de compte sélectionné', () => {
    render(
      <AuthEntry
        initialMode="register"
        onLogin={vi.fn()}
        onRegister={vi.fn()}
        onRequestPasswordReset={vi.fn()}
        onUpdatePassword={vi.fn()}
      />,
    );

    const profileSelect = screen.getAllByRole('combobox')[0];
    expect(profileSelect.value).toBe('player');
    expect([...profileSelect.options].map((option) => option.value)).toEqual(['', 'player', 'creator', 'other']);

    fireEvent.click(screen.getByLabelText('Salle d’escape / pro'));
    expect(profileSelect.value).toBe('escape_room');
    expect([...profileSelect.options].map((option) => option.value)).toEqual(['', 'escape_room', 'teacher', 'facilitator', 'creator', 'other']);

    fireEvent.click(screen.getByLabelText('Particulier'));
    expect(profileSelect.value).toBe('player');
    expect([...profileSelect.options].map((option) => option.value)).toEqual(['', 'player', 'creator', 'other']);
  });
});
