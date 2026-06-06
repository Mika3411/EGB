import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const MOBILE_PREVIEW_DIR = path.join(process.cwd(), 'test-results', 'mobile-preview');
const QA_USER_ID = 'preview-responsive-user';
const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844, orientation: 'portrait' },
  { name: '844x390', width: 844, height: 390, orientation: 'landscape' },
];
const PROJECTS = [
  {
    slug: 'thorez-promotion',
    file: 'docs/examples/thorez-mickael-enseigne-promotion.json',
  },
  {
    slug: 'valombre-hero-adventure',
    file: 'docs/examples/acte-1-valombre-hero-adventure.json',
  },
];
const CRITICAL_CTA_SELECTOR = [
  '.player-mobile-orientation-card button',
  '.player-mobile-actions button',
  '.player-mobile-action-menu button',
  '.player-narration-bar p[role="button"]',
  '.player-narration-bar button',
  '.player-drawer-actions button',
  '.hero-setup-actions button',
  '.overlay-card .panel-head button',
  '.conversation-player-card button',
  '#enigma-overlay button',
].join(',');
const TOUCH_TARGET_SELECTOR = [
  '.player-mobile-orientation-card button',
  '.player-actions button',
  '.player-mobile-actions button',
  '.player-mobile-action-menu button',
  '.player-narration-bar p[role="button"]',
  '.player-narration-bar button',
  '.player-drawer-actions button',
  '.hero-setup-actions button',
  '.hero-setup-gallery-arrow',
  '.hero-setup-die-wrap',
  '.overlay-card .panel-head button',
  '.conversation-player-card button',
  '#enigma-overlay button',
].join(',');
const MIN_TOUCH_TARGET = 32;

function loadExampleProject(file) {
  return JSON.parse(readFileSync(path.join(process.cwd(), file), 'utf8'));
}

async function seedPublicProject(page, { userId, projectId, project }) {
  await page.addInitScript(({ localUserId, localProjectId, seededProject }) => {
    const now = '2026-06-06T00:00:00.000Z';
    const record = {
      id: localProjectId,
      name: seededProject.title || seededProject.name || localProjectId,
      createdAt: now,
      updatedAt: now,
      data: seededProject,
      shareState: {
        isPublic: true,
        publishedAt: now,
        copiedAt: now,
        publishedName: seededProject.title || seededProject.name || localProjectId,
        publishedData: seededProject,
      },
    };
    window.localStorage.setItem(`escapeGameBuilder.projects.${localUserId}`, JSON.stringify([record]));
  }, { localUserId: userId, localProjectId: projectId, seededProject: project });
}

async function openSeededPreview(page, projectCase, viewport) {
  const project = loadExampleProject(projectCase.file);
  const userId = `${QA_USER_ID}-${projectCase.slug}`;
  const projectId = `${projectCase.slug}-public`;

  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await seedPublicProject(page, { userId, projectId, project });
  await page.goto(`/?playUser=${userId}&playProject=${projectId}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.player-shell.is-shared-player')).toBeVisible();
  await expect(page.locator('.scene-player')).toBeVisible();
}

async function assertNoDocumentHorizontalScroll(page) {
  const metrics = await page.evaluate(() => {
    const documentElement = document.documentElement;
    const body = document.body;
    return {
      viewportWidth: window.innerWidth,
      documentScrollWidth: documentElement.scrollWidth,
      bodyScrollWidth: body?.scrollWidth || 0,
      bodyClientWidth: body?.clientWidth || 0,
    };
  });

  expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

async function getVisibleTargetMetrics(page, selector) {
  return page.evaluate((visibleSelector) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    return Array.from(document.querySelectorAll(visibleSelector))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const disabled = element instanceof HTMLButtonElement && element.disabled;
        return !disabled
          && style.display !== 'none'
          && style.visibility !== 'hidden'
          && Number(style.opacity || 1) > 0.05
          && rect.width > 1
          && rect.height > 1;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const label = element.getAttribute('aria-label')
          || element.textContent?.replace(/\s+/g, ' ').trim()
          || element.className
          || element.tagName;
        return {
          label,
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
          viewportWidth,
          viewportHeight,
        };
      });
  }, selector);
}

async function getReachableTargetMetrics(page, selector) {
  return page.evaluate((visibleSelector) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isReachableOnScreen = (element, rect) => {
      const insetX = Math.min(8, Math.max(1, rect.width / 2));
      const insetY = Math.min(8, Math.max(1, rect.height / 2));
      const points = [
        [rect.left + rect.width / 2, rect.top + rect.height / 2],
        [rect.left + insetX, rect.top + insetY],
        [rect.right - insetX, rect.top + insetY],
        [rect.left + insetX, rect.bottom - insetY],
        [rect.right - insetX, rect.bottom - insetY],
      ];
      return points.some(([x, y]) => {
        if (x < 0 || y < 0 || x > viewportWidth || y > viewportHeight) return false;
        const topElement = document.elementFromPoint(x, y);
        return topElement && (topElement === element || element.contains(topElement));
      });
    };

    return Array.from(document.querySelectorAll(visibleSelector))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const disabled = element instanceof HTMLButtonElement && element.disabled;
        return !disabled
          && style.display !== 'none'
          && style.visibility !== 'hidden'
          && Number(style.opacity || 1) > 0.05
          && rect.width > 1
          && rect.height > 1
          && isReachableOnScreen(element, rect);
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const label = element.getAttribute('aria-label')
          || element.textContent?.replace(/\s+/g, ' ').trim()
          || element.className
          || element.tagName;
        return {
          label,
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
          viewportWidth,
          viewportHeight,
        };
      });
  }, selector);
}

async function assertCriticalCtasInViewport(page, selector = CRITICAL_CTA_SELECTOR) {
  const targets = await getVisibleTargetMetrics(page, selector);
  expect(targets.length).toBeGreaterThan(0);

  for (const target of targets) {
    expect.soft(target.left, `${target.label} left`).toBeGreaterThanOrEqual(0);
    expect.soft(target.top, `${target.label} top`).toBeGreaterThanOrEqual(0);
    expect.soft(target.right, `${target.label} right`).toBeLessThanOrEqual(target.viewportWidth);
    expect.soft(target.bottom, `${target.label} bottom`).toBeLessThanOrEqual(target.viewportHeight);
  }
}

async function assertVisibleButtonsHaveTouchTargets(page, selector = TOUCH_TARGET_SELECTOR) {
  const targets = await getReachableTargetMetrics(page, selector);
  expect(targets.length).toBeGreaterThan(0);

  for (const target of targets) {
    expect.soft(target.width, `${target.label} width`).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect.soft(target.height, `${target.label} height`).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  }
}

async function captureMobilePreview(page, projectCase, viewport, suffix) {
  mkdirSync(MOBILE_PREVIEW_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(MOBILE_PREVIEW_DIR, `${projectCase.slug}-${viewport.name}-${suffix}.png`),
    fullPage: true,
  });
}

test.describe('Preview player responsive QA with example projects', () => {
  for (const projectCase of PROJECTS) {
    for (const viewport of VIEWPORTS) {
      test(`${projectCase.slug} stays usable at ${viewport.name}`, async ({ page }) => {
        await openSeededPreview(page, projectCase, viewport);
        await assertNoDocumentHorizontalScroll(page);

        if (viewport.orientation === 'portrait') {
          await expect(page.locator('.player-mobile-orientation-gate')).toBeVisible();
          await assertCriticalCtasInViewport(page, '.player-mobile-orientation-card button');
          await assertVisibleButtonsHaveTouchTargets(page, '.player-mobile-orientation-card button');
          await captureMobilePreview(page, projectCase, viewport, 'orientation-gate');

          await page.getByRole('button', { name: 'Continuer en portrait' }).click();
          await expect(page.locator('.player-mobile-orientation-gate')).not.toBeVisible();
        } else {
          await expect(page.locator('.player-mobile-orientation-gate')).not.toBeVisible();
        }

        await assertNoDocumentHorizontalScroll(page);
        await assertCriticalCtasInViewport(page);
        await assertVisibleButtonsHaveTouchTargets(page);
        await captureMobilePreview(page, projectCase, viewport, 'player');
      });
    }
  }
});
