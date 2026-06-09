import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import ProfileProPanel from '../domains/profile/components/ProfileProPanel';
import { createInitialProject, normalizeProject } from '../shared/data/projectData';
import { applyProPromotionProjectSetup } from '../shared/services/proPromotion';

const makeProExtensionRecord = (overrides = {}) => {
  const data = normalizeProject(applyProPromotionProjectSetup(createInitialProject(), 'promote'));
  return {
    id: 'extension-1',
    name: 'Extension test',
    updatedAt: '2026-06-06T10:56:00.000Z',
    data,
    shareState: { isPublic: true, category: 'Enquête', ageRating: '+18 ans' },
    ...overrides,
  };
};

afterEach(() => cleanup());

describe('ProfileProPanel', () => {
  test('masque les reglages de publication sur les extensions pro mais garde le bouton publier', () => {
    const onPublishProject = vi.fn();
    const onUnpublishProject = vi.fn();
    render(<ProfileProPanel projects={[makeProExtensionRecord()]} />);

    expect(screen.getByText('Extension test')).toBeTruthy();
    expect(screen.queryByText('Catégorie')).toBeNull();
    expect(screen.queryByText("Mention d'âge")).toBeNull();
    expect(screen.queryByRole('button', { name: 'Publier' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Mettre à jour' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retirer' })).toBeTruthy();
    expect(screen.queryByText('Publié')).toBeNull();
    expect(screen.queryByText('Privé')).toBeNull();
    expect(screen.queryByRole('option', { name: 'Publiées' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Non publiées' })).toBeNull();

    cleanup();
    render(
      <ProfileProPanel
        projects={[makeProExtensionRecord()]}
        onPublishProject={onPublishProject}
        onUnpublishProject={onUnpublishProject}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mettre à jour' }));
    expect(onPublishProject).toHaveBeenCalledWith('extension-1');

    fireEvent.click(screen.getByRole('button', { name: 'Retirer' }));
    expect(onUnpublishProject).toHaveBeenCalledWith('extension-1');
  });

  test('affiche publier pour une extension pro privee', () => {
    const onPublishProject = vi.fn();
    render(
      <ProfileProPanel
        projects={[makeProExtensionRecord({ shareState: { isPublic: false } })]}
        onPublishProject={onPublishProject}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Publier' }));
    expect(onPublishProject).toHaveBeenCalledWith('extension-1');
  });

  test('ouvre les statistiques d une extension pro avec filtres et detail par zone', async () => {
    const loadProClickAnalytics = vi.fn(async () => ({
      projectId: 'extension-1',
      clicks: 14,
      clicks7d: 5,
      clicks30d: 11,
      elements: [
        {
          key: 'reserve',
          elementName: 'Réserver une session',
          actionType: 'external_link',
          clicks: 10,
          clicks7d: 4,
          clicks30d: 8,
        },
        {
          key: 'prologue',
          elementName: 'Accès prologue',
          actionType: 'project_link',
          clicks: 4,
          clicks7d: 1,
          clicks30d: 3,
        },
      ],
    }));

    render(
      <ProfileProPanel
        projects={[makeProExtensionRecord()]}
        loadProClickAnalytics={loadProClickAnalytics}
      />,
    );

    const statsButton = screen.getByRole('button', { name: 'Statistiques de Extension test' });
    expect(statsButton.textContent).toBe('');
    fireEvent.click(statsButton);

    expect(await screen.findByRole('dialog', { name: 'Extension test' })).toBeTruthy();
    expect(loadProClickAnalytics).toHaveBeenCalledWith({ projectId: 'extension-1' });
    expect(screen.getByText('Réserver une session')).toBeTruthy();
    expect(screen.getByText('Accès prologue')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '30 jours' }));
    await waitFor(() => expect(screen.getByText('11')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Total' }));
    await waitFor(() => expect(screen.getByText('14')).toBeTruthy());
  });
});
