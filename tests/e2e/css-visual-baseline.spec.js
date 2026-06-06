import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const USER_ID = 'css-baseline-user';
const PROJECT_ID = 'css-baseline-project';
const NOW = '2026-06-06T12:00:00.000Z';
const EXAMPLE_PROJECT_PATH = path.join(process.cwd(), 'docs', 'examples', 'acte-1-valombre-hero-adventure.json');

const readDotEnvValue = (key) => {
  if (process.env[key]) return process.env[key];
  try {
    const source = readFileSync(path.join(process.cwd(), '.env'), 'utf8');
    return source.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1]?.trim() || '';
  } catch {
    return '';
  }
};

const SUPABASE_URL = readDotEnvValue('VITE_SUPABASE_URL');
const SUPABASE_ORIGIN = SUPABASE_URL ? new URL(SUPABASE_URL).origin : '';
const SUPABASE_PROJECT_REF = SUPABASE_URL ? new URL(SUPABASE_URL).hostname.split('.')[0] : '';
const SUPABASE_AUTH_STORAGE_KEY = SUPABASE_PROJECT_REF ? `sb-${SUPABASE_PROJECT_REF}-auth-token` : '';

const BASELINE_USER = {
  id: USER_ID,
  name: 'Mika CSS',
  email: 'mika-css@example.test',
  accountType: 'pro',
  profileType: 'studio',
  organization: 'Mika CSS Studio',
  country: 'FR',
  language: 'fr',
  marketingConsent: false,
  acceptedTerms: true,
  acceptedTermsAt: NOW,
  role: 'user',
  roles: ['user'],
  isAdmin: false,
  provider: 'supabase',
  createdAt: NOW,
  lastLoginAt: NOW,
};

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
    tab: 'scenes',
    readySelector: '[data-tour="scene-navigation"]',
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
    id: 'public-game',
    label: 'public game page',
    url: `/?gallery=1&game=${USER_ID}:${PROJECT_ID}`,
    appScreen: 'profile',
    tab: 'scenes',
    readySelector: '.public-game-page',
  },
  {
    id: 'public-creator',
    label: 'public creator page',
    url: `/?gallery=1&creator=${USER_ID}`,
    appScreen: 'profile',
    tab: 'scenes',
    readySelector: '.public-creator-page',
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
    readySelector: '[data-tour="ai-credits"]',
  },
];

function makeSupabaseAuthUser(user = BASELINE_USER) {
  return {
    id: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email,
    email_confirmed_at: NOW,
    phone: '',
    confirmed_at: NOW,
    last_sign_in_at: NOW,
    app_metadata: {
      provider: 'email',
      providers: ['email'],
      role: user.role,
      roles: user.roles,
    },
    user_metadata: {
      name: user.name,
      accountType: user.accountType,
      profileType: user.profileType,
      organization: user.organization,
      country: user.country,
      language: user.language,
      marketingConsent: user.marketingConsent,
      acceptedTerms: user.acceptedTerms,
    },
    identities: [],
    created_at: NOW,
    updated_at: NOW,
    is_anonymous: false,
  };
}

function makeSupabaseSession(user = BASELINE_USER) {
  const expiresAt = Math.floor(new Date(NOW).getTime() / 1000) + (60 * 60 * 24);
  return {
    access_token: 'css-baseline-access-token',
    refresh_token: 'css-baseline-refresh-token',
    token_type: 'bearer',
    expires_in: 60 * 60 * 24,
    expires_at: expiresAt,
    user: makeSupabaseAuthUser(user),
  };
}

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
  const user = BASELINE_USER;
  const supabaseSession = makeSupabaseSession(user);
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

  await page.addInitScript(({ user, profile, record, view, selectedSceneId, supabaseAuthStorageKey, supabaseSession }) => {
    const projectKey = `escapeGameBuilder.projects.${user.id}`;
    const activeProjectKey = `escapeGameBuilder.activeProject.${user.id}`;
    const builderStateKey = `escapeGameBuilder.builderUiState.${user.id}.${record.id}`;
    const gameKey = `${user.id}:${record.id}`;

    window.localStorage.clear();
    window.localStorage.setItem('escape_builder_accounts_v1', JSON.stringify([user]));
    window.localStorage.setItem('escape_builder_session_v1', user.id);
    if (supabaseAuthStorageKey) {
      window.localStorage.setItem(supabaseAuthStorageKey, JSON.stringify(supabaseSession));
    }
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
  }, {
    user,
    profile,
    record,
    view,
    selectedSceneId,
    supabaseAuthStorageKey: SUPABASE_AUTH_STORAGE_KEY,
    supabaseSession,
  });
}

async function stubExternalApis(page) {
  const supabaseUser = makeSupabaseAuthUser();
  const supabaseSession = makeSupabaseSession();

  if (SUPABASE_ORIGIN) {
    await page.route(`${SUPABASE_ORIGIN}/auth/v1/user`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(supabaseUser),
      });
    });

    await page.route(`${SUPABASE_ORIGIN}/auth/v1/token**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(supabaseSession),
      });
    });

    await page.route(`${SUPABASE_ORIGIN}/storage/v1/object/**`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Baseline storage fixture not found' }),
      });
    });
  }

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

async function activateCriticalView(page, view) {
  if (view.appScreen !== 'builder' || !view.tab) return;
  const tab = page.locator(`[data-tour-tab="${view.tab}"]`).first();
  await expect(tab).toBeVisible();
  await tab.click();
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
  test.describe.configure({ mode: 'serial' });

  for (const viewport of VIEWPORTS) {
    for (const view of CRITICAL_VIEWS) {
      test(`${view.label} matches baseline at ${viewport.name}`, async ({ page }) => {
        await stubExternalApis(page);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await seedBaselineState(page, view);
        await page.goto(view.url, { waitUntil: 'domcontentloaded' });
        await activateCriticalView(page, view);
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
