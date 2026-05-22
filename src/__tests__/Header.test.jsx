import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import Header from '../components/Header.jsx';
import Rpg3DHeader from '../components/rpg3d/Rpg3DHeader.jsx';

const noop = () => {};

describe('Header', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('affiche le nom utilisateur dans l entete', () => {
    render(
      <Header
        projectTitle="Projet test"
        onImportJson={noop}
        onExportStandalone={noop}
        onExportAuthorSummary={noop}
        user={{ name: 'Compte brut', email: 'mika@example.com' }}
        authorProfile={{ displayName: 'Mika Studio' }}
        onLogout={noop}
        saveStatus="Sauvegarde active"
      />,
    );

    expect(screen.getByText('Utilisateur')).toBeTruthy();
    expect(screen.getByText('Mika Studio')).toBeTruthy();
    expect(screen.getByText('mika@example.com')).toBeTruthy();
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
