import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const USER_ID = 'css-baseline-user';
const PROJECT_ID = 'css-baseline-project';
const NOW = '2026-06-06T12:00:00.000Z';
const EXAMPLE_PROJECT_PATH = path.join(process.cwd(), 'docs', 'examples', 'acte-1-valombre-hero-adventure.json');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile-portrait', width: 390, height: 844 },
  { name: 'mobile-landscape', width: 844, height: 390 },
];

const CRITICAL_VIEWS = [
  {
    id: 'builder',
    label: 'builder shell',
    url: '/',
    appScreen: 'builder',
    tab: 'objects',
    readySelector: '[data-tour="inventory"]',
  },
  {
    id: 'scene',
    label: 'scene editor',
    url: '/',
    appScreen: 'builder',
    tab: 'scenes',
    readySelector: '[data-tour="scene-canvas"]',
  },
  {
    id: 'preview-player',
    label: 'preview player',
    url: `/?playUser=${USER_ID}&playProject=${PROJECT_ID}`,
    appScreen: 'profile',
    tab: 'preview',
    readySelector: '.player-shell',
  },
  {
    id: 'gallery',
    label: 'public gallery',
    url: '/?gallery=1',
    appScreen: 'profile',
    tab: 'scenes',
    readySelector: '.public-gallery-shell',
  },
  {
    id: 'profile',
    label: 'profile workspace',
    url: '/',
    appScreen: 'profile',
    tab: 'scenes',
    readySelector: '[data-tour="profile-header"]',
  },
  {
    id: 'ai',
    label: 'AI workspace',
    url: '/',
    appScreen: 'builder',
    tab: 'ai',
    readySelector: '[data-tour="ai-controls"]',
  },
];

function loadBaselineProject() {
  const project = JSON.parse(readFileSync(EXAMPLE_PROJECT_PATH, 'utf8'));
  return {
    ...project,
    title: 'CSS Baseline - Valombre',
    aiDraft: {
      status: 'Brouillon IA restaure pour baseline CSS',
      generatedProject: null,
      isPatch: false,
      updatedAt: NOW,
    },
  };
}

