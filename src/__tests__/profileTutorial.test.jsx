import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test, vi } from 'vitest';
import ProfileWorkspace from '../domains/profile/ProfileWorkspace.jsx';
import { createInitialProject } from '../shared/data/projectData';
import { BUILDER_TUTORIAL_STEPS } from '../shared/data/tutorialStepData';
import { followCreator } from '../shared/services/creatorFollows';
import { writeProfileBadgeProgress } from '../shared/services/profileBadges';
import { applyProPromotionProjectSetup } from '../shared/services/proPromotion';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSource = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');

const profileSource = () => [
  'src/domains/profile/ProfileWorkspace.jsx',
  'src/domains/profile/components/ProfileBadgesPanel.jsx',
  'src/domains/profile/components/CreateProjectPanel.jsx',
  'src/domains/profile/components/ProfileHeader.jsx',
  'src/domains/profile/components/ProfileMediaPanel.jsx',
  'src/domains/profile/components/ProfileMessagesPanel.jsx',
  'src/domains/profile/components/ProfileProPanel.jsx',
  'src/domains/profile/components/ProfileSettingsPanel.jsx',
  'src/domains/profile/components/ProjectCard.jsx',
  'src/domains/profile/components/ProjectList.jsx',
  'src/domains/profile/components/PublicationPanel.jsx',
].map(readSource).join('\n');

