import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'escape-game-builder:arcade-assets:v1';
const SMOKE_PROP_ID = 'smoke-prop';
const SMOKE_ZONE_MESSAGE = 'Smoke zone reached';
const STRESS_PROP_COUNT = 84;
const STRESS_ENEMY_COUNT = 28;
const STRESS_PICKUP_COUNT = 34;
const STRESS_ACTION_ZONE_COUNT = 18;
const STRESS_TERRAIN_STROKE_COUNT = 28;
const STRESS_SELECT_PROP_ID = 'stress-prop-0';
const STRESS_SELECT_PROP_POINT = { x: 820, y: 860, z: 2 };
const STRESS_RENDER_THRESHOLD_MS = 45_000;
const STRESS_PALETTE = ['#38bdf8', '#f97316', '#84cc16', '#facc15', '#f472b6', '#a78bfa'];
const FALLBACK_GLB_PROP_ID = 'fallback-glb-prop';
const MULTI_PROP_A_ID = 'multi-prop-a';
const MULTI_PROP_B_ID = 'multi-prop-b';
const RPG3D_READY_TIMEOUT_MS = 20_000;
const FAST_EXPECT_TIMEOUT_MS = 5_000;
const CANVAS_RENDER_TIMEOUT_MS = 7_500;
const DRAG_STEPS = 6;
const FAST_POLL_INTERVALS = [80, 160, 320];
const fastExpect = expect.configure({ timeout: FAST_EXPECT_TIMEOUT_MS });

const smokeConfig = {
  meta: { title: 'RPG 3D Smoke' },
  world: { width: 1800, height: 1200, grid: 120 },
  engine: {
    defaultView: '3d',
    cameraHeight: 20,
    cameraDistance: 28,
    wallHeight: 2.4,
    reliefScale: 1,
    propHeight: 1,
    lightIntensity: 1.15,
    lightOrientation: 320,
  },
  player: {
    x: 1040,
    y: 600,
    z: 0,
    health: 18,
    maxHealth: 18,
    mana: 10,
    maxMana: 10,
    speed: 260,
    dashSpeed: 680,
    dashCooldown: 0.9,
    bulletSpeed: 680,
    fireRate: 0.13,
  },
  ai: { visionRange: 850, obstacleAvoidance: 56, aggression: 1 },
  obstacles: [],
  reliefs: [],
  heroes: [],
  enemies: [],
  pickups: [],
  props: [
    {
      id: SMOKE_PROP_ID,
      name: 'Smoke drag block',
      x: 760,
      y: 520,
      z: 0,
      rotation: 0,
      r: 110,
      w: 220,
      h: 220,
      modelHeight: 220,
      renderMode: 'box',
      blocksMovement: false,
      imageData: '',
      imageName: '',
    },
  ],
  actionZones: [
    {
      id: 'smoke-zone',
      name: 'Smoke action zone',
      x: 1040,
      y: 600,
      rotation: 0,
      w: 260,
      h: 180,
      modelHeight: 240,
      renderMode: 'volume',
      color: '#facc15',
      opacity: 0.42,
      actionType: 'npcAction',
      targetNpcId: '',
      npcAction: SMOKE_ZONE_MESSAGE,
      npcInteractionMode: 'message',
      message: SMOKE_ZONE_MESSAGE,
      triggerMode: 'enter',
      visibleInPlay: true,
    },
  ],
  terrainPaintStrokes: [],
};

const smokePayload = {
  version: 2,
  savedAt: '2026-05-21T00:00:00.000Z',
  config: smokeConfig,
};

const cloneFixture = (value) => JSON.parse(JSON.stringify(value));

