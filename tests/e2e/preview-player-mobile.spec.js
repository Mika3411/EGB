import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const QA_USER_ID = 'preview-mobile-user';
const QA_PROJECT_ID = 'preview-mobile-project';
const SCREENSHOT_DIR = path.join(process.cwd(), 'docs', 'qa', 'screenshots');
const THOREZ_PROMOTION_PROJECT_PATH = path.join(process.cwd(), 'docs', 'examples', 'thorez-mickael-enseigne-promotion.json');

const makeSvgDataUrl = ({ width = 1600, height = 1000, label = 'Preview Mobile QA' } = {}) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#123047"/>
          <stop offset="0.48" stop-color="#24435a"/>
          <stop offset="1" stop-color="#111827"/>
        </linearGradient>
        <pattern id="grid" width="160" height="160" patternUnits="userSpaceOnUse">
          <path d="M160 0H0v160" fill="none" stroke="#93c5fd" stroke-opacity="0.16" stroke-width="4"/>
        </pattern>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)"/>
      <rect width="${width}" height="${height}" fill="url(#grid)"/>
      <rect x="72" y="96" width="320" height="760" rx="28" fill="#0f172a" fill-opacity="0.72" stroke="#67e8f9" stroke-opacity="0.5" stroke-width="8"/>
      <rect x="1200" y="120" width="300" height="700" rx="28" fill="#311827" fill-opacity="0.72" stroke="#fbbf24" stroke-opacity="0.52" stroke-width="8"/>
      <circle cx="800" cy="500" r="180" fill="#14b8a6" fill-opacity="0.28" stroke="#ccfbf1" stroke-opacity="0.48" stroke-width="10"/>
      <text x="800" y="514" text-anchor="middle" fill="#f8fafc" font-family="Arial" font-size="72" font-weight="800">${label}</text>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const createPreviewProject = ({ startWithCinematic = false } = {}) => {
  const backgroundData = makeSvgDataUrl();
  const itemImageData = makeSvgDataUrl({ width: 512, height: 512, label: 'Objet' });
  const cinematicImageData = makeSvgDataUrl({ width: 1600, height: 900, label: 'Cinematique' });

  return {
    title: 'Preview mobile QA',
    creationMode: 'beginner',
    ui: {
      buttonStyle: 'modern',
      buttonFont: 'system',
      narrationFont: 'system',
      narrationBackground: 'rgba(2, 6, 23, .76)',
    },
    acts: [{ id: 'act-mobile', name: 'Acte mobile' }],
    start: {
      type: startWithCinematic ? 'cinematic' : 'scene',
      targetSceneId: 'scene-mobile',
      targetCinematicId: startWithCinematic ? 'cin-mobile' : '',
    },
    items: [{ id: 'note', name: 'Note mobile', icon: 'N', imageData: itemImageData, imageName: 'note.svg' }],
    combinations: [],
    scenes: [{
      id: 'scene-mobile',
      name: 'Couloir mobile',
      actId: 'act-mobile',
      parentSceneId: '',
      backgroundData,
      backgroundName: 'mobile-qa.svg',
      backgroundAspectRatio: 1.6,
      visualEffect: 'none',
      visualEffectIntensity: 'normal',
      visualEffectZones: [],
      musicData: '',
      ambientSoundData: '',
      introText: 'Le texte de narration est volontairement long pour valider le layout mobile du preview. Les actions doivent rester visibles, le tiroir doit rester accessible, et la scene doit pouvoir defiler quand elle depasse le viewport.',
      hotspots: [{
        id: 'left-door',
        name: 'Porte gauche',
        x: 12,
        y: 58,
        width: 16,
        height: 22,
        actionType: 'dialogue',
        dialogue: 'La porte gauche repond au toucher.',
        objectImageData: '',
        objectImageName: '',
      }, {
        id: 'right-door',
        name: 'Porte droite',
        x: 88,
        y: 56,
        width: 16,
        height: 22,
        actionType: 'dialogue_item',
        dialogue: 'Tu trouves une note.',
        rewardItemId: 'note',
        objectImageData: '',
        objectImageName: '',
      }],
      sceneObjects: [{
        id: 'central-note',
        name: 'Indice central',
        blockType: 'text',
        blockText: 'Indice mobile lisible',
        x: 50,
        y: 30,
        width: 28,
        height: 12,
        interactionMode: 'popup',
        dialogue: 'Cet indice reste lisible sans chevauchement.',
      }, {
        id: 'bottom-button',
        name: 'Bouton bas',
        blockType: 'button',
        buttonLabel: 'Bouton accessible',
        x: 50,
        y: 84,
        width: 24,
        height: 10,
        interactionMode: 'popup',
        dialogue: 'Le bas de scene reste accessible par defilement.',
      }],
    }],
    enigmas: [],
    cinematics: [{
      id: 'cin-mobile',
      name: 'Cinematique mobile',
      cinematicType: 'slides',
      slides: [{
        id: 'slide-mobile',
        imageData: cinematicImageData,
        imageName: 'cinematique.svg',
        narration: 'Une bonne douche, ca fait toujours du bien. Le texte reste dans sa zone et les boutons de navigation restent utilisables en paysage court.',
      }],
      steps: [],
      onEndType: 'none',
    }],
    assets: [],
    storyVariables: [],
    heroAdventure: { enabled: false },
  };
};

