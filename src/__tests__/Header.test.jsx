import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import Header from '../shared/ui/layout/Header.jsx';
import Rpg3DHeader from '../domains/rpg3d/components/Rpg3DHeader.jsx';

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
    offlineExportEstimateMessage="Export hors ligne estimé : ~7 Mo"
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

  test('affiche les statuts Supabase non synchronises comme avertissement', () => {
    renderHeader({ saveStatus: 'Supabase non synchronisé' });

    expect(screen.getByText('Supabase non synchronisé').classList.contains('warning')).toBe(true);
  });

  test('n affiche pas l option offline dans le header avant export', () => {
    renderHeader();

    expect(screen.queryByRole('checkbox', {
      name: 'Inclure les médias dans le fichier pour jouer hors ligne',
    })).toBeNull();
    expect(screen.queryByText(/Le fichier sera plus lourd/i)).toBeNull();
  });

  test('conserve l export standalone actuel quand l option offline est refusee', async () => {
    const onExportStandalone = vi.fn(async () => ({}));
    const confirmStandaloneOfflineExport = vi.fn(async () => false);
    renderHeader({ confirmStandaloneOfflineExport, onExportStandalone });

    fireEvent.click(screen.getByRole('button', { name: 'Exporter jeu' }));

    await waitFor(() => {
      expect(confirmStandaloneOfflineExport).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Exporter le jeu',
        confirmLabel: 'Inclure les médias',
        cancelLabel: 'Exporter sans inclure',
        cancelValue: false,
        dismissLabel: 'Annuler',
        dismissValue: null,
      }));
      expect(onExportStandalone).toHaveBeenCalledTimes(1);
    });
    expect(confirmStandaloneOfflineExport.mock.calls[0][0].message).toContain('Inclure les médias dans le fichier pour jouer hors ligne ?');
    expect(confirmStandaloneOfflineExport.mock.calls[0][0].message).toContain('Export hors ligne estimé : ~7 Mo');
    expect(onExportStandalone.mock.calls[0]).toEqual([]);
  });

  test('rafraichit l estimation offline au moment du clic export', async () => {
    const onExportStandalone = vi.fn(async () => ({}));
    const confirmStandaloneOfflineExport = vi.fn(async () => false);
    const getOfflineExportEstimateMessage = vi.fn(async () => 'Export hors ligne estimé : ~11 Mo');
    renderHeader({
      confirmStandaloneOfflineExport,
      getOfflineExportEstimateMessage,
      offlineExportEstimateMessage: 'Export hors ligne estimé : taille à confirmer',
      onExportStandalone,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Exporter jeu' }));

    await waitFor(() => {
      expect(getOfflineExportEstimateMessage).toHaveBeenCalledTimes(1);
      expect(confirmStandaloneOfflineExport).toHaveBeenCalledTimes(1);
    });
    expect(confirmStandaloneOfflineExport.mock.calls[0][0].message).toContain('Export hors ligne estimé : ~11 Mo');
  });

  test('annule l export standalone sans lancer de fichier', async () => {
    const onExportStandalone = vi.fn(async () => ({}));
    const confirmStandaloneOfflineExport = vi.fn(async () => null);
    renderHeader({ confirmStandaloneOfflineExport, onExportStandalone });

    fireEvent.click(screen.getByRole('button', { name: 'Exporter jeu' }));

    await waitFor(() => {
      expect(confirmStandaloneOfflineExport).toHaveBeenCalledTimes(1);
    });
    expect(onExportStandalone).not.toHaveBeenCalled();
  });

  test('transmet exportOfflineAssets quand l option offline est acceptee', async () => {
    const onExportStandalone = vi.fn(async () => ({}));
    const confirmStandaloneOfflineExport = vi.fn(async () => true);
    renderHeader({ confirmStandaloneOfflineExport, onExportStandalone });

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
    const confirmStandaloneOfflineExport = vi.fn(async () => true);
    renderHeader({ confirmStandaloneOfflineExport, onExportStandalone });

    fireEvent.click(screen.getByRole('button', { name: 'Exporter jeu' }));

    expect((await screen.findByRole('status')).textContent).toBe('Export offline : 2 médias intégrés, 0 médias restés en ligne.');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('affiche un warning non bloquant si des medias restent en ligne', async () => {
    const onExportStandalone = vi.fn(async () => ({
      offlineAssetsMessage: 'Export offline : 1 médias intégrés, 2 médias restés en ligne.',
      offlineAssetsSummary: { onlineCount: 2 },
    }));
    const confirmStandaloneOfflineExport = vi.fn(async () => true);
    renderHeader({ confirmStandaloneOfflineExport, onExportStandalone });

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

    expect(screen.getByText('Compte connecté')).toBeTruthy();
    expect(screen.getByText('Mika Studio')).toBeTruthy();
  });
});