function createRpg3DConfig(overrides = {}) {
  return {
    ...cloneFixture(smokeConfig),
    meta: { ...cloneFixture(smokeConfig.meta), ...(overrides.meta || {}) },
    world: { ...cloneFixture(smokeConfig.world), ...(overrides.world || {}) },
    engine: { ...cloneFixture(smokeConfig.engine), ...(overrides.engine || {}) },
    player: { ...cloneFixture(smokeConfig.player), ...(overrides.player || {}) },
    ai: { ...cloneFixture(smokeConfig.ai), ...(overrides.ai || {}) },
    obstacles: cloneFixture(overrides.obstacles || []),
    reliefs: cloneFixture(overrides.reliefs || []),
    heroes: cloneFixture(overrides.heroes || []),
    enemies: cloneFixture(overrides.enemies || []),
    pickups: cloneFixture(overrides.pickups || []),
    props: cloneFixture(overrides.props || []),
    actionZones: cloneFixture(overrides.actionZones || []),
    terrainPaintStrokes: cloneFixture(overrides.terrainPaintStrokes || []),
  };
}

function createProp(overrides = {}) {
  return {
    id: 'e2e-prop',
    name: 'E2E prop',
    x: 760,
    y: 520,
    z: 0,
    rotation: 0,
    r: 90,
    w: 180,
    h: 180,
    modelHeight: 180,
    renderMode: 'box',
    blocksMovement: false,
    imageData: '',
    imageName: '',
    ...overrides,
  };
}

function createActionZone(overrides = {}) {
  return {
    id: 'e2e-zone',
    name: 'E2E action zone',
    x: 1040,
    y: 600,
    rotation: 0,
    w: 260,
    h: 180,
    modelHeight: 240,
    renderMode: 'volume',
    color: '#38bdf8',
    opacity: 0.42,
    actionType: 'npcAction',
    targetNpcId: '',
    npcAction: '',
    npcInteractionMode: 'message',
    npcQuestion: 'Que veux-tu demander ?',
    npcChoices: [],
    message: '',
    triggerMode: 'enter',
    visibleInPlay: true,
    ...overrides,
  };
}

function createStressProp(index) {
  if (index === 0) {
    return createProp({
      id: STRESS_SELECT_PROP_ID,
      name: 'Stress selectable prop',
      x: STRESS_SELECT_PROP_POINT.x,
      y: STRESS_SELECT_PROP_POINT.y,
      w: 180,
      h: 180,
      r: 90,
      modelHeight: 210,
      renderMode: 'box',
    });
  }

  const column = (index - 1) % 12;
  const row = Math.floor((index - 1) / 12);
  const renderMode = ['rock', 'box', 'house', 'floor'][index % 4];
  return createProp({
    id: `stress-prop-${index}`,
    name: `Stress prop ${index}`,
    x: 960 + column * 175 + (row % 2) * 44,
    y: 420 + row * 185,
    rotation: (index * 19) % 360,
    w: renderMode === 'floor' ? 220 : 120 + (index % 4) * 22,
    h: renderMode === 'floor' ? 170 : 120 + (index % 3) * 28,
    r: 70 + (index % 5) * 8,
    modelHeight: renderMode === 'floor' ? 12 : 125 + (index % 5) * 35,
    renderMode,
    baseColor: STRESS_PALETTE[index % STRESS_PALETTE.length],
    blocksMovement: false,
  });
}

function createStressEnemy(index) {
  const column = index % 7;
  const row = Math.floor(index / 7);
  return {
    id: `stress-enemy-${index}`,
    name: `Stress enemy ${index}`,
    x: 1380 + column * 230,
    y: 940 + row * 255,
    z: 0,
    rotation: (index * 29) % 360,
    role: ['rifle', 'brute', 'sniper'][index % 3],
    character: ['guard', 'runner', 'mage'][index % 3],
    characterRenderMode: ['capsule', 'block', 'boss'][index % 3],
    combatEnemyMaxHealth: 5 + (index % 4),
    combatEnemyStrength: 1,
    combatEnemySpeed: 40 + (index % 5) * 7,
    combatEnemyAttackSpeed: 0.55,
  };
}

