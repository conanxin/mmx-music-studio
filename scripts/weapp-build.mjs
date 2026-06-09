#!/usr/bin/env node
/**
 * scripts/weapp-build.mjs — Deterministic WeApp build wrapper
 *
 * Replaces `npm --prefix apps/weapp run build:weapp` which is unstable in CI
 * (npm 10.9.8 on GitHub Actions runner fails to resolve workspace scripts).
 *
 * This wrapper:
 * - Locates the Taro CLI binary explicitly (no npx/npm prefix magic)
 * - Runs it from the apps/weapp directory
 * - Prints diagnostics for CI visibility
 * - Exits with the build's real exit code
 *
 * Safety:
 * - Does NOT call /api/generate or any real generation endpoint
 * - Does NOT read ~/.mmx / ~/.hermes / .env
 * - Does NOT print secrets
 * - Always prints what it runs (no hidden commands)
 */

import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const root        = resolve(__dirname, '..');
const weappDir    = resolve(root, 'apps/weapp');
const isWin = process.platform === 'win32';
const binName     = isWin ? 'taro.cmd' : 'taro';

const candidates = [
  join(root,      'node_modules', '.bin', binName),
  join(weappDir, 'node_modules', '.bin', binName),
];

function log(msg) {
  console.log(`[weapp-build] ${msg}`);
}

log(`root: ${root}`);
log(`weappDir:  ${weappDir}`);
log(`cwd:       ${process.cwd()}`);
log(`node:      ${process.version}`);
log(`platform:  ${process.platform}`);
log(`taro bins: ${candidates.map(p => `${p}:${existsSync(p) ? 'FOUND' : 'MISSING'}`).join(', ')}`);

if (!existsSync(weappDir)) {
  console.error('[weapp-build] ERROR: apps/weapp directory not found.');
  process.exit(1);
}

const taroBin = candidates.find(p => existsSync(p));
if (!taroBin) {
  console.error('[weapp-build] ERROR: Taro CLI binary not found.');
  console.error('[weapp-build] Expected one of:');
  for (const c of candidates) {
    console.error(`  - ${c}`);
  }
  console.error('[weapp-build] Run `npm ci` at repository root first.');
  process.exit(1);
}

log(`taro bin:  ${taroBin}`);
log(`running:   ${taroBin} build --type weapp`);

const result = spawnSync(taroBin, ['build', '--type', 'weapp'], {
  cwd:    weappDir,
  stdio:  'inherit',
  shell:  isWin,
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'production',
  },
});

if (result.error) {
  console.error('[weapp-build] ERROR: failed to spawn Taro CLI:', result.error.message);
  process.exit(1);
}

log(`taro exited with code: ${result.status ?? 'unknown'}`);
process.exit(result.status ?? 1);