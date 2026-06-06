
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/snap/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const pages = [
    { url: 'http://localhost:5174/', file: 'docs/screenshots/home-desktop.png', width: 1440, height: 1000 },
    { url: 'http://localhost:5174/', file: 'docs/screenshots/home-mobile.png', width: 390, height: 844 },
    { url: 'http://localhost:5174/studio', file: 'docs/screenshots/studio-desktop.png', width: 1440, height: 1000 },
    { url: 'http://localhost:5174/studio', file: 'docs/screenshots/studio-mobile.png', width: 390, height: 844 },
    { url: 'http://localhost:5174/library', file: 'docs/screenshots/library-mobile.png', width: 390, height: 844 },
    { url: 'http://localhost:5174/settings', file: 'docs/screenshots/settings-mobile.png', width: 390, height: 844 },
    { url: 'http://localhost:5174/docs', file: 'docs/screenshots/docs-mobile.png', width: 390, height: 844 },
  ];

  for (const p of pages) {
    const context = await browser.newContext({ viewport: { width: p.width, height: p.height } });
    const page = await context.newPage();
    try {
      await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: p.file, fullPage: false });
      const size = require('fs').statSync(p.file).size;
      console.log('OK |', p.file, '|', p.width + 'x' + p.height, '|', Math.round(size/1024) + 'KB');
    } catch(e) {
      console.log('FAIL |', p.file, '|', e.message);
    }
    await context.close();
  }

  await browser.close();
  console.log('Done.');
})();