function createStressPickup(index) {
  const column = index % 10;
  const row = Math.floor(index / 10);
  return {
    id: `stress-pickup-${index}`,
    x: 1060 + column * 210,
    y: 320 + row * 245,
    z: 0,
    type: ['health', 'mana', 'energy'][index % 3],
  };
}

function createStressActionZone(index) {
  const column = index % 6;
  const row = Math.floor(index / 6);
  return createActionZone({
    id: `stress-zone-${index}`,
    name: `Stress zone ${index}`,
    x: 1180 + column * 315,
    y: 760 + row * 385,
    rotation: (index * 17) % 360,
    w: 210 + (index % 3) * 35,
    h: 145 + (index % 4) * 25,
    modelHeight: 170 + (index % 5) * 35,
    color: STRESS_PALETTE[index % STRESS_PALETTE.length],
    opacity: 0.24 + (index % 3) * 0.08,
    npcAction: `Stress zone ${index}`,
    message: `Stress zone ${index}`,
    visibleInPlay: true,
  });
}

function createStressTerrainStroke(index) {
  const startX = 260 + (index % 7) * 410;
  const startY = 260 + Math.floor(index / 7) * 360;
  return {
    id: `stress-paint-${index}`,
    color: STRESS_PALETTE[index % STRESS_PALETTE.length],
    radius: 72 + (index % 5) * 18,
    opacity: 0.34 + (index % 3) * 0.12,
    shape: ['round', 'square', 'triangle'][index % 3],
    points: Array.from({ length: 5 }, (_, pointIndex) => ({
      x: Math.min(3140, startX + pointIndex * 72),
      y: Math.min(2140, startY + Math.round(Math.sin(index + pointIndex) * 68)),
    })),
  };
}

function createStressConfig() {
  return createRpg3DConfig({
    meta: { title: 'RPG 3D Stress' },
    world: { width: 3200, height: 2200, grid: 100 },
    engine: { cameraHeight: 22, cameraDistance: 30, lightIntensity: 1.2 },
    player: {
      x: 520,
      y: 540,
      health: 120,
      maxHealth: 120,
      mana: 20,
      maxMana: 20,
      speed: 320,
    },
    ai: { visionRange: 300, obstacleAvoidance: 56, aggression: 0.65 },
    props: Array.from({ length: STRESS_PROP_COUNT }, (_, index) => createStressProp(index)),
    enemies: Array.from({ length: STRESS_ENEMY_COUNT }, (_, index) => createStressEnemy(index)),
    pickups: Array.from({ length: STRESS_PICKUP_COUNT }, (_, index) => createStressPickup(index)),
    actionZones: Array.from({ length: STRESS_ACTION_ZONE_COUNT }, (_, index) => createStressActionZone(index)),
    terrainPaintStrokes: Array.from({ length: STRESS_TERRAIN_STROKE_COUNT }, (_, index) => createStressTerrainStroke(index)),
  });
}

function createStudioProject(canvases, activeCanvasId = canvases[0]?.id || 'rpg3d-canvas-1') {
  return {
    title: 'RPG 3D Playwright',
    characterModels3d: [],
    decorModels3d: [],
    mediaAssets: [],
    stuntAnimations: [],
    rpg3dActs: [{ id: 'rpg3d-e2e-act', name: 'Acte E2E' }],
    rpg3dScenes: canvases.map((canvas) => ({
      id: canvas.id,
      name: canvas.name,
      actId: 'rpg3d-e2e-act',
      parentSceneId: '',
    })),
    rpg3dCanvases: canvases.map((canvas) => ({
      id: canvas.id,
      name: canvas.name,
      actId: 'rpg3d-e2e-act',
      sceneId: canvas.id,
      config: canvas.config,
      createdAt: '2026-05-21T00:00:00.000Z',
      updatedAt: '2026-05-21T00:00:00.000Z',
    })),
    rpg3dActiveCanvasId: activeCanvasId,
  };
}

function createPayload(config, studioProject = null) {
  return {
    version: 2,
    savedAt: '2026-05-21T00:00:00.000Z',
    config,
    ...(studioProject ? { studioProject } : {}),
  };
}