async function openSharedPreview(page, viewport, options = {}) {
  const project = options.project
    ? JSON.parse(JSON.stringify(options.project))
    : createPreviewProject(options);
  await page.setViewportSize(viewport);
  await page.addInitScript(({ userId, projectId, seededProject }) => {
    const now = '2026-06-06T00:00:00.000Z';
    const record = {
      id: projectId,
      name: seededProject.title,
      createdAt: now,
      updatedAt: now,
      data: seededProject,
      shareState: {
        isPublic: true,
        publishedAt: now,
        copiedAt: now,
        publishedName: seededProject.title,
        publishedData: seededProject,
      },
    };
    window.localStorage.setItem(`escapeGameBuilder.projects.${userId}`, JSON.stringify([record]));
  }, { userId: QA_USER_ID, projectId: QA_PROJECT_ID, seededProject: project });

  await page.goto(`/?playUser=${QA_USER_ID}&playProject=${QA_PROJECT_ID}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.player-shell.is-shared-player')).toBeVisible();
  await expect(page.locator('.scene-player')).toBeVisible();
}

function loadThorezPromotionProject() {
  return JSON.parse(readFileSync(THOREZ_PROMOTION_PROJECT_PATH, 'utf8'));
}

async function getLayoutMetrics(page) {
  return page.evaluate(() => {
    const toRect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const overlap = (a, b) => Boolean(a && b
      && a.left < b.right
      && a.right > b.left
      && a.top < b.bottom
      && a.bottom > b.top);
    const viewport = document.querySelector('[data-testid="preview-stage-viewport"]');
    return {
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      shell: toRect('.player-shell'),
      orientationGate: toRect('.player-mobile-orientation-gate'),
      topbar: toRect('.player-topbar'),
      stageViewport: {
        ...toRect('[data-testid="preview-stage-viewport"]'),
        clientWidth: viewport?.clientWidth || 0,
        clientHeight: viewport?.clientHeight || 0,
        scrollWidth: viewport?.scrollWidth || 0,
        scrollHeight: viewport?.scrollHeight || 0,
      },
      scene: toRect('.scene-player'),
      narration: toRect('.player-narration-bar'),
      narrationText: toRect('.player-narration-bar p'),
      narrationButton: toRect('.narration-discreet-button'),
      drawerActions: toRect('.player-drawer-actions'),
      inventoryButton: toRect('.inventory-discreet-button'),
      builderCredit: toRect('.player-builder-credit'),
      overlaps: {
        topbarNarration: overlap(toRect('.player-topbar'), toRect('.player-narration-bar')),
        narrationTextActions: overlap(toRect('.player-narration-bar p'), toRect('.player-drawer-actions')),
        narrationCredit: overlap(toRect('.player-narration-bar'), toRect('.player-builder-credit')),
      },
    };
  });
}

async function getCinematicLayoutMetrics(page) {
  return page.evaluate(() => {
    const toRect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const overlap = (a, b) => Boolean(a && b
      && a.left < b.right
      && a.right > b.left
      && a.top < b.bottom
      && a.bottom > b.top);
    const media = toRect('.preview-cinematic-card .overlay-media, .preview-cinematic-card .anime2d-player');
    const narration = toRect('.preview-cinematic-card > .narration');
    const actions = toRect('.preview-cinematic-card > .panel-head');
    return {
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      overlay: toRect('[data-testid="preview-cinematic-overlay"]'),
      card: toRect('.preview-cinematic-card'),
      media,
      narration,
      actions,
      overlaps: {
        mediaNarration: overlap(media, narration),
        mediaActions: overlap(media, actions),
        narrationActions: overlap(narration, actions),
      },
    };
  });
}

async function getThorezPromotionLayoutMetrics(page) {
  return page.evaluate(() => {
    const toRect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const overlap = (a, b) => Boolean(a && b
      && a.left < b.right
      && a.right > b.left
      && a.top < b.bottom
      && a.bottom > b.top);
    const ctaSelectors = [
      '[data-scene-object-id="cta_reservation"]',
      '[data-scene-object-id="cta_map"]',
      '[data-scene-object-id="cta_projects"]',
    ];
    const ctas = ctaSelectors.map(toRect);
    const blockers = [
      toRect('.player-narration-bar:not(.is-collapsed) p'),
      toRect('.narration-discreet-button'),
      toRect('.player-drawer-actions'),
      toRect('.inventory-discreet-button'),
      toRect('.player-builder-credit'),
    ].filter(Boolean);
    const viewport = document.querySelector('[data-testid="preview-stage-viewport"]');
    return {
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      shell: toRect('.player-shell'),
      stageViewport: {
        ...toRect('[data-testid="preview-stage-viewport"]'),
        clientWidth: viewport?.clientWidth || 0,
        clientHeight: viewport?.clientHeight || 0,
        scrollWidth: viewport?.scrollWidth || 0,
        scrollHeight: viewport?.scrollHeight || 0,
        scrollLeft: viewport?.scrollLeft || 0,
      },
      scene: toRect('.scene-player'),
      narrationButton: toRect('.narration-discreet-button'),
      inventoryButton: toRect('.inventory-discreet-button'),
      builderCredit: toRect('.player-builder-credit'),
      ctas,
      ctaOverlapsHud: ctas.map((cta) => blockers.some((blocker) => overlap(cta, blocker))),
    };
  });
}

async function getMobileControlsMetrics(page) {
  return page.evaluate(() => {
    const toRect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const isVisible = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || 1) > 0.05
        && rect.width > 1
        && rect.height > 1;
    };
    const overlap = (a, b) => Boolean(a && b
      && a.left < b.right
      && a.right > b.left
      && a.top < b.bottom
      && a.bottom > b.top);
    const visibleTopbarButtons = Array.from(document.querySelectorAll('.player-topbar button'))
      .filter(isVisible)
      .map((button) => button.textContent.replace(/\s+/g, ' ').trim());
    const menuButtons = Array.from(document.querySelectorAll('.player-mobile-action-menu button'))
      .filter(isVisible)
      .map((button) => button.textContent.replace(/\s+/g, ' ').trim());
    const topbar = toRect('.player-topbar');
    const stageViewport = toRect('[data-testid="preview-stage-viewport"]');
    return {
      topbar,
      stageViewport,
      mobileActions: toRect('.player-mobile-actions'),
      desktopActions: toRect('.player-actions-desktop'),
      mobileActionsVisible: isVisible(document.querySelector('.player-mobile-actions')),
      desktopActionsVisible: isVisible(document.querySelector('.player-actions-desktop')),
      menu: toRect('.player-mobile-action-menu'),
      menuExpanded: document.querySelector('.player-mobile-more-button')?.getAttribute('aria-expanded') || '',
      visibleTopbarButtons,
      menuButtons,
      topbarOverlapsStage: overlap(topbar, stageViewport),
      topbarEndsBeforeStage: Boolean(topbar && stageViewport && topbar.bottom <= stageViewport.top + 1),
    };
  });
}

function expectRectInsideViewport(rect, width, height) {
  expect(rect.left).toBeGreaterThanOrEqual(0);
  expect(rect.top).toBeGreaterThanOrEqual(0);
  expect(rect.right).toBeLessThanOrEqual(width);
  expect(rect.bottom).toBeLessThanOrEqual(height);
}

function expectRectInSideGutter(rect, sceneRect) {
  expect(Boolean(rect.right <= sceneRect.left || rect.left >= sceneRect.right)).toBe(true);
}

test.describe('Preview player mobile layout', () => {
  test('mobile preview exposes compact controls without covering the scene', async ({ page }) => {
    await openSharedPreview(page, { width: 390, height: 844 });
    await expect(page.locator('.player-mobile-orientation-gate')).toBeVisible();
    await page.getByRole('button', { name: 'Continuer en portrait' }).click();
    await expect(page.locator('.player-mobile-orientation-gate')).not.toBeVisible();

    let portraitControls = await getMobileControlsMetrics(page);
    expect(portraitControls.visibleTopbarButtons).toEqual(['Pause', 'Plus']);
    expect(portraitControls.menuButtons).toEqual([]);
    expect(portraitControls.menuExpanded).toBe('false');
    expect(portraitControls.mobileActionsVisible).toBe(true);
    expect(portraitControls.desktopActionsVisible).toBe(false);
    expect(portraitControls.topbar.height).toBeLessThanOrEqual(64);
    expect(portraitControls.topbarOverlapsStage).toBe(false);
    expect(portraitControls.topbarEndsBeforeStage).toBe(true);

    await page.getByRole('button', { name: 'Actions du player' }).click();
    portraitControls = await getMobileControlsMetrics(page);
    expect(portraitControls.menuExpanded).toBe('true');
    expect(portraitControls.menuButtons).toEqual([
      'Recommencer',
      'Sauvegarder',
      'Charger',
      'Sans aide',
      'Plein écran',
    ]);
    expect(portraitControls.topbarOverlapsStage).toBe(false);
    expect(portraitControls.topbarEndsBeforeStage).toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.locator('.player-mobile-action-menu')).not.toBeVisible();
    portraitControls = await getMobileControlsMetrics(page);
    expect(portraitControls.menuExpanded).toBe('false');
    expect(portraitControls.visibleTopbarButtons).toEqual(['Pause', 'Plus']);

    await openSharedPreview(page, { width: 844, height: 390 });
    await expect(page.locator('.player-mobile-orientation-gate')).not.toBeVisible();
    let landscapeControls = await getMobileControlsMetrics(page);
    expect(landscapeControls.visibleTopbarButtons).toEqual(['Pause', 'Plus']);
    expect(landscapeControls.menuButtons).toEqual([]);
    expect(landscapeControls.menuExpanded).toBe('false');
    expect(landscapeControls.topbar.height).toBeLessThanOrEqual(52);
    expect(landscapeControls.topbarOverlapsStage).toBe(false);
    expect(landscapeControls.topbarEndsBeforeStage).toBe(true);

    await page.getByRole('button', { name: 'Actions du player' }).click();
    landscapeControls = await getMobileControlsMetrics(page);
    expect(landscapeControls.menuExpanded).toBe('true');
    expect(landscapeControls.menuButtons).toEqual([
      'Recommencer',
      'Sauvegarder',
      'Charger',
      'Sans aide',
      'Plein écran',
    ]);
    expect(landscapeControls.topbarOverlapsStage).toBe(false);
    expect(landscapeControls.topbarEndsBeforeStage).toBe(true);
  });

  test('portrait preview is landscape-first with a usable portrait fallback', async ({ page }) => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await openSharedPreview(page, { width: 390, height: 844 });
    await expect(page.locator('.player-mobile-orientation-gate')).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'preview-player-mobile-390x844-landscape-gate.png'), fullPage: true });

    await page.getByRole('button', { name: 'Continuer en portrait' }).click();
    await expect(page.locator('.player-mobile-orientation-gate')).not.toBeVisible();

    const metrics = await getLayoutMetrics(page);
    expect(metrics.shell.height).toBeGreaterThan(820);
    expect(metrics.stageViewport.clientHeight).toBeGreaterThan(560);
    expect(metrics.scene.height).toBeGreaterThan(600);
    expect(metrics.stageViewport.scrollWidth).toBeGreaterThan(metrics.stageViewport.clientWidth + 240);
    expect(metrics.overlaps.topbarNarration).toBe(false);
    expect(metrics.overlaps.narrationTextActions).toBe(false);
    expect(metrics.overlaps.narrationCredit).toBe(false);
    expectRectInsideViewport(metrics.narration, metrics.windowWidth, metrics.windowHeight);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'preview-player-mobile-390x844.png'), fullPage: true });

    await page.getByRole('button', { name: /Inventaire/ }).click();
    await expect(page.locator('.player-inventory-drawer')).toBeVisible();
    const drawerRect = await page.locator('.player-inventory-drawer').boundingBox();
    expect(drawerRect.x).toBeGreaterThanOrEqual(0);
    expect(drawerRect.y).toBeGreaterThanOrEqual(0);
    expect(drawerRect.x + drawerRect.width).toBeLessThanOrEqual(390);
    expect(drawerRect.y + drawerRect.height).toBeLessThanOrEqual(844);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'preview-player-mobile-390x844-inventory.png'), fullPage: true });
  });

  test('dense promotion scene stays usable on mobile', async ({ page }) => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const project = loadThorezPromotionProject();

    await openSharedPreview(page, { width: 390, height: 844 }, { project });
    await expect(page.locator('.player-mobile-orientation-gate')).toBeVisible();
    await page.getByRole('button', { name: 'Continuer en portrait' }).click();
    await expect(page.locator('.player-mobile-orientation-gate')).not.toBeVisible();
    await expect(page.locator('.player-shell.is-dense-mobile-scene')).toBeVisible();
    await expect(page.locator('.player-narration-bar.is-collapsed')).toBeVisible();
    await expect(page.locator('.inventory-discreet-button')).toHaveCount(0);

    const portraitMetrics = await getThorezPromotionLayoutMetrics(page);
    expect(portraitMetrics.scene.width).toBeGreaterThanOrEqual(920);
    expect(portraitMetrics.stageViewport.scrollWidth).toBeGreaterThan(portraitMetrics.stageViewport.clientWidth + 120);
    expect(portraitMetrics.stageViewport.scrollLeft).toBe(0);
    expect(portraitMetrics.ctas).toHaveLength(3);
    for (const cta of portraitMetrics.ctas) {
      expect(cta).not.toBeNull();
      expect(cta.width).toBeGreaterThanOrEqual(44);
      expect(cta.height).toBeGreaterThanOrEqual(44);
    }
    expect(portraitMetrics.ctaOverlapsHud).toEqual([false, false, false]);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'preview-player-thorez-390x844.png'), fullPage: true });

    await openSharedPreview(page, { width: 844, height: 390 }, { project });
    await expect(page.locator('.player-mobile-orientation-gate')).not.toBeVisible();
    await expect(page.locator('.player-shell.is-dense-mobile-scene')).toBeVisible();
    await expect(page.locator('.player-narration-bar.is-collapsed')).toBeVisible();
    await expect(page.locator('.inventory-discreet-button')).toHaveCount(0);
    const landscapeMetrics = await getThorezPromotionLayoutMetrics(page);
    expect(landscapeMetrics.ctaOverlapsHud).toEqual([false, false, false]);
    for (const cta of landscapeMetrics.ctas) {
      expect(cta.width).toBeGreaterThanOrEqual(44);
      expect(cta.height).toBeGreaterThanOrEqual(34);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'preview-player-thorez-844x390.png'), fullPage: true });
  });

  test('landscape preview keeps controls readable without overlap', async ({ page }) => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await openSharedPreview(page, { width: 844, height: 390 });
    await expect(page.locator('.player-mobile-orientation-gate')).not.toBeVisible();

    const metrics = await getLayoutMetrics(page);
    expect(metrics.shell.height).toBeGreaterThan(380);
    expect(metrics.scene.height).toBeGreaterThan(320);
    expect(metrics.overlaps.topbarNarration).toBe(false);
    expect(metrics.overlaps.narrationTextActions).toBe(false);
    expect(metrics.overlaps.narrationCredit).toBe(false);
    expectRectInsideViewport(metrics.narration, metrics.windowWidth, metrics.windowHeight);
    expect(metrics.inventoryButton).not.toBeNull();
    expectRectInsideViewport(metrics.inventoryButton, metrics.windowWidth, metrics.windowHeight);
    expectRectInSideGutter(metrics.inventoryButton, metrics.scene);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'preview-player-mobile-844x390.png'), fullPage: true });

    await page.locator('.player-narration-bar p').click();
    const collapsedMetrics = await getLayoutMetrics(page);
    expect(collapsedMetrics.narrationButton).not.toBeNull();
    expect(collapsedMetrics.inventoryButton).not.toBeNull();
    expectRectInsideViewport(collapsedMetrics.narrationButton, collapsedMetrics.windowWidth, collapsedMetrics.windowHeight);
    expectRectInsideViewport(collapsedMetrics.inventoryButton, collapsedMetrics.windowWidth, collapsedMetrics.windowHeight);
    expectRectInSideGutter(collapsedMetrics.narrationButton, collapsedMetrics.scene);
    expectRectInSideGutter(collapsedMetrics.inventoryButton, collapsedMetrics.scene);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'preview-player-mobile-844x390-collapsed-controls.png'), fullPage: true });
  });

  test('cinematic stays readable in portrait and short landscape', async ({ page }) => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });

    await openSharedPreview(page, { width: 390, height: 844 }, { startWithCinematic: true });
    await expect(page.locator('.player-mobile-orientation-gate')).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'preview-player-cinematic-390x844-landscape-gate.png'), fullPage: true });
    await page.getByRole('button', { name: 'Continuer en portrait' }).click();
    await expect(page.locator('.player-mobile-orientation-gate')).not.toBeVisible();
    await expect(page.locator('[data-testid="preview-cinematic-overlay"]')).toBeVisible();
    const portraitMetrics = await getCinematicLayoutMetrics(page);
    expect(portraitMetrics.card.height).toBeLessThanOrEqual(844);
    expect(portraitMetrics.media.height).toBeGreaterThan(180);
    expect(portraitMetrics.media.width).toBeGreaterThan(320);
    expect(portraitMetrics.overlaps.mediaNarration).toBe(false);
    expect(portraitMetrics.overlaps.mediaActions).toBe(false);
    expect(portraitMetrics.overlaps.narrationActions).toBe(false);
    expectRectInsideViewport(portraitMetrics.card, portraitMetrics.windowWidth, portraitMetrics.windowHeight);
    expectRectInsideViewport(portraitMetrics.narration, portraitMetrics.windowWidth, portraitMetrics.windowHeight);
    expectRectInsideViewport(portraitMetrics.actions, portraitMetrics.windowWidth, portraitMetrics.windowHeight);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'preview-player-cinematic-390x844.png'), fullPage: true });

    await openSharedPreview(page, { width: 844, height: 390 }, { startWithCinematic: true });
    await expect(page.locator('[data-testid="preview-cinematic-overlay"]')).toBeVisible();
    const landscapeMetrics = await getCinematicLayoutMetrics(page);
    expect(landscapeMetrics.card.height).toBeLessThanOrEqual(390);
    expect(landscapeMetrics.media.height).toBeGreaterThan(250);
    expect(landscapeMetrics.narration.height).toBeLessThanOrEqual(58);
    expect(landscapeMetrics.overlaps.mediaNarration).toBe(false);
    expect(landscapeMetrics.overlaps.mediaActions).toBe(false);
    expect(landscapeMetrics.overlaps.narrationActions).toBe(false);
    expectRectInsideViewport(landscapeMetrics.card, landscapeMetrics.windowWidth, landscapeMetrics.windowHeight);
    expectRectInsideViewport(landscapeMetrics.narration, landscapeMetrics.windowWidth, landscapeMetrics.windowHeight);
    expectRectInsideViewport(landscapeMetrics.actions, landscapeMetrics.windowWidth, landscapeMetrics.windowHeight);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'preview-player-cinematic-844x390.png'), fullPage: true });
  });
});
