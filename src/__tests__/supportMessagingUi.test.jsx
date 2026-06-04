import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const loadSupportUi = async () => {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  const [{ default: SupportWidget }, { default: ProfileMessagesPanel }, supportMessages] = await Promise.all([
    import('../domains/support/components/SupportWidget.jsx'),
    import('../domains/profile/components/ProfileMessagesPanel.jsx'),
    import('../shared/services/supportMessages.js'),
  ]);
  return { SupportWidget, ProfileMessagesPanel, supportMessages };
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllEnvs();
});

describe('support messaging UI', () => {
  it('opens the floating support form and sends a message', async () => {
    const { SupportWidget } = await loadSupportUi();
    const user = { id: 'user-ui', email: 'ui@example.com', name: 'Mika' };

    render(<SupportWidget user={user} />);

    fireEvent.click(screen.getByRole('button', { name: 'Message' }));
    fireEvent.change(screen.getByLabelText('Sujet'), { target: { value: 'Bug preview' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Le bouton ne répond pas.' } });
    fireEvent.click(screen.getByRole('button', { name: /Envoyer/i }));

    await waitFor(() => {
      expect(screen.getByText(/Message envoyé/i)).toBeTruthy();
    });
  });

  it('shows support threads in the profile messaging tab', async () => {
    const { ProfileMessagesPanel, supportMessages } = await loadSupportUi();
    const user = { id: 'user-profile', email: 'profile@example.com', name: 'Nina' };
    await supportMessages.createSupportTicket({
      category: 'help',
      subject: 'Besoin aide',
      body: 'Comment publier mon jeu ?',
    }, user);

    render(<ProfileMessagesPanel user={user} />);

    await waitFor(() => {
      expect(screen.getAllByText('Besoin aide').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Comment publier mon jeu ?').length).toBeGreaterThan(0);
    });
  });
});