async function seedSmokeProject(page, payload = smokePayload, options = {}) {
  await page.addInitScript(({ storageKey, payload: seededPayload, seedOnce }) => {
    window.__escapeGameBuilderRpg3DE2E = true;
    if (seedOnce && window.sessionStorage.getItem(`${storageKey}:seeded`)) return;
    window.localStorage.removeItem(storageKey);
    window.localStorage.setItem(storageKey, JSON.stringify(seededPayload));
    if (seedOnce) window.sessionStorage.setItem(`${storageKey}:seeded`, 'true');
  }, { storageKey: STORAGE_KEY, payload, seedOnce: Boolean(options.seedOnce) });
}

async function waitForRpg3DReady(page) {
  await page.waitForFunction(() => {
    const api = window.__escapeGameBuilderRpg3DSmoke;
    const canvas = document.querySelector('[data-testid="rpg3d-canvas"]');
    const bounds = canvas?.getBoundingClientRect?.();
    return Boolean(
      api?.projectWorldToScreen
        && api?.getConfig
        && canvas?.width
        && canvas?.height
        && bounds?.width
        && bounds?.height,
    );
  }, undefined, { timeout: RPG3D_READY_TIMEOUT_MS });

  return {
    viewport: page.getByTestId('rpg3d-viewport'),
    canvas: page.getByTestId('rpg3d-canvas'),
  };
}

async function openRpg3DSmoke(page, payload = smokePayload, options = {}) {
  await seedSmokeProject(page, payload, options);
  await page.goto('/?arcade=1', { waitUntil: 'domcontentloaded' });
  return waitForRpg3DReady(page);
}

async function projectWorldToScreen(page, point) {
  const projected = await page.evaluate((worldPoint) => (
    window.__escapeGameBuilderRpg3DSmoke?.projectWorldToScreen(worldPoint)
  ), point);
  expect(projected, `world point ${JSON.stringify(point)} should project to the WebGL viewport`).toBeTruthy();
  expect(projected.inView, `world point ${JSON.stringify(point)} should be visible`).toBe(true);
  return projected;
}

async function getCanvasRgbRange(canvas) {
  return canvas.evaluate((element) => {
    const gl = element.getContext('webgl2')
      || element.getContext('webgl')
      || element.getContext('experimental-webgl');
    if (!gl) return -1;
    const width = gl.drawingBufferWidth || element.width;
    const height = gl.drawingBufferHeight || element.height;
    if (!width || !height) return -1;
    const sampleWidth = Math.min(width, 160);
    const sampleHeight = Math.min(height, 120);
    const x = Math.max(0, Math.floor((width - sampleWidth) / 2));
    const y = Math.max(0, Math.floor((height - sampleHeight) / 2));
    const pixels = new Uint8Array(sampleWidth * sampleHeight * 4);
    gl.readPixels(x, y, sampleWidth, sampleHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let min = 255;
    let max = 0;
    let alphaPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] > 0) alphaPixels += 1;
      min = Math.min(min, pixels[index], pixels[index + 1], pixels[index + 2]);
      max = Math.max(max, pixels[index], pixels[index + 1], pixels[index + 2]);
    }
    if (alphaPixels < sampleWidth * sampleHeight * 0.8) return -1;
    return max - min;
  });
}

async function expectCanvasRendered(canvas) {
  await expect.poll(() => getCanvasRgbRange(canvas), {
    message: 'RPG 3D canvas should render non-empty WebGL pixels',
    timeout: CANVAS_RENDER_TIMEOUT_MS,
    intervals: FAST_POLL_INTERVALS,
  }).toBeGreaterThan(24);
}

async function clickWorld(page, point) {
  const projected = await projectWorldToScreen(page, point);
  await page.mouse.click(projected.x, projected.y);
  return projected;
}

async function dragWorld(page, from, to, options = {}) {
  const dragStart = await projectWorldToScreen(page, from);
  const dragEnd = await projectWorldToScreen(page, to);
  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  await page.mouse.move(dragEnd.x, dragEnd.y, { steps: options.steps || DRAG_STEPS });
  await page.mouse.up();
}

async function expectPropXGreaterThan(page, propId, x, message) {
  await expect.poll(async () => page.evaluate((selectedPropId) => {
    const liveConfig = window.__escapeGameBuilderRpg3DSmoke?.getConfig();
    return liveConfig?.props?.find((prop) => prop.id === selectedPropId)?.x || 0;
  }, propId), {
    message,
    timeout: FAST_EXPECT_TIMEOUT_MS,
    intervals: FAST_POLL_INTERVALS,
  }).toBeGreaterThan(x);
}

test('RPG 3D core edit/play interactions stay functional', async ({ page }) => {
  const config = createRpg3DConfig({
    player: { y: 900 },
    props: [
      cloneFixture(smokeConfig.props[0]),
      createProp({
        id: FALLBACK_GLB_PROP_ID,
        name: 'Fallback model prop',
        x: 420,
        y: 520,
        renderMode: 'glb',
        modelUrl: '',
        modelData: '',
      }),
      createProp({ id: MULTI_PROP_A_ID, name: 'Multi A', x: 620, y: 520 }),
      createProp({ id: MULTI_PROP_B_ID, name: 'Multi B', x: 1200, y: 520, renderMode: 'rock' }),
    ],
    actionZones: cloneFixture(smokeConfig.actionZones).map((zone) => ({ ...zone, y: 900 })),
  });
  const { viewport, canvas } = await openRpg3DSmoke(page, createPayload(config));

  await fastExpect(viewport).toHaveAttribute('data-rpg3d-mode', 'edit');
  await expectCanvasRendered(canvas);

  await test.step('GLB fallback props remain selectable without model data', async () => {
    await clickWorld(page, { x: 420, y: 520, z: 2 });
    await fastExpect(viewport).toHaveAttribute('data-rpg3d-selected', `prop:${FALLBACK_GLB_PROP_ID}`);
    await fastExpect(page.locator('aside[aria-label="Inspecteur"] .arcade-selected-type')).toContainText('OBJET');
  });

  await test.step('multi-selection keeps multiple props in the inspector', async () => {
    await clickWorld(page, { x: 260, y: 300, z: 2 });
    await fastExpect(viewport).toHaveAttribute('data-rpg3d-selected', '');
    await page.getByRole('button', { name: 'Activer la selection multiple' }).click();
    await fastExpect(page.getByRole('button', { name: 'Desactiver la selection multiple' })).toHaveAttribute('aria-pressed', 'true');
    await clickWorld(page, { x: 620, y: 520, z: 2 });
    await fastExpect(viewport).toHaveAttribute('data-rpg3d-selected', `prop:${MULTI_PROP_A_ID}`);
    await clickWorld(page, { x: 1200, y: 520, z: 2 });
    await fastExpect(viewport).toHaveAttribute('data-rpg3d-selected', `prop:${MULTI_PROP_B_ID}`);
    await fastExpect(page.locator('aside[aria-label="Inspecteur"] .arcade-selected-type')).toContainText('Selection (2)');
    await page.getByRole('button', { name: 'Desactiver la selection multiple' }).click();
  });

  await test.step('selection, drag and inspector update', async () => {
    await clickWorld(page, { x: 760, y: 520, z: 2 });
    await fastExpect(viewport).toHaveAttribute('data-rpg3d-selected', `prop:${SMOKE_PROP_ID}`);
    await fastExpect(page.locator('aside[aria-label="Inspecteur"] .arcade-selected-type')).toContainText('OBJET');

    await page.getByRole('button', { name: 'Activer le glisser-deposer' }).click();
    await fastExpect(page.getByRole('button', { name: 'Desactiver le glisser-deposer' })).toHaveAttribute('aria-pressed', 'true');

    await dragWorld(page, { x: 760, y: 520, z: 2 }, { x: 960, y: 520, z: 2 });
    await expectPropXGreaterThan(
      page,
      SMOKE_PROP_ID,
      850,
      'dragging the selected prop should update its world position',
    );
    await fastExpect(viewport).toHaveAttribute('data-rpg3d-selected', `prop:${SMOKE_PROP_ID}`);
    await page.getByRole('button', { name: 'Desactiver le glisser-deposer' }).click();
  });

  await test.step('play mode triggers the action zone', async () => {
    await page.getByRole('button', { name: 'Tester' }).click();
    await fastExpect(viewport).toHaveAttribute('data-rpg3d-mode', 'play');
    await fastExpect(page.getByText(SMOKE_ZONE_MESSAGE)).toBeVisible();
  });
});