const extractTourSelectors = (step) => [step.selector, step.fallbackSelector, ...(step.fallbackSelectors || [])]
  .filter(Boolean)
  .map((selector) => selector.match(/\[data-tour="([^"]+)"\]/)?.[1])
  .filter(Boolean);

const makeProjectRecord = (overrides = {}) => {
  const data = createInitialProject();
  data.title = overrides.name || 'Manoir test';
  return {
    id: overrides.id || 'project-profile-tutorial',
    name: overrides.name || 'Manoir test',
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-02T10:00:00.000Z',
    ...overrides,
    data: overrides.data || data,
    shareState: {
      category: '',
      ageRating: '',
      isPublic: false,
      ...(overrides.shareState || {}),
    },
  };
};

const renderProfile = (props = {}) => render(
  <ProfileWorkspace
    user={{ id: 'user-profile-tutorial', email: 'mika@example.com' }}
    projects={[makeProjectRecord()]}
    activeProjectId="project-profile-tutorial"
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
  test('met le didacticiel en avant pour un nouveau profil sans projet', () => {
    const onStartTutorial = vi.fn();
    renderProfile({
      projects: [],
      activeProjectId: '',
      onStartTutorial,
    });

    expect(screen.getByRole('heading', { name: 'Commencer en 5 minutes' })).toBeTruthy();
    const createButton = screen.getByRole('button', { name: '+ Créer' });
    const onboardingCard = document.querySelector('.profile-onboarding-card');
    expect(onboardingCard).toBeTruthy();
    expect(createButton.nextElementSibling).toBe(onboardingCard);
    fireEvent.click(screen.getByRole('button', { name: 'Lancer le didacticiel' }));

    expect(onStartTutorial).toHaveBeenCalledWith('profile');
  });

  test('reference uniquement des data-tour presents dans la nouvelle UI profil', () => {
    const source = profileSource();
    const missing = BUILDER_TUTORIAL_STEPS
      .filter((step) => (step.tutorial || step.tab) === 'profile')
      .flatMap(extractTourSelectors)
      .filter((tour) => !source.includes(`data-tour="${tour}"`));

    expect(missing).toEqual([]);
  });

  test('couvre les onglets badges et pro du profil', () => {
    const profileTours = BUILDER_TUTORIAL_STEPS
      .filter((step) => (step.tutorial || step.tab) === 'profile')
      .flatMap(extractTourSelectors);

    expect(profileTours).toEqual(expect.arrayContaining([
      'profile-tab-badges',
      'profile-badges-section',
      'profile-badge-summary',
      'profile-badge-grid',
      'profile-tab-pro',
      'profile-pro-section',
      'profile-pro-actions',
      'profile-pro-manager',
    ]));
  });

  test('masque les etapes pro du didacticiel pour un compte standard', () => {
    const standardTours = BUILDER_TUTORIAL_STEPS
      .filter((step) => (step.tutorial || step.tab) === 'profile' && !step.requiresProAccount)
      .flatMap(extractTourSelectors);
    const proTours = BUILDER_TUTORIAL_STEPS
      .filter((step) => (step.tutorial || step.tab) === 'profile')
      .flatMap(extractTourSelectors);

    expect(standardTours).not.toEqual(expect.arrayContaining([
      'profile-tab-pro',
      'profile-pro-section',
      'profile-pro-actions',
      'profile-pro-manager',
    ]));
    expect(proTours).toEqual(expect.arrayContaining([
      'profile-tab-pro',
      'profile-pro-section',
      'profile-pro-actions',
      'profile-pro-manager',
    ]));
  });

  test('affiche les panneaux attendus depuis les onglets internes du profil', () => {
    renderProfile();

    expect(screen.getByRole('heading', { name: 'Créer un escape game en scènes' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Projets' }));
    expect(screen.getByRole('heading', { name: 'Gestion des projets' })).toBeTruthy();
    expect(screen.getAllByText('Manoir test').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Tester' })[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Badges' }));
    expect(screen.getByRole('heading', { name: 'Badges créateur' })).toBeTruthy();
    expect(screen.getByText('Projets créés')).toBeTruthy();
    expect(screen.getByLabelText('Progression Parties jouées: 1/5 parties vers Argent')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Médias' }));
    expect(screen.getByRole('heading', { name: 'Médiathèque' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Publication' }));
    expect(screen.getByRole('heading', { name: 'Publication' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Messagerie' }));
    expect(screen.getByRole('heading', { name: 'Messages support' })).toBeTruthy();

    fireEvent.click(document.querySelector('[data-tour="profile-tab-settings"]'));
    expect(screen.getByRole('heading', { name: 'Profil et sécurité' })).toBeTruthy();
  }, 10000);

  test('filtre les templates selon le mode de creation choisi', () => {
    const onCreateProject = vi.fn();
    renderProfile({ onCreateProject });
    const getTemplateText = () => document.querySelector('[data-tour="profile-template-picker"]')?.textContent || '';

    expect(getTemplateText()).toContain('Projet vide');
    expect(getTemplateText()).toContain('Manoir hanté');
    expect(getTemplateText()).not.toContain('Aventure de héros');
    expect(getTemplateText()).not.toContain('Narration choix multiples');

    fireEvent.click(screen.getByRole('button', { name: 'Narration choix multiples' }));
    expect(getTemplateText()).toContain('Narration choix multiples');
    expect(getTemplateText()).toContain('Enquête narrative');
    expect(getTemplateText()).not.toContain('Aventure de héros');
    expect(getTemplateText()).not.toContain('Manoir hanté');

    fireEvent.click(Array.from(document.querySelectorAll('[data-tour="profile-template-picker"] button'))
      .find((button) => button.textContent === 'Narration choix multiples'));
    fireEvent.click(screen.getByRole('button', { name: '+ Créer' }));
    expect(onCreateProject).toHaveBeenLastCalledWith('Narration choix multiples', 'adventure_choices', 'adventure', {});

    fireEvent.click(screen.getByRole('button', { name: 'Aventure de héros' }));
    expect(getTemplateText()).toContain('Livre dont vous êtes le héros');
    expect(getTemplateText()).toContain('Aventure de héros');
    expect(getTemplateText()).not.toContain('Enquête policière');
  });

  test('ordonne les onglets profil par priorite', () => {
    renderProfile({
      user: { id: 'user-profile-pro', email: 'pro@example.com', accountType: 'pro' },
    });

    const labels = Array.from(document.querySelectorAll('.profile-section-tab-list > button'))
      .map((button) => button.textContent.trim());

    expect(labels).toEqual([
      'Nouveau projet',
      'Projets',
      'Publication',
      'Médias',
      'Messagerie',
      'Profil',
      'Badges',
      'Pro',
    ]);
  });

  test('affiche les paliers de badges bronze argent or platine', () => {
    renderProfile({
      projects: [1, 2, 3].map((index) => makeProjectRecord({
        id: `project-published-${index}`,
        name: `Jeu publié ${index}`,
        shareState: { isPublic: true, publishedAt: `2026-01-0${index}T10:00:00.000Z` },
      })),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Badges' }));

    expect(screen.getByText('Jeux publiés')).toBeTruthy();
    expect(screen.getByLabelText('Progression Jeux publiés: 3/10 jeux publiés vers Or')).toBeTruthy();
    expect(screen.getAllByText('Argent').length).toBeGreaterThan(0);
    expect(screen.getAllByText('10').length).toBeGreaterThan(0);
  });

  test('dedoublonne les medias importes dans les badges comme dans la mediatheque', () => {
    const data = createInitialProject();
    data.assets = [
      {
        id: 'project-shared-image',
        type: 'image',
        url: 'https://cdn.example.test/shared-image.png',
        name: 'shared-image.png',
      },
      {
        id: 'project-sound',
        type: 'audio',
        url: 'https://cdn.example.test/sound.mp3',
        name: 'sound.mp3',
      },
    ];

    renderProfile({
      projects: [makeProjectRecord({ data })],
      mediaLibrary: [
        {
          id: 'library-shared-image',
          type: 'image',
          url: 'https://cdn.example.test/shared-image.png',
          name: 'shared-image-copy.png',
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Badges' }));

    expect(screen.getByLabelText('Progression Médias importés: 2/10 médias vers Argent')).toBeTruthy();
  });

  test('ajoute un badge a paliers pour le nombre de followers', () => {
    followCreator('follower-1', 'user-profile-tutorial', '2026-01-01T00:00:00.000Z');
    followCreator('follower-2', 'user-profile-tutorial', '2026-01-02T00:00:00.000Z');

    renderProfile();

    fireEvent.click(screen.getByRole('button', { name: 'Badges' }));

    expect(screen.getByText('Followers')).toBeTruthy();
    expect(screen.getByLabelText('Progression Followers: 2/10 followers vers Argent')).toBeTruthy();
  });

  test('ajoute un badge a paliers pour la note de bilan', () => {
    renderProfile();

    fireEvent.click(screen.getByRole('button', { name: 'Badges' }));

    expect(screen.getByText('Note de bilan')).toBeTruthy();
    expect(screen.getByLabelText(/Progression Note de bilan:/)).toBeTruthy();
    expect(screen.getAllByText('8,5').length).toBeGreaterThan(0);
  });

  test('affiche un message quand un niveau de badge est debloque', () => {
    const data = {
      title: 'Mini test',
      acts: [],
      scenes: [],
      items: [],
      enigmas: [],
      cinematics: [],
      routeMap: {},
    };
    writeProfileBadgeProgress('user-profile-tutorial', {
      'projects-created': 1,
      'played-games': 0,
    });

    renderProfile({
      projects: [makeProjectRecord({ data })],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Projets' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Tester' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Badges' }));

    const announcement = screen.getByRole('status');
    expect(announcement.className).toContain('level-bronze');
    expect(announcement.textContent).toContain('Badge obtenu');
    expect(announcement.textContent).toContain('Parties jouées - Bronze');
  });

  test('adapte le message de badge aux niveaux argent or et platine', () => {
    const data = {
      title: 'Mini test',
      acts: [],
      scenes: [],
      items: [],
      enigmas: [],
      cinematics: [],
      routeMap: {},
    };

    const cases = [
      {
        projectCount: 3,
        previousProjectLevelCount: 1,
        levelClass: 'level-silver',
        title: 'Nouveau niveau atteint',
        summary: 'Projets créés - Argent',
      },
      {
        projectCount: 10,
        previousProjectLevelCount: 2,
        levelClass: 'level-gold',
        title: 'Félicitations !',
        summary: 'Projets créés - Or',
      },
      {
        projectCount: 25,
        previousProjectLevelCount: 3,
        levelClass: 'level-platinum',
        title: 'Badge Platine débloqué',
        summary: 'Projets créés - Platine',
        detail: "Ton projet atteint un niveau d'excellence.",
      },
    ];

    cases.forEach((scenario, scenarioIndex) => {
      cleanup();
      localStorage.clear();
      writeProfileBadgeProgress('user-profile-tutorial', {
        'projects-created': scenario.previousProjectLevelCount,
      });

      renderProfile({
        projects: Array.from({ length: scenario.projectCount }, (_, index) => makeProjectRecord({
          id: `project-${scenarioIndex}-${index}`,
          data,
        })),
      });

      fireEvent.click(screen.getByRole('button', { name: 'Badges' }));

      const announcement = screen.getByRole('status');
      expect(announcement.className).toContain(scenario.levelClass);
      expect(announcement.textContent).toContain(scenario.title);
      expect(announcement.textContent).toContain(scenario.summary);
      if (scenario.detail) {
        expect(announcement.textContent).toContain(scenario.detail);
      }
    });
  });

  test('reserve l onglet pro aux comptes pro', () => {
    renderProfile();
    expect(screen.queryByRole('button', { name: 'Pro' })).toBeNull();

    cleanup();
    const onStartProPromotion = vi.fn();
    renderProfile({
      user: { id: 'user-profile-pro', email: 'pro@example.com', accountType: 'pro' },
      onStartProPromotion,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Pro' }));
    expect(screen.getByRole('heading', { name: 'Extensions d’expérience' })).toBeTruthy();
    expect(screen.getByText(/Une salle ne crée pas seulement un jeu/)).toBeTruthy();
    expect(screen.getAllByText('Vitrine').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Prologue / Épilogue').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Créer un prologue \/ épilogue|Créer une vitrine/ })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Créer un prologue' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Créer un épilogue' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Créer un prologue / épilogue' }));
    expect(onStartProPromotion).toHaveBeenCalledWith({
      kind: 'story',
      title: 'Prologue / Épilogue',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Créer une vitrine' }));
    expect(onStartProPromotion).toHaveBeenLastCalledWith({
      kind: 'showcase',
      title: 'Vitrine',
    });
  });

  test('gere les extensions existantes depuis l onglet pro', () => {
    const extensionData = applyProPromotionProjectSetup(createInitialProject(), 'extend');
    extensionData.title = 'Épilogue VIP';

    const onOpenProject = vi.fn();
    const onTestProject = vi.fn();
    const onCopyProjectLink = vi.fn();
    const onSaveProjectQrCode = vi.fn();
    const onPublishProject = vi.fn();
    const onDuplicateProject = vi.fn();
    const onDeleteProject = vi.fn();

    renderProfile({
      user: { id: 'user-profile-pro', email: 'pro@example.com', accountType: 'pro' },
      projects: [
        makeProjectRecord({ id: 'regular-project', name: 'Jeu principal' }),
        makeProjectRecord({
          id: 'extension-pro',
          name: 'Épilogue VIP',
          data: extensionData,
          shareState: {
            category: 'Aventure',
            ageRating: 'Tout public',
            isPublic: false,
          },
        }),
      ],
      onOpenProject,
      onTestProject,
      onCopyProjectLink,
      onSaveProjectQrCode,
      onPublishProject,
      onDuplicateProject,
      onDeleteProject,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Pro' }));

    expect(screen.getByRole('heading', { name: 'Gérer les extensions' })).toBeTruthy();
    expect(screen.getByText('Épilogue VIP')).toBeTruthy();
    expect(screen.queryByText('Jeu principal')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Éditer' }));
    expect(onOpenProject).toHaveBeenCalledWith('extension-pro', { tab: 'scenes' });

    fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }));
    expect(onTestProject).toHaveBeenCalledWith('extension-pro');

    fireEvent.click(screen.getByRole('button', { name: 'Copier le lien' }));
    expect(onCopyProjectLink).toHaveBeenCalledWith('extension-pro');

    fireEvent.click(screen.getByRole('button', { name: 'QR code' }));
    expect(onSaveProjectQrCode).toHaveBeenCalledWith('extension-pro');

    fireEvent.click(screen.getByRole('button', { name: 'Publier' }));
    expect(onPublishProject).toHaveBeenCalledWith('extension-pro');

    fireEvent.click(screen.getByRole('button', { name: 'Dupliquer' }));
    expect(onDuplicateProject).toHaveBeenCalledWith('extension-pro');

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(onDeleteProject).toHaveBeenCalledWith('extension-pro', 'Épilogue VIP');
  });

  test('affiche les projets pro uniquement dans l onglet pro du profil', () => {
    const extensionData = applyProPromotionProjectSetup(createInitialProject(), 'promote');
    extensionData.title = 'Prologue client';

    renderProfile({
      user: { id: 'user-profile-pro', email: 'pro@example.com', accountType: 'pro' },
      projects: [
        makeProjectRecord({ id: 'regular-project', name: 'Jeu principal' }),
        makeProjectRecord({
          id: 'extension-pro',
          name: 'Prologue client',
          data: extensionData,
        }),
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Projets' }));
    expect(screen.getByRole('heading', { name: 'Gestion des projets' })).toBeTruthy();
    expect(screen.getAllByText('Jeu principal').length).toBeGreaterThan(0);
    expect(screen.queryByText('Prologue client')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Publication' }));
    expect(screen.getByRole('heading', { name: 'Publication' })).toBeTruthy();
    expect(screen.getAllByText('Jeu principal').length).toBeGreaterThan(0);
    expect(screen.queryByText('Prologue client')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Pro' }));
    expect(screen.getByRole('heading', { name: 'Gérer les extensions' })).toBeTruthy();
    expect(screen.getByText('Prologue client')).toBeTruthy();
    expect(screen.queryByText('Jeu principal')).toBeNull();
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

  test('ouvre automatiquement les nouveaux onglets badges et pro du didacticiel profil', async () => {
    renderProfile({
      isProfileTutorialActive: true,
      profileTutorialStep: { selector: '[data-tour="profile-badges-section"]' },
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Badges créateur' })).toBeTruthy();
    });
    expect(document.querySelector('[data-tour="profile-tab-badges"]').classList.contains('active')).toBe(true);

    cleanup();
    renderProfile({
      user: { id: 'user-profile-pro', email: 'pro@example.com', accountType: 'pro' },
      isProfileTutorialActive: true,
      profileTutorialStep: { selector: '[data-tour="profile-pro-manager"]' },
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Gérer les extensions' })).toBeTruthy();
    });
    expect(document.querySelector('[data-tour="profile-tab-pro"]').classList.contains('active')).toBe(true);
  });
});
