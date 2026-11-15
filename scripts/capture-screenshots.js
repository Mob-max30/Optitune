/**
 * Earth Jukebox (EJB) — Screenshot Capture Suite
 * Specification: Amendment B, Section 12 & Gate B8
 */

import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const screenshotsDir = path.join(rootDir, 'docs', 'ui', 'screenshots');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function createStaticServer() {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.json': 'application/json'
  };

  const server = http.createServer((req, res) => {
    let safePath = path.normalize(decodeURIComponent(req.url.split('?')[0]));
    if (safePath === '/') safePath = '/demo-page/dist/index.html';
    const filePath = path.join(rootDir, safePath);

    if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

async function main() {
  const { server, port } = await createStaticServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Capture] Static server running at ${baseUrl}`);

  console.log('[Capture] Launching Chrome via Playwright-core...');
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    deviceScaleFactor: 2
  });

  // 1. Popup Screenshots
  console.log('[Capture] Capturing Popup surfaces...');
  const popupPage = await context.newPage();
  await popupPage.setViewportSize({ width: 380, height: 500 });
  await popupPage.goto(`${baseUrl}/extension/dist/popup.html`);
  await popupPage.waitForTimeout(500);
  await popupPage.screenshot({ path: path.join(screenshotsDir, 'popup-idle.png') });

  // Simulate unsupported state
  await popupPage.evaluate(() => {
    const emptyEl = document.getElementById('emptyState');
    const mainEl = document.getElementById('mainControls');
    const titleEl = document.getElementById('sourceTitle');
    const chipEl = document.getElementById('provenanceChip');
    if (emptyEl && mainEl) {
      emptyEl.style.display = 'block';
      mainEl.style.display = 'none';
      if (titleEl) titleEl.textContent = 'No NASA visualization detected';
      if (chipEl) chipEl.style.display = 'none';
    }
  });
  await popupPage.screenshot({ path: path.join(screenshotsDir, 'popup-unsupported.png') });
  await popupPage.close();

  // 2. Listening Room (Demo Studio) Screenshots across 4 Phenomenon Tints
  console.log('[Capture] Capturing Listening Room across phenomenon tints...');
  const roomPage = await context.newPage();
  await roomPage.setViewportSize({ width: 1280, height: 850 });
  await roomPage.goto(`${baseUrl}/demo-page/dist/index.html`);
  await roomPage.waitForTimeout(800);

  // 2a. Canopy / Biosphere
  await roomPage.screenshot({ path: path.join(screenshotsDir, 'listening-room-canopy.png') });

  // 2b. Fire / Thermal
  await roomPage.selectOption('#demoPresetSelect', 'thermal-fire');
  await roomPage.waitForTimeout(600);
  await roomPage.screenshot({ path: path.join(screenshotsDir, 'listening-room-fire.png') });

  // 2c. Ocean / SST
  await roomPage.selectOption('#demoPresetSelect', 'sst-currents');
  await roomPage.waitForTimeout(600);
  await roomPage.screenshot({ path: path.join(screenshotsDir, 'listening-room-ocean.png') });

  // 2d. Night Lights / Urban
  await roomPage.selectOption('#demoPresetSelect', 'night-lights');
  await roomPage.waitForTimeout(600);
  await roomPage.screenshot({ path: path.join(screenshotsDir, 'listening-room-lights.png') });

  // 2e. Data View Table Toggle
  await roomPage.click('#btnToggleTable');
  await roomPage.waitForTimeout(400);
  await roomPage.screenshot({ path: path.join(screenshotsDir, 'listening-room-dataview.png') });
  await roomPage.click('#btnToggleTable'); // toggle back

  // 2f. Keyboard Shortcuts Modal ('?')
  await roomPage.click('#btnShortcuts');
  await roomPage.waitForTimeout(400);
  await roomPage.screenshot({ path: path.join(screenshotsDir, 'listening-room-shortcuts.png') });
  await roomPage.click('#btnCloseModal');

  // 2g. Presentation Mode ('P')
  await roomPage.click('#btnPresentation');
  await roomPage.waitForTimeout(400);
  await roomPage.screenshot({ path: path.join(screenshotsDir, 'listening-room-presentation.png') });

  await roomPage.close();
  await browser.close();
  server.close();
  console.log('[Capture] All screenshots saved to docs/ui/screenshots/ successfully!');
}

main().catch(err => {
  console.error('[Capture Error]', err);
  process.exit(1);
});