test('RPG 3D portals switch to the target canvas in play mode', async ({ page }) => {
  const startCanvasId = 'portal-start-canvas';
  const targetCanvasId = 'portal-target-canvas';
  const startConfig = createRpg3DConfig({
    meta: { title: 'Portal start' },
    player: { x: 900, y: 540 },
    props: [createProp({ id: 'portal-start-marker', x: 640, y: 500, renderMode: 'rock' })],
    actionZones: [
      createActionZone({
        id: 'portal-to-target',
        name: 'Portal to target canvas',
        x: 900,
        y: 540,
        actionType: 'portal',
        targetCanvasId,
        visibleInPlay: true,
      }),
    ],
  });
  const targetConfig = createRpg3DConfig({
    meta: { title: 'Portal target' },
    player: { x: 520, y: 520 },
    props: [createProp({ id: 'portal-target-marker', name: 'Target marker', x: 520, y: 520 })],
  });
  const studioProject = createStudioProject([
    { id: startCanvasId, name: 'Depart', config: startConfig },
    { id: targetCanvasId, name: 'Arrivee', config: targetConfig },
  ], startCanvasId);

  const { viewport } = await openRpg3DSmoke(page, createPayload(startConfig, studioProject));

  await page.getByRole('button', { name: 'Tester' }).click();
  await fastExpect(viewport).toHaveAttribute('data-rpg3d-mode', 'play');
  await expect.poll(() => page.evaluate(() => {
    const config = window.__escapeGameBuilderRpg3DSmoke?.getConfig();
    return {
      hasTargetMarker: Boolean(config?.props?.some((prop) => prop.id === 'portal-target-marker')),
      hasStartPortal: Boolean(config?.actionZones?.some((zone) => zone.id === 'portal-to-target')),
    };
  }), {
    message: 'entering a portal zone should activate the target canvas config',
    timeout: FAST_EXPECT_TIMEOUT_MS,
    intervals: FAST_POLL_INTERVALS,
  }).toEqual({ hasTargetMarker: true, hasStartPortal: false });
});

test('RPG 3D NPC multiple-choice zones show and resolve choices', async ({ page }) => {
  const choiceResponse = 'The gate opens.';
  const config = createRpg3DConfig({
    meta: { title: 'NPC choice' },
    player: { x: 820, y: 500 },
    actionZones: [
      createActionZone({
        id: 'choice-zone',
        name: 'Guide',
        x: 820,
        y: 500,
        actionType: 'npcAction',
        npcInteractionMode: 'multipleChoice',
        npcQuestion: 'Which route should we take?',
        npcChoices: [
          { id: 'open-gate', label: 'Open the gate', response: choiceResponse },
          { id: 'wait', label: 'Wait here', response: 'Not yet.' },
        ],
      }),
    ],
  });

  const { viewport } = await openRpg3DSmoke(page, createPayload(config));

  await page.getByRole('button', { name: 'Tester' }).click();
  await fastExpect(viewport).toHaveAttribute('data-rpg3d-mode', 'play');
  await fastExpect(page.locator('.arcade-npc-choice-overlay')).toContainText('Which route should we take?');
  await page.getByRole('button', { name: 'Open the gate' }).click();

  await fastExpect(page.locator('.arcade-npc-choice-overlay')).toBeHidden();
  await fastExpect(page.getByText(choiceResponse)).toBeVisible();
});

