#!/usr/bin/env bash
#
# Read-only production BYOK live readiness smoke.
#
# This script performs one GET request to /api/health. It never sends
# Authorization, never sends a BYOK key, never submits generation, never
# calls MiniMax, never reads env values, and never prints secret values.

set -euo pipefail

HEALTH_URL="${1:-https://music.conanxin.com/api/health}"

if [[ "$HEALTH_URL" == *"?"* || "$HEALTH_URL" == *"&"* ]]; then
  echo "FAIL: health URL must not include query parameters"
  exit 2
fi

if [[ "$HEALTH_URL" == *"/api/generate"* ]]; then
  echo "FAIL: refused to call a generation endpoint"
  exit 2
fi

if [[ "$HEALTH_URL" != http://*/api/health && "$HEALTH_URL" != https://*/api/health ]]; then
  echo "FAIL: expected a URL ending in /api/health"
  exit 2
fi

TMP_HEALTH="$(mktemp)"
cleanup() {
  rm -f "$TMP_HEALTH"
}
trap cleanup EXIT

curl -fsS "$HEALTH_URL" -o "$TMP_HEALTH"

node - "$TMP_HEALTH" <<'JS'
const fs = require('node:fs');

const file = process.argv[2];
const raw = fs.readFileSync(file, 'utf8');

if (/Authorization\s*:/i.test(raw) || /Bearer\s+[A-Za-z0-9._-]+/.test(raw) || /sk-[A-Za-z0-9_-]{12,}/.test(raw)) {
  console.log('FAIL: health response matched a secret-like leak pattern');
  process.exit(1);
}

let health;
try {
  health = JSON.parse(raw);
} catch (error) {
  console.log('FAIL: /api/health did not return valid JSON');
  process.exit(1);
}

const selectedFields = [
  'publicByokEnabled',
  'byokEnabled',
  'byokLiveEnabled',
  'byokLiveConfirmationConfigured',
  'byokLiveAttemptsRemaining',
  'byokLiveAudioRemaining',
  'byokLastSubmitStage',
  'byokSilentConsumeCount',
  'byokPendingConsumedAttempts',
  'turnstileByokRequired',
  'turnstileSecretKeyConfigured',
  'turnstileSiteKeyConfigured',
  'turnstileSiteKeyPresent',
  'realGenerationEnabled',
  'mockGenerationEnabled',
  'backend',
];

const safeValue = (value) => {
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 80);
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  return '[non-scalar]';
};

console.log('=== Prod BYOK Live Readiness Smoke ===');
for (const key of selectedFields) {
  console.log(`${key}=${safeValue(health[key])}`);
}

const blockers = [];

if (health.publicByokEnabled !== true) blockers.push('PUBLIC_BYOK_DISABLED');
if (health.byokLiveEnabled !== true) blockers.push('BYOK_LIVE_DISABLED');
if (health.byokLiveConfirmationConfigured !== true) blockers.push('OPERATOR_SECRET_STEP_NOT_CONFIRMED');
if (typeof health.byokLiveAttemptsRemaining === 'number' && health.byokLiveAttemptsRemaining < 1) {
  blockers.push('NO_LIVE_ATTEMPTS_REMAINING');
}
if (typeof health.byokLiveAudioRemaining === 'number' && health.byokLiveAudioRemaining < 1) {
  blockers.push('NO_LIVE_AUDIO_REMAINING');
}
if (health.turnstileByokRequired !== true) blockers.push('TURNSTILE_NOT_REQUIRED');
if (health.turnstileSecretKeyConfigured !== true) blockers.push('TURNSTILE_SECRET_NOT_CONFIGURED');
if (health.turnstileSiteKeyConfigured !== true && health.turnstileSiteKeyPresent !== true) {
  blockers.push('TURNSTILE_SITE_KEY_NOT_CONFIGURED');
}
if ((health.byokSilentConsumeCount ?? 0) !== 0) blockers.push('SILENT_CONSUME_PRESENT');
if ((health.byokPendingConsumedAttempts ?? 0) !== 0) blockers.push('PENDING_CONSUMED_ATTEMPTS_PRESENT');

let classification = 'READY_FOR_CONTROLLED_LIVE_PILOT_PREFLIGHT';
if (
  blockers.includes('OPERATOR_SECRET_STEP_NOT_CONFIRMED') ||
  blockers.includes('BYOK_LIVE_DISABLED') ||
  blockers.includes('PUBLIC_BYOK_DISABLED')
) {
  classification = 'NOT_READY_OPERATOR_SECRET_STEP_MISSING';
} else if (blockers.length > 0) {
  classification = 'NOT_READY_HEALTH_GATE_MISSING';
}

console.log(`classification=${classification}`);
console.log(`blockers=${blockers.length === 0 ? 'none' : blockers.join(',')}`);
console.log('generationSubmit=NO');
console.log('miniMaxCall=NO');
console.log('audioGenerated=NO');

process.exit(0);
JS
