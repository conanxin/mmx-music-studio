#!/usr/bin/env node
// Phase 2J mobile screenshots — new build with overflow-x fix
// Using localhost (snap chromium can't reach public IP)

import { chromium } from '/home/ubuntu/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:8787';
const OUT = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });

async function screenshot(browser, url, filepath, viewport) {
  const page = await browser.newPage();
  await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`  ✓ ${filepath}`);
  await page.close();
}

const browser = await chromium.launch({
  executablePath: '/snap/bin/chromium',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});

console.log('Phase 2J mobile screenshots...');

const mobile  = { width: 390, height: 844 };
const desktop = { width: 1280, height: 800 };

// Mobile
await screenshot(browser, `${BASE}/#/home`,      `${OUT}/mobile-home-phase2j.png`,     mobile);
await screenshot(browser, `${BASE}/#/studio`,   `${OUT}/mobile-studio-phase2j.png`,   mobile);
await screenshot(browser, `${BASE}/#/library`, `${OUT}/mobile-library-phase2j.png`,   mobile);
await screenshot(browser, `${BASE}/#/settings`, `${OUT}/mobile-settings-phase2j.png`,  mobile);
await screenshot(browser, `${BASE}/#/docs`,    `${OUT}/mobile-docs-phase2j.png`,     mobile);

// Desktop (for contact sheet update)
await screenshot(browser, `${BASE}/#/home`,    `${OUT}/home-desktop-phase2j.png`,    desktop);
await screenshot(browser, `${BASE}/#/studio`, `${OUT}/studio-desktop-phase2j.png`,  desktop);
await screenshot(browser, `${BASE}/#/library`, `${OUT}/library-desktop-phase2j.png`, desktop);
await screenshot(browser, `${BASE}/#/settings`,`${OUT}/settings-desktop-phase2j.png`,desktop);

await browser.close();
console.log('\nDone.');