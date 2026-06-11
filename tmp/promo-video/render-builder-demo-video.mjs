import { chromium } from "@playwright/test";
import { mkdir, copyFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const promoDir = path.join(root, "tmp", "promo-video");
const outputDir = path.join(promoDir, "builder-demo-output");
const htmlPath = path.join(promoDir, "builder-demo.html");
const finalVideoPath = path.join(promoDir, "escape-game-studio-builder-demo.webm");
const previewStartPath = path.join(promoDir, "builder-demo-start.png");
const previewMovePath = path.join(promoDir, "builder-demo-move-zone.png");
const previewScenePath = path.join(promoDir, "builder-demo-change-scene.png");
const previewPlayerPath = path.join(promoDir, "builder-demo-preview.png");

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: outputDir,
    size: { width: 1280, height: 720 },
  },
});

const page = await context.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
await page.evaluate(() => document.fonts?.ready);
await page.screenshot({ path: previewStartPath });
await page.waitForTimeout(16500);
await page.screenshot({ path: previewMovePath });
await page.waitForTimeout(4500);
await page.screenshot({ path: previewScenePath });
await page.waitForTimeout(22500);
await page.screenshot({ path: previewPlayerPath });
await page.waitForTimeout(4500);

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
console.log(`Preview ${previewStartPath}`);
console.log(`Preview ${previewMovePath}`);
console.log(`Preview ${previewScenePath}`);
console.log(`Preview ${previewPlayerPath}`);
