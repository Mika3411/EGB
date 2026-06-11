import { chromium } from "@playwright/test";
import { mkdir, copyFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const promoDir = path.join(root, "tmp", "promo-video");
const outputDir = path.join(promoDir, "real-builder-output");
const finalVideoPath = path.join(promoDir, "escape-game-studio-real-builder-demo.webm");
const previewFullscreenPath = path.join(promoDir, "real-builder-fullscreen.png");
const previewZonePath = path.join(promoDir, "real-builder-zone-created.png");
const previewTargetPath = path.join(promoDir, "real-builder-target-scene.png");
const previewPlayerPath = path.join(promoDir, "real-builder-preview-transition.png");

await mkdir(outputDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: outputDir,
    size: { width: 1600, height: 900 },
  },
});

await context.addInitScript(() => {
  localStorage.setItem("escapeGameBuilder.appUiState.v1", JSON.stringify({
    screen: "builder",
    builderScreen: "editor",
    projectId: "demo-project",
    tab: "scenes",
    demoMode: true,
    updatedAt: new Date().toISOString(),
  }));
});

const page = await context.newPage();
let cursor = { x: 1320, y: 56 };

async function installRecordingCursor() {
  await page.addStyleTag({
    content: `
      #recording-cursor {
        position: fixed;
        left: 0;
        top: 0;
        z-index: 2147483647;
        width: 30px;
        height: 30px;
        pointer-events: none;
        transform: translate(${cursor.x}px, ${cursor.y}px);
        transition: transform 160ms cubic-bezier(.2,.8,.2,1);
      }
      #recording-cursor svg {
        display: block;
        width: 30px;
        height: 30px;
        filter: drop-shadow(0 6px 14px rgba(0, 0, 0, .58));
      }
      .recording-click-ring {
        position: fixed;
        z-index: 2147483646;
        width: 44px;
        height: 44px;
        margin-left: -7px;
        margin-top: -7px;
        border: 2px solid #42d2bd;
        border-radius: 999px;
        pointer-events: none;
        animation: recording-click .48s ease-out forwards;
      }
      @keyframes recording-click {
        from { opacity: .9; transform: scale(.55); }
        to { opacity: 0; transform: scale(1.35); }
      }
    `,
  });
  await page.evaluate(({ x, y }) => {
    const cursorEl = document.createElement("div");
    cursorEl.id = "recording-cursor";
    cursorEl.innerHTML = `
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M6 4L25 19.6L16.4 21.1L12.1 28L6 4Z" fill="#fff7e9" stroke="#061018" stroke-width="2" stroke-linejoin="round" />
      </svg>
    `;
    cursorEl.style.transform = `translate(${x}px, ${y}px)`;
    document.body.appendChild(cursorEl);
  }, cursor);
}

async function moveCursorTo(x, y, steps = 18) {
  await page.mouse.move(cursor.x, cursor.y);
  await page.mouse.move(x, y, { steps });
  cursor = { x, y };
  await page.evaluate(({ x: nextX, y: nextY }) => {
    const cursorEl = document.querySelector("#recording-cursor");
    if (cursorEl) cursorEl.style.transform = `translate(${nextX}px, ${nextY}px)`;
  }, cursor);
  await sleep(180);
}

async function clickRing() {
  await page.evaluate(({ x, y }) => {
    const ring = document.createElement("div");
    ring.className = "recording-click-ring";
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    document.body.appendChild(ring);
    window.setTimeout(() => ring.remove(), 520);
  }, cursor);
}

async function clickLocator(locator, options = {}) {
  const box = await locator.boundingBox({ timeout: options.timeout || 5000 });
  if (!box) throw new Error("Target locator has no bounding box.");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await moveCursorTo(x, y, options.steps || 18);
  await clickRing();
  await page.mouse.click(x, y);
  await sleep(options.pause ?? 500);
}

async function dragLocator(locator, dx, dy) {
  const box = await locator.boundingBox({ timeout: 5000 });
  if (!box) throw new Error("Drag target has no bounding box.");
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  const endX = startX + dx;
  const endY = startY + dy;
  await moveCursorTo(startX, startY, 18);
  await page.mouse.down();
  await page.evaluate(() => {
    const cursorEl = document.querySelector("#recording-cursor");
    if (cursorEl) cursorEl.style.transition = "transform 80ms linear";
  });
  const steps = 28;
  for (let step = 1; step <= steps; step += 1) {
    const nextX = startX + (dx * step) / steps;
    const nextY = startY + (dy * step) / steps;
    cursor = { x: nextX, y: nextY };
    await page.mouse.move(nextX, nextY);
    await page.evaluate(({ x, y }) => {
      const cursorEl = document.querySelector("#recording-cursor");
      if (cursorEl) cursorEl.style.transform = `translate(${x}px, ${y}px)`;
    }, cursor);
    await sleep(28);
  }
  await page.mouse.up();
  await page.evaluate(() => {
    const cursorEl = document.querySelector("#recording-cursor");
    if (cursorEl) cursorEl.style.transition = "transform 160ms cubic-bezier(.2,.8,.2,1)";
  });
  await sleep(700);
}

await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.locator('[data-tour="scene-canvas"]').waitFor({ state: "visible", timeout: 30000 });
await page.waitForTimeout(1200);
await installRecordingCursor();

await page.locator(".builder-demo-guide-dismiss").click({ timeout: 5000 }).catch(() => {});
await sleep(900);

await clickLocator(page.getByRole("button", { name: "Plein écran" }).first(), { pause: 1300 });
await page.screenshot({ path: previewFullscreenPath, fullPage: false });

const addMenu = page.locator('details[data-tour="scene-add-menu"]').nth(1);
await clickLocator(addMenu.locator("summary"), { pause: 650 });
await clickLocator(addMenu.locator('[data-tour="scene-add-hotspot"]'), { pause: 900 });

const newZone = page.locator(".fullscreen-scene-content .editor-hotspot", { hasText: "Nouvelle zone" }).first();
await newZone.waitFor({ state: "visible", timeout: 5000 });
await clickLocator(page.locator('.fullscreen-context-panel [data-tour="hotspot-name"]'), { pause: 200 });
await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
await page.keyboard.type("Passage secret", { delay: 35 });
await sleep(700);

await clickLocator(page.locator('.fullscreen-context-panel [data-tour="hotspot-dialogue"]'), { pause: 200 });
await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
await page.keyboard.type("Le passage s'ouvre vers la salle des artefacts.", { delay: 18 });
await sleep(800);

const secretZone = page.locator(".fullscreen-scene-content .editor-hotspot", { hasText: "Passage secret" }).first();
await dragLocator(secretZone, 340, 50);
await page.screenshot({ path: previewZonePath, fullPage: false });

await clickLocator(page.locator(".fullscreen-scene-stage .scene-canvas-toolbar-select-trigger").last(), { pause: 500 });
await clickLocator(page.locator(".scene-canvas-toolbar-select-option").filter({ hasText: "Changer de scène" }).last(), { pause: 800 });

const targetSceneSelect = page.locator('.fullscreen-context-panel [data-tour="hotspot-target-scene"]');
await targetSceneSelect.selectOption({ label: "Nuit au musee · Sous-scène · Salle des artefacts" });
const targetBox = await targetSceneSelect.boundingBox();
if (targetBox) {
  await moveCursorTo(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, 10);
  await clickRing();
}
await sleep(1200);
await page.screenshot({ path: previewTargetPath, fullPage: false });

await clickLocator(page.getByRole("button", { name: "Tester la zone" }).last(), { pause: 2200 });
await page.getByRole("button", { name: "Passage secret" }).waitFor({ state: "visible", timeout: 7000 });
await sleep(1000);

await clickLocator(page.getByRole("button", { name: "Passage secret" }), { pause: 2200 });
await page.getByText("Salle des artefacts", { exact: false }).first().waitFor({ state: "visible", timeout: 7000 });
await page.screenshot({ path: previewPlayerPath, fullPage: false });
await sleep(2600);

const video = page.video();
await context.close();

if (!video) {
  throw new Error("Playwright did not produce a video file.");
}

const recordedPath = await video.path();
await copyFile(recordedPath, finalVideoPath);
await browser.close();

const videoStats = await stat(finalVideoPath);
console.log(`Rendered ${finalVideoPath}`);
console.log(`Size ${(videoStats.size / 1024 / 1024).toFixed(2)} MB`);
console.log(`Preview ${previewFullscreenPath}`);
console.log(`Preview ${previewZonePath}`);
console.log(`Preview ${previewTargetPath}`);
console.log(`Preview ${previewPlayerPath}`);
