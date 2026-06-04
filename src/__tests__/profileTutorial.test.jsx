import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test, vi } from 'vitest';
import ProfileWorkspace from '../domains/profile/ProfileWorkspace.jsx';
import { createInitialProject } from '../shared/data/projectData';
import { BUILDER_TUTORIAL_STEPS } from '../shared/data/tutorialStepData';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSource = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');

const profileSource = () => [
  'src/domains/profile/ProfileWorkspace.jsx',
  'src/domains/profile/components/CreateProjectPanel.jsx',
  'src/domains/profile/components/ProfileHeader.jsx',
  'src/domains/profile/components/ProfileMediaPanel.jsx',
  'src/domains/profile/components/ProfileMessagesPanel.jsx',
  'src/domains/profile/components/ProfileSettingsPanel.jsx',
  'src/domains/profile/components/ProjectCard.jsx',
  'src/domains/profile/components/ProjectList.jsx',
  'src/domains/profile/components/PublicationPanel.jsx',
].map(readSource).join('\n');

const extractTourSelectors = (step) => [step.selector, step.fallbackSelector]
  .filter(Boolean)
  .map((selector) => selector.match(/\[data-tour="([^"]+)"\]/)?.[1])
  .filter(Boolean);

const makeProjectRecord = () => {
  const data = createInitialProject();
  data.title = 'Manoir test';
  return {
    id: 'project-profile-tutorial',
    name: 'Manoir test',
    data,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-02T10:00:00.000Z',
    shareState: {
      category: '',
      ageRating: '',
      isPublic: false,
    },
  };
};

const renderProfile = (props = {}) => render(
  <ProfileWorkspace
    user={{ id: 'user-profile-tutorial', email: 'mika@example.com' }}
    projects={[makeProjectRecord()]}
    activeProjectId="project-profile-tutorial"
    statusMessage="Profil prêt"
    onCreateProject={vi.fn()}
    onOpenProject={vi.fn()}
    onTestProject={vi.fn()}
    onCopyProjectLink={vi.fn()}
    onPublishProject={vi.fn()}
    onUnpublishProject={vi.fn()}
    onUpdatePublicSettings={vi.fn()}
    onUploadGalleryThumbnail={vi.fn()}
    onOpenPublicGallery={vi.fn()}
    onStartTutorial={vi.fn()}
    onRenameProject={vi.fn()}
    onUpdateProjectMode={vi.fn()}
    onDuplicateProject={vi.fn()}
    onDeleteProject={vi.fn()}
    onDeleteMedia={vi.fn()}
    onImportProject={vi.fn()}
    onImportMediaFile={vi.fn()}
    onUpdateAuthorProfile={vi.fn()}
    onUpdatePassword={vi.fn()}
    onRefreshStorageUsage={vi.fn(async () => 0)}
    storageSummary={{ usedLabel: '0 Mo', quotaLabel: '100 Mo', isExact: true }}
    aiCreditBalance={100}
    onBuyStorage={vi.fn()}
    onLogout={vi.fn()}
    {...props}
  />,
);

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('didacticiel profil', () => {
  test('reference uniquement des data-tour presents dans la nouvelle UI profil', () => {
    const source = profileSource();
    const missing = BUILDER_TUTORIAL_STEPS
      .filter((step) => (step.tutorial || step.tab) === 'profile')
      .flatMap(extractTourSelectors)
      .filter((tour) => !source.includes(`data-tour="${tour}"`));

    expect(missing).toEqual([]);
  });

  test('affiche les panneaux attendus depuis les onglets internes du profil', () => {
    renderProfile();

    expect(screen.getByRole('heading', { name: 'Créer un escape game en scènes' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Projets' }));
    expect(screen.getByRole('heading', { name: 'Gestion des projets' })).toBeTruthy();
    expect(screen.getAllByText('Manoir test').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Médias' }));
    expect(screen.getByRole('heading', { name: 'Médiathèque' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Publication' }));
    expect(screen.getByRole('heading', { name: 'Publication' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Messagerie' }));
    expect(screen.getByRole('heading', { name: 'Messages support' })).toBeTruthy();

    fireEvent.click(document.querySelector('[data-tour="profile-tab-settings"]'));
    expect(screen.getByRole('heading', { name: 'Profil et sécurité' })).toBeTruthy();
  });

  test('ouvre automatiquement l onglet requis par une étape de didacticiel profil', async () => {
    renderProfile({
      isProfileTutorialActive: true,
      profileTutorialStep: { selector: '[data-tour="profile-projects-section"]' },
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Gestion des projets' })).toBeTruthy();
    });
    expect(document.querySelector('[data-tour="profile-tab-projects"]').classList.contains('active')).toBe(true);
  });
});
