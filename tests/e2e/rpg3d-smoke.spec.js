import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'escape-game-builder:arcade-assets:v1';
const SMOKE_PROP_ID = 'smoke-prop';
const SMOKE_ZONE_MESSAGE = 'Smoke zone reached';

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

async function seedSmokeProject(page) {
  await page.addInitScript(({ storageKey, payload }) => {
    window.__escapeGameBuilderRpg3DE2E = true;
    window.localStorage.removeItem(storageKey);
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, { storageKey: STORAGE_KEY, payload: smokePayload });
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

test('RPG 3D canvas supports selection, drag, play mode and action zones', async ({ page }) => {
  await seedSmokeProject(page);
  await page.goto('/?arcade=1');

  await expect(page.getByRole('heading', { name: 'RPG 3D Builder' })).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => Boolean(window.__escapeGameBuilderRpg3DSmoke?.projectWorldToScreen));

  const viewport = page.getByTestId('rpg3d-viewport');
  const canvas = page.getByTestId('rpg3d-canvas');
  await expect(viewport).toHaveAttribute('data-rpg3d-mode', 'edit');
  await expect(canvas).toBeVisible();
  await page.waitForFunction(() => {
    const element = document.querySelector('[data-testid="rpg3d-canvas"]');
    return Boolean(element?.width && element?.height);
  });
  await expect.poll(() => getCanvasRgbRange(canvas), {
    message: 'RPG 3D canvas should render non-empty WebGL pixels',
  }).toBeGreaterThan(24);

  const propPoint = await projectWorldToScreen(page, { x: 760, y: 520, z: 2 });
  await page.mouse.click(propPoint.x, propPoint.y);
  await expect(viewport).toHaveAttribute('data-rpg3d-selected', `prop:${SMOKE_PROP_ID}`);
  await expect(page.locator('aside[aria-label="Inspecteur"] .arcade-selected-type')).toContainText('OBJET');

  await page.getByRole('button', { name: 'Activer le glisser-deposer' }).click();
  await expect(page.getByRole('button', { name: 'Desactiver le glisser-deposer' })).toHaveAttribute('aria-pressed', 'true');

  const dragStart = await projectWorldToScreen(page, { x: 760, y: 520, z: 2 });
  const dragEnd = await projectWorldToScreen(page, { x: 960, y: 520, z: 2 });
  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  await page.mouse.move(dragEnd.x, dragEnd.y, { steps: 12 });
  await page.mouse.up();

  await expect.poll(async () => page.evaluate((propId) => {
    const config = window.__escapeGameBuilderRpg3DSmoke?.getConfig();
    return config?.props?.find((prop) => prop.id === propId)?.x || 0;
  }, SMOKE_PROP_ID), {
    message: 'dragging the selected prop should update its world position',
  }).toBeGreaterThan(850);
  await expect(viewport).toHaveAttribute('data-rpg3d-selected', `prop:${SMOKE_PROP_ID}`);

  await page.getByRole('button', { name: 'Tester' }).click();
  await expect(viewport).toHaveAttribute('data-rpg3d-mode', 'play');
  await expect(page.getByText(SMOKE_ZONE_MESSAGE)).toBeVisible();
});
