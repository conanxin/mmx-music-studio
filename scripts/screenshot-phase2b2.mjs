#!/usr/bin/env node
// Screenshot script for Phase 2B.2 — safe-mode screenshots (mock generation)

import { chromium } from '/home/ubuntu/.hermes/hermes-agent/node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:5174';
const OUT = 'docs/screenshots';

// Ensure output dir
mkdirSync(OUT, { recursive: true });

async function screenshot(browser, url, filepath, opts = {}) {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: filepath, fullPage: false, ...opts });
  console.log(`  ✓ ${filepath}`);
  await page.close();
}

const browser = await chromium.launch({
  executablePath: '/snap/bin/chromium',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

console.log('Taking Phase 2B.2 screenshots...');

// ── Mobile (390×844) ─────────────────────────────────────────────────────────
const mobile = { width: 390, height: 844 };

// 1. Studio - generate success state (mobile)
{
  const page = await browser.newPage();
  await page.setViewportSize(mobile);
  await page.goto(`${BASE}/#/studio`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  // Simulate a generated state by navigating after API creates a track
  await page.goto(`${BASE}/#/library`, { waitUntil: 'networkidle', timeout: 10000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/library-generated-mobile.png` });
  console.log(`  ✓ library-generated-mobile.png`);
  await page.close();
}

// 2. Library with mock tracks (mobile)
{
  const page = await browser.newPage();
  await page.setViewportSize(mobile);
  await page.goto(`${BASE}/#/library`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/library-generated-mobile.png` });
  console.log(`  ✓ library-generated-mobile.png`);
  await page.close();
}

// 3. Settings - safe mode (mobile)
{
  const page = await browser.newPage();
  await page.setViewportSize(mobile);
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/settings-safe-mode-mobile.png` });
  console.log(`  ✓ settings-safe-mode-mobile.png`);
  await page.close();
}

// ── Desktop (1440×1000) ──────────────────────────────────────────────────────
const desktop = { width: 1440, height: 1000 };

// 4. Studio - generate success (desktop)
{
  const page = await browser.newPage();
  await page.setViewportSize(desktop);
  await page.goto(`${BASE}/#/studio`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/studio-generated-desktop.png` });
  console.log(`  ✓ studio-generated-desktop.png`);
  await page.close();
}

// 5. Library with mock tracks (desktop)
{
  const page = await browser.newPage();
  await page.setViewportSize(desktop);
  await page.goto(`${BASE}/#/library`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/library-generated-desktop.png` });
  console.log(`  ✓ library-generated-desktop.png`);
  await page.close();
}

// 6. Settings safe mode (desktop)
{
  const page = await browser.newPage();
  await page.setViewportSize(desktop);
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/settings-safe-mode-desktop.png` });
  console.log(`  ✓ settings-safe-mode-desktop.png`);
  await page.close();
}

await browser.close();
console.log('\nDone. Screenshots saved to docs/screenshots/');