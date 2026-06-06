#!/usr/bin/env python3
# Screenshot script for Phase 2B.2 — safe-mode screenshots (mock generation)

import os
import sys

# Use the venv playwright
venv_playwright = '/home/ubuntu/.hermes/workspace/tools/pixelle-video/.venv/lib/python3.11/site-packages/playwright'
sys.path.insert(0, venv_playwright)

from playwright.sync_api import sync_playwright
from pathlib import Path

BASE = 'http://localhost:5174'
OUT = Path('docs/screenshots')
OUT.mkdir(parents=True, exist_ok=True)

DELAY_MS = 1500

def screenshot(browser, url, filepath, viewport=None):
    page = browser.new_page()
    if viewport:
        page.set_viewport_size(viewport)
    page.goto(url, wait_until='networkidle', timeout=15000)
    page.wait_for_timeout(DELAY_MS)
    page.screenshot(path=str(filepath), full_page=False)
    print(f'  ✓ {filepath}')
    page.close()

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path='/snap/bin/chromium',
        args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    )

    print('Taking Phase 2B.2 screenshots...')

    # ── Mobile (390×844) ─────────────────────────────────────────────────────
    mobile = {'width': 390, 'height': 844}

    # 1. Library - mock tracks (mobile)
    screenshot(browser, f'{BASE}/#/library', OUT / 'library-generated-mobile.png', mobile)

    # 2. Settings - safe mode (mobile)
    screenshot(browser, f'{BASE}/#/settings', OUT / 'settings-safe-mode-mobile.png', mobile)

    # 3. Studio (mobile) — default state
    screenshot(browser, f'{BASE}/#/studio', OUT / 'studio-generated-mobile.png', mobile)

    # ── Desktop (1440×1000) ───────────────────────────────────────────────────
    desktop = {'width': 1440, 'height': 1000}

    # 4. Studio (desktop)
    screenshot(browser, f'{BASE}/#/studio', OUT / 'studio-generated-desktop.png', desktop)

    # 5. Library (desktop)
    screenshot(browser, f'{BASE}/#/library', OUT / 'library-generated-desktop.png', desktop)

    # 6. Settings (desktop)
    screenshot(browser, f'{BASE}/#/settings', OUT / 'settings-safe-mode-desktop.png', desktop)

    browser.close()

print('\nDone. Screenshots saved to docs/screenshots/')