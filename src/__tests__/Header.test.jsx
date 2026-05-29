import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import Header from '../components/Header.jsx';
import Rpg3DHeader from '../components/rpg3d/Rpg3DHeader.jsx';

const noop = () => {};

const renderHeader = (props = {}) => render(
  <Header
    projectTitle="Projet test"
    onImportJson={noop}
    onExportStandalone={noop}
    onExportAuthorSummary={noop}
    user={{ name: 'Compte brut', email: 'mika@example.com' }}
    authorProfile={{ displayName: 'Mika Studio' }}
    onLogout={noop}
    saveStatus="Sauvegarde active"
    {...props}
  />,
);

describe('Header', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('affiche le nom utilisateur dans l entete', () => {
    renderHeader();

    expect(screen.getByText('Utilisateur')).toBeTruthy();
    expect(screen.getByText('Mika Studio')).toBeTruthy();
    expect(screen.getByText('mika@example.com')).toBeTruthy();
  });

  test('garde l export standalone offline decoche par defaut', () => {
    renderHeader();

    const checkbox = screen.getByRole('checkbox', {
      name: 'Inclure les médias dans le fichier pour jouer hors ligne',
    });
    expect(checkbox.checked).toBe(false);
    expect(screen.getByText(/Le fichier sera plus lourd/i)).toBeTruthy();
  });

  test('conserve l export standalone actuel quand l option offline est decochee', async () => {
    const onExportStandalone = vi.fn(async () => ({}));
    renderHeader({ onExportStandalone });

    fireEvent.click(screen.getByRole('button', { name: 'Exporter jeu' }));

    await waitFor(() => {
      expect(onExportStandalone).toHaveBeenCalledTimes(1);
    });
    expect(onExportStandalone.mock.calls[0]).toEqual([]);
  });

  test('transmet exportOfflineAssets quand l option offline est cochee', async () => {
    const onExportStandalone = vi.fn(async () => ({}));
    renderHeader({ onExportStandalone });

    fireEvent.click(screen.getByRole('checkbox', {
      name: 'Inclure les médias dans le fichier pour jouer hors ligne',
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Exporter jeu' }));

    await waitFor(() => {
      expect(onExportStandalone).toHaveBeenCalledWith({ exportOfflineAssets: true });
    });
  });

  test('affiche le resume offline apres export', async () => {
    const onExportStandalone = vi.fn(async () => ({
      offlineAssetsMessage: 'Export offline : 2 médias intégrés, 0 médias restés en ligne.',
      offlineAssetsSummary: { onlineCount: 0 },
    }));
    renderHeader({ onExportStandalone });

    fireEvent.click(screen.getByRole('checkbox', {
      name: 'Inclure les médias dans le fichier pour jouer hors ligne',
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Exporter jeu' }));

    expect((await screen.findByRole('status')).textContent).toBe('Export offline : 2 médias intégrés, 0 médias restés en ligne.');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('affiche un warning non bloquant si des medias restent en ligne', async () => {
    const onExportStandalone = vi.fn(async () => ({
      offlineAssetsMessage: 'Export offline : 1 médias intégrés, 2 médias restés en ligne.',
      offlineAssetsSummary: { onlineCount: 2 },
    }));
    renderHeader({ onExportStandalone });

    fireEvent.click(screen.getByRole('checkbox', {
      name: 'Inclure les médias dans le fichier pour jouer hors ligne',
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Exporter jeu' }));

    expect((await screen.findByRole('status')).textContent).toBe('Export offline : 1 médias intégrés, 2 médias restés en ligne.');
    expect(screen.getByRole('alert').textContent).toContain('2 médias restent en ligne.');
  });

  test('affiche le compte connecte dans l entete RPG 3D', () => {
    render(
      <Rpg3DHeader
        user={{ id: 'user-1', name: 'Compte brut', email: 'mika@example.com' }}
        authorProfile={{ displayName: 'Mika Studio' }}
        workspaceTab="arcade"
        onPauseOrReset={noop}
        onSave={noop}
        onSelectWorkspace={noop}
        onTogglePlayMode={noop}
      />,
    );

    expect(screen.getByText('Compte connecte')).toBeTruthy();
    expect(screen.getByText('Mika Studio')).toBeTruthy();
  });
});