async function seedBaselineState(page, view) {
  const project = loadBaselineProject();
  const selectedSceneId = project.scenes?.[0]?.id || '';
  const user = {
    id: USER_ID,
    name: 'Mika CSS',
    email: 'mika-css@example.test',
    accountType: 'professional',
    role: 'user',
    roles: ['user'],
    createdAt: NOW,
    lastLoginAt: NOW,
  };
  const profile = {
    displayName: 'Mika CSS Studio',
    tagline: 'Auteur de jeux immersifs',
    bio: 'Baseline CSS publique avec galerie, profil createur et vues builder.',
    website: 'https://example.test',
    avatar: '',
    banner: '/assets/gallery/public-gallery-banner.png',
    socialLinks: [{ type: 'site', url: 'https://example.test' }],
    blogPosts: [{
      id: 'baseline-news',
      title: 'Nouvelle scene publiee',
      body: 'Une actualite courte stabilise la carte createur pour la baseline visuelle.',
      likes: 3,
      likedBy: [],
      createdAt: NOW,
      updatedAt: NOW,
    }],
    theme: {
      pageBackground: '#08101d',
      panelBackground: '#0f172a',
      accentColor: '#60a5fa',
      textColor: '#f8fafc',
      mutedTextColor: '#cbd5e1',
    },
    updatedAt: NOW,
  };
  const record = {
    id: PROJECT_ID,
    name: project.title,
    thumbnail: '/assets/gallery/public-gallery-banner.png',
    uiState: { tab: view.tab, selectedSceneId },
    shareState: {
      isPublic: true,
      copiedAt: NOW,
      publishedAt: NOW,
      publishedName: project.title,
      publishedData: project,
      publishedThumbnail: '/assets/gallery/public-gallery-banner.png',
      durationMinutes: 45,
      difficulty: 'intermediaire',
      category: 'Fantastique',
      ageRating: 'Tout public',
    },
    createdAt: NOW,
    updatedAt: NOW,
    data: project,
  };

  await page.addInitScript(({ user, profile, record, view, selectedSceneId }) => {
    const projectKey = `escapeGameBuilder.projects.${user.id}`;
    const activeProjectKey = `escapeGameBuilder.activeProject.${user.id}`;
    const builderStateKey = `escapeGameBuilder.builderUiState.${user.id}.${record.id}`;
    const gameKey = `${user.id}:${record.id}`;

    window.localStorage.clear();
    window.localStorage.setItem('escape_builder_accounts_v1', JSON.stringify([user]));
    window.localStorage.setItem('escape_builder_session_v1', user.id);
    window.localStorage.setItem(projectKey, JSON.stringify([record]));
    window.localStorage.setItem(activeProjectKey, record.id);
    window.localStorage.setItem('escapeGameBuilder.authorProfiles.v1', JSON.stringify({ [user.id]: profile }));
    window.localStorage.setItem('escapeGameBuilder.profileTutorialSeen.css-baseline-user', '1');
    window.localStorage.setItem('escapeGameBuilder.publicVisitorId', 'css-baseline-visitor');
    window.localStorage.setItem('escapeGameBuilder.publicStats.v1', JSON.stringify({
      [gameKey]: {
        plays: 12,
        completions: 4,
        recentPlays: [
          '2026-06-06T09:00:00.000Z',
          '2026-06-06T10:00:00.000Z',
          '2026-06-05T18:00:00.000Z',
        ],
      },
    }));
    window.localStorage.setItem('escapeGameBuilder.publicFeedback.v1', JSON.stringify({
      [gameKey]: {
        ratings: [
          { userId: 'visitor-a', gameKey, rating: 5, createdAt: '2026-06-05T10:00:00.000Z' },
          { userId: 'visitor-b', gameKey, rating: 4, createdAt: '2026-06-05T11:00:00.000Z' },
        ],
        comments: [{
          id: 'comment-baseline',
          userId: 'visitor-a',
          authorName: 'Joueur QA',
          text: 'Une aventure lisible et stable sur mobile.',
          createdAt: '2026-06-05T12:00:00.000Z',
        }],
      },
    }));
    window.localStorage.setItem('escapeGameBuilder.appUiState.v1', JSON.stringify({
      screen: view.appScreen,
      builderScreen: 'editor',
      projectId: record.id,
      selectedSceneId,
      tab: view.tab,
      userId: user.id,
      updatedAt: '2026-06-06T12:00:00.000Z',
    }));
    window.localStorage.setItem(builderStateKey, JSON.stringify({
      screen: 'editor',
      selectedSceneId,
      tab: view.tab,
      scrollByTab: {},
      updatedAt: '2026-06-06T12:00:00.000Z',
    }));
  }, { user, profile, record, view, selectedSceneId });
}

async function stubExternalApis(page) {
  await page.route('**/api/ai-credits', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        balance: 42,
        costs: { text: 2, image: 5, objectImageBatchSize: 1 },
        nextObjectImageCost: 3,
        objectImagesInCurrentBatch: 0,
        objectImageBatchSize: 1,
      }),
    });
  });
}

async function waitForVisualReady(page, view) {
  await expect(page.locator(view.readySelector)).toBeVisible();
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(350);
}

async function assertNoDocumentHorizontalScroll(page) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body?.scrollWidth || 0,
  }));

  expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 2);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 2);
}

test.describe('CSS visual baseline', () => {
  for (const viewport of VIEWPORTS) {
    for (const view of CRITICAL_VIEWS) {
      test(`${view.label} matches baseline at ${viewport.name}`, async ({ page }) => {
        await stubExternalApis(page);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await seedBaselineState(page, view);
        await page.goto(view.url, { waitUntil: 'domcontentloaded' });
        await waitForVisualReady(page, view);
        await assertNoDocumentHorizontalScroll(page);

        await expect(page).toHaveScreenshot(`${view.id}-${viewport.name}.png`, {
          animations: 'disabled',
          caret: 'hide',
          maxDiffPixelRatio: 0.03,
          threshold: 0.25,
        });
      });
    }
  }
});