test('RPG 3D saves local edits and reloads the saved canvas', async ({ page }) => {
  const propId = 'local-save-prop';
  const config = createRpg3DConfig({
    meta: { title: 'Local save' },
    props: [createProp({ id: propId, name: 'Local save prop', x: 720, y: 520 })],
  });

  const { viewport } = await openRpg3DSmoke(page, createPayload(config), { seedOnce: true });

  await clickWorld(page, { x: 720, y: 520, z: 2 });
  await fastExpect(viewport).toHaveAttribute('data-rpg3d-selected', `prop:${propId}`);
  await page.getByRole('button', { name: 'Activer le glisser-deposer' }).click();

  await dragWorld(page, { x: 720, y: 520, z: 2 }, { x: 960, y: 520, z: 2 });
  await expectPropXGreaterThan(page, propId, 850, 'dragging before save should update the live config');

  await page.getByRole('button', { name: 'Sauvegarder' }).click();
  await expect.poll(async () => page.evaluate(({ storageKey, selectedPropId }) => {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
    return saved.config?.props?.find((prop) => prop.id === selectedPropId)?.x || 0;
  }, { storageKey: STORAGE_KEY, selectedPropId: propId }), {
    message: 'local save should persist the dragged prop position',
    timeout: FAST_EXPECT_TIMEOUT_MS,
    intervals: FAST_POLL_INTERVALS,
  }).toBeGreaterThan(850);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForRpg3DReady(page);

  await expect.poll(async () => page.evaluate((selectedPropId) => {
    const reloadedConfig = window.__escapeGameBuilderRpg3DSmoke?.getConfig();
    return reloadedConfig?.props?.find((prop) => prop.id === selectedPropId)?.x || 0;
  }, propId), {
    message: 'reload should hydrate the locally saved canvas',
    timeout: FAST_EXPECT_TIMEOUT_MS,
    intervals: FAST_POLL_INTERVALS,
  }).toBeGreaterThan(850);
});

test('RPG 3D viewport remains responsive with a dense stress scene', async ({ page }) => {
  test.setTimeout(90_000);
  const loadStartedAt = Date.now();
  const { viewport, canvas } = await openRpg3DSmoke(page, createPayload(createStressConfig()));
  await expectCanvasRendered(canvas);
  const renderDurationMs = Date.now() - loadStartedAt;

  expect(renderDurationMs).toBeLessThan(STRESS_RENDER_THRESHOLD_MS);

  await clickWorld(page, STRESS_SELECT_PROP_POINT);
  await fastExpect(viewport).toHaveAttribute('data-rpg3d-selected', `prop:${STRESS_SELECT_PROP_ID}`);
  await fastExpect(page.locator('aside[aria-label="Inspecteur"] .arcade-selected-type')).toContainText('OBJET');

  await page.getByRole('button', { name: 'Tester' }).click();
  await fastExpect(viewport).toHaveAttribute('data-rpg3d-mode', 'play');
  await expectCanvasRendered(canvas);

  const playerBeforeMove = await page.evaluate(() => window.__escapeGameBuilderRpg3DSmoke?.getRuntimePlayer?.());
  expect(playerBeforeMove?.x).toBeGreaterThan(0);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(450);
  await page.keyboard.up('KeyD');

  const playerAfterMove = await page.evaluate(() => window.__escapeGameBuilderRpg3DSmoke?.getRuntimePlayer?.());
  expect(playerAfterMove?.x).toBeGreaterThan(playerBeforeMove.x + 50);
  expect(playerAfterMove?.hp).toBeGreaterThan(0);
  await expectCanvasRendered(canvas);

  await page.getByRole('button', { name: 'Editer' }).click();
  await fastExpect(viewport).toHaveAttribute('data-rpg3d-mode', 'edit');
  await expectCanvasRendered(canvas);
});
