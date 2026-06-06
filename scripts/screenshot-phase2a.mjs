#!/usr/bin/env node
// Screenshot script for Phase 2A — generates mock → real track screenshots

import { chromium } from 'playwright';

const BASE = 'http://localhost:5174';
const OUT = 'docs/screenshots';
const DELAY = 1500;

// ── helpers ────────────────────────────────────────────────────────────────────

async function screenshot(browser, url, filepath, opts = {}) {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(DELAY);
  await page.screenshot({ path: filepath, fullPage: false, ...opts });
  console.log(`  ✓ ${filepath}`);
  await page.close();
}

// ── Desktop (1440×900 viewport) ────────────────────────────────────────────────

async function desktopScreenshots(browser) {
  const v = { width: 1440, height: 900 };

  // Home
  {
    const page = await browser.newPage();
    await page.setViewportSize(v);
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(DELAY);
    await page.screenshot({ path: `${OUT}/home-desktop.png` });
    console.log(`  ✓ home-desktop.png`);
    await page.close();
  }

  // Studio (pure-music, default)
  {
    const page = await browser.newPage();
    await page.setViewportSize(v);
    await page.goto(`${BASE}/studio`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(DELAY);
    await page.screenshot({ path: `${OUT}/studio-desktop.png` });
    console.log(`  ✓ studio-desktop.png`);
    await page.close();
  }

  // Trigger generate on studio page
  {
    const page = await browser.newPage();
    await page.setViewportSize(v);
    await page.goto(`${BASE}/studio`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(DELAY);

    // Fill prompt
    const textarea = page.locator('textarea').first();
    await textarea.fill('深夜编程氛围音乐，温暖舒适');

    // Click generate
    await page.locator('button').filter({ hasText: '生成纯音乐' }).click();

    // Wait for generation to complete (1.5s total in mock)
    await page.waitForTimeout(2500);

    await page.screenshot({ path: `${OUT}/studio-generated-desktop.png` });
    console.log(`  ✓ studio-generated-desktop.png`);
    await page.close();
  }

  // Studio #lyrics
  {
    const page = await browser.newPage();
    await page.setViewportSize(v);
    await page.goto(`${BASE}/studio#lyrics`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(DELAY);
    await page.screenshot({ path: `${OUT}/studio-lyrics-desktop.png` });
    console.log(`  ✓ studio-lyrics-desktop.png`);
    await page.close();
  }

  // Settings
  {
    const page = await browser.newPage();
    await page.setViewportSize(v);
    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(DELAY);
    await page.screenshot({ path: `${OUT}/settings-desktop.png` });
    console.log(`  ✓ settings-desktop.png`);
    await page.close();
  }
}

// ── Mobile (390×844) ──────────────────────────────────────────────────────────

async function mobileScreenshots(browser) {
  const v = { width: 390, height: 844 };

  // Home
  {
    const page = await browser.newPage();
    await page.setViewportSize(v);
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(DELAY);
    await page.screenshot({ path: `${OUT}/home-mobile.png` });
    console.log(`  ✓ home-mobile.png`);
    await page.close();
  }

  // Studio (pure-music)
  {
    const page = await browser.newPage();
    await page.setViewportSize(v);
    await page.goto(`${BASE}/studio`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(DELAY);
    await page.screenshot({ path: `${OUT}/studio-mobile.png` });
    console.log(`  ✓ studio-mobile.png`);
    await page.close();
  }

  // Trigger generate on mobile studio
  {
    const page = await browser.newPage();
    await page.setViewportSize(v);
    await page.goto(`${BASE}/studio`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(DELAY);

    const textarea = page.locator('textarea').first();
    await textarea.fill('城市夜景氛围，霓虹与安静');

    await page.locator('button').filter({ hasText: '生成纯音乐' }).click();
    await page.waitForTimeout(2500);

    await page.screenshot({ path: `${OUT}/studio-generated-mobile.png` });
    console.log(`  ✓ studio-generated-mobile.png`);
    await page.close();
  }

  // Library
  {
    const page = await browser.newPage();
    await page.setViewportSize(v);
    await page.goto(`${BASE}/library`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(DELAY);
    await page.screenshot({ path: `${OUT}/library-mobile.png` });
    console.log(`  ✓ library-mobile.png`);
    await page.close();
  }

  // Settings
  {
    const page = await browser.newPage();
    await page.setViewportSize(v);
    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(DELAY);
    await page.screenshot({ path: `${OUT}/settings-mobile.png` });
    console.log(`  ✓ settings-mobile.png`);
    await page.close();
  }

  // Docs
  {
    const page = await browser.newPage();
    await page.setViewportSize(v);
    await page.goto(`${BASE}/docs`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(DELAY);
    await page.screenshot({ path: `${OUT}/docs-mobile.png` });
    console.log(`  ✓ docs-mobile.png`);
    await page.close();
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const { execSync } = await import('child_process');
execSync('mkdir -p ' + OUT);

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium-browser',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  headless: true,
});

console.log('\n── Desktop screenshots ──');
await desktopScreenshots(browser);

console.log('\n── Mobile screenshots ──');
await mobileScreenshots(browser);

await browser.close();
console.log('\nDone.\n');
