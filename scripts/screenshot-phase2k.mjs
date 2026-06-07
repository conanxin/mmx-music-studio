#!/usr/bin/env node
// Screenshot script for Phase 2K — using snap chromium

import { chromium } from '/home/ubuntu/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:8787';
const OUT = 'docs/screenshots';

mkdirSync(OUT, { recursive: true });

async function screenshot(browser, url, filepath, viewport) {
  const page = await browser.newPage();
  await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`  ✓ ${filepath}`);
  await page.close();
}

const browser = await chromium.launch({
  executablePath: '/snap/bin/chromium',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});

console.log('Taking Phase 2K screenshots...');

const desktop = { width: 1280, height: 800 };
const mobile  = { width: 390, height: 844 };

await screenshot(browser, `${BASE}/#/studio`,  `${OUT}/studio-desktop-phase2k.png`, desktop);
await screenshot(browser, `${BASE}/#/library`, `${OUT}/library-desktop-phase2k.png`, desktop);
await screenshot(browser, `${BASE}/#/studio`,  `${OUT}/studio-mobile-phase2k.png`,  mobile);
await screenshot(browser, `${BASE}/#/library`, `${OUT}/library-mobile-phase2k.png`, mobile);

await browser.close();
console.log('\nDone.');