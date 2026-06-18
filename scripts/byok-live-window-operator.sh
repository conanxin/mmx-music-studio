#!/usr/bin/env bash
#
# Operator-only BYOK live window helper.
#
# Defaults are dry-run. Only `--apply` writes systemd/env files or restarts the
# service. This script never accepts BYOK user keys, never submits generation,
# and never calls the MiniMax provider.

set -euo pipefail

SERVICE_NAME="${MMX_SERVICE_NAME:-mmx-music-studio}"
HEALTH_URL="${MMX_HEALTH_URL:-http://127.0.0.1:8787/api/health}"
ENV_DIR="${MMX_ENV_DIR:-/etc/mmx-music-studio}"
SYSTEMD_DROPIN_DIR="${MMX_SYSTEMD_DROPIN_DIR:-/etc/systemd/system/${SERVICE_NAME}.service.d}"
ENV_FILE="${ENV_DIR}/byok-live-pilot.env"
DROPIN_FILE="${SYSTEMD_DROPIN_DIR}/byok-live-pilot.conf"

DEFAULT_WINDOW_ID="h3b-$(date +%Y%m%d-%H%M%S)-selfuse"
WINDOW_ID="${MMX_BYOK_LIVE_WINDOW_ID:-$DEFAULT_WINDOW_ID}"
ATTEMPT_CAP="${MMX_BYOK_LIVE_ATTEMPT_CAP:-1}"
AUDIO_CAP="${MMX_BYOK_LIVE_AUDIO_CAP:-1}"
APPLY=false

usage() {
  cat <<'EOF'
BYOK live window operator helper

Usage:
  scripts/byok-live-window-operator.sh status
  scripts/byok-live-window-operator.sh open [--apply] [--window-id ID] [--attempts N] [--audio N]
  scripts/byok-live-window-operator.sh close [--apply]
  scripts/byok-live-window-operator.sh help

Operator-only safety:
  - Default mode is dry-run.
  - --apply is required before any system env/drop-in write or service restart.
  - This helper does not accept, store, or print MiniMax API keys.
  - This helper does not submit generation requests.
  - This helper does not call MiniMax.
  - Use close --apply immediately after a controlled one-shot window.

Configuration overrides:
  MMX_SERVICE_NAME              default: mmx-music-studio
  MMX_HEALTH_URL                default: http://127.0.0.1:8787/api/health
  MMX_ENV_DIR                   default: /etc/mmx-music-studio
  MMX_SYSTEMD_DROPIN_DIR        default: /etc/systemd/system/<service>.service.d
  MMX_BYOK_LIVE_WINDOW_ID       default: h3b-YYYYMMDD-HHMMSS-selfuse
  MMX_BYOK_LIVE_ATTEMPT_CAP     default: 1
  MMX_BYOK_LIVE_AUDIO_CAP       default: 1

Notes:
  - Turnstile is required for open windows.
  - The env file is written with mode 0600 when --apply is used.
  - Logs print names, paths, booleans, counters, and window ids only.
EOF
}

log() {
  printf '[byok-live-window-operator] %s\n' "$*"
}

die() {
  printf '[byok-live-window-operator] ERROR: %s\n' "$*" >&2
  exit 1
}

require_root_for_apply() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    die "open/close --apply must run as root or via sudo"
  fi
}

validate_health_url() {
  if [[ "$HEALTH_URL" == *"?"* || "$HEALTH_URL" == *"&"* ]]; then
    die "health URL must not include query parameters"
  fi
  if [[ "$HEALTH_URL" == *"/api/generate"* ]]; then
    die "refusing to call a generation endpoint"
  fi
  if [[ "$HEALTH_URL" != http://*/api/health && "$HEALTH_URL" != https://*/api/health ]]; then
    die "health URL must end with /api/health"
  fi
}

validate_positive_int() {
  local value="$1"
  local label="$2"
  if ! [[ "$value" =~ ^[1-9][0-9]*$ ]]; then
    die "$label must be a positive integer"
  fi
}

validate_window_id() {
  if ! [[ "$WINDOW_ID" =~ ^[A-Za-z0-9_.:-]+$ ]]; then
    die "window id may contain only letters, numbers, dot, underscore, colon, or dash"
  fi
}

tmp_file() {
  mktemp "${TMPDIR:-/tmp}/byok-live-window.XXXXXX"
}

fetch_health() {
  local out_file="$1"
  validate_health_url
  curl -fsS --max-time 12 "$HEALTH_URL" -o "$out_file"
}

print_health() {
  local health_file="$1"
  node - "$health_file" <<'JS'
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
} catch {
  console.log('FAIL: /api/health did not return valid JSON');
  process.exit(1);
}

const keys = [
  'publicByokEnabled',
  'byokEnabled',
  'byokLiveEnabled',
  'byokLiveConfirmationConfigured',
  'byokLiveAttemptLimitEnabled',
  'byokLiveMaxAttemptsPerWindow',
  'byokLiveAttemptsUsed',
  'byokLiveAttemptsRemaining',
  'byokLiveAudioCapEnabled',
  'byokLiveMaxAudioPerWindow',
  'byokLiveAudioUsed',
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

console.log('=== BYOK Live Window Health ===');
for (const key of keys) {
  console.log(`${key}=${safeValue(health[key])}`);
}
JS
}

assert_ready_preflight() {
  local health_file="$1"
  node - "$health_file" <<'JS'
const fs = require('node:fs');
const health = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const blockers = [];

if (health.publicByokEnabled !== true) blockers.push('PUBLIC_BYOK_DISABLED');
if (health.byokLiveEnabled !== true) blockers.push('BYOK_LIVE_DISABLED');
if (health.byokLiveConfirmationConfigured !== true) blockers.push('LIVE_CONFIRMATION_NOT_CONFIGURED');
if ((health.byokLiveAttemptsRemaining ?? 0) < 1) blockers.push('NO_ATTEMPTS_REMAINING');
if ((health.byokLiveAudioRemaining ?? 0) < 1) blockers.push('NO_AUDIO_REMAINING');
if (health.turnstileByokRequired !== true) blockers.push('TURNSTILE_NOT_REQUIRED');
if (health.turnstileSecretKeyConfigured !== true) blockers.push('TURNSTILE_SECRET_NOT_CONFIGURED');
if (health.turnstileSiteKeyConfigured !== true && health.turnstileSiteKeyPresent !== true) {
  blockers.push('TURNSTILE_SITE_KEY_NOT_CONFIGURED');
}
if ((health.byokSilentConsumeCount ?? 0) !== 0) blockers.push('SILENT_CONSUME_PRESENT');
if ((health.byokPendingConsumedAttempts ?? 0) !== 0) blockers.push('PENDING_CONSUMED_ATTEMPTS_PRESENT');

if (blockers.length > 0) {
  console.log(`classification=NOT_READY_HEALTH_GATE_MISSING`);
  console.log(`blockers=${blockers.join(',')}`);
  process.exit(1);
}
console.log('classification=READY_FOR_CONTROLLED_LIVE_PILOT_PREFLIGHT');
console.log('blockers=none');
JS
}

assert_safe_default() {
  local health_file="$1"
  node - "$health_file" <<'JS'
const fs = require('node:fs');
const health = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const blockers = [];

if (health.publicByokEnabled !== false) blockers.push('PUBLIC_BYOK_NOT_DISABLED');
if (health.byokLiveEnabled !== false) blockers.push('BYOK_LIVE_NOT_DISABLED');
if (health.byokLiveConfirmationConfigured !== false) blockers.push('LIVE_CONFIRMATION_STILL_CONFIGURED');

if (blockers.length > 0) {
  console.log('classification=NOT_SAFE_DEFAULT');
  console.log(`blockers=${blockers.join(',')}`);
  process.exit(1);
}
console.log('classification=SAFE_DEFAULT');
console.log('blockers=none');
JS
}

status() {
  local health_file
  health_file="$(tmp_file)"
  trap 'rm -f "$health_file"' RETURN
  fetch_health "$health_file"
  print_health "$health_file"
}

print_open_plan() {
  log "mode=DRY-RUN command=open"
  log "service=${SERVICE_NAME}"
  log "healthUrl=${HEALTH_URL}"
  log "windowId=${WINDOW_ID}"
  log "attemptCap=${ATTEMPT_CAP}"
  log "audioCap=${AUDIO_CAP}"
  log "turnstileRequired=true"
  log "wouldWriteEnvFile=${ENV_FILE} mode=0600"
  log "wouldWriteSystemdDropin=${DROPIN_FILE}"
  log "wouldRun=systemctl daemon-reload"
  log "wouldRun=systemctl restart ${SERVICE_NAME}"
  log "wouldVerify=READY_FOR_CONTROLLED_LIVE_PILOT_PREFLIGHT"
}

write_live_env() {
  local tmp_env
  tmp_env="$(tmp_file)"
  umask 077
  cat > "$tmp_env" <<EOF
PUBLIC_BYOK_ENABLED=true
BYOK_DRY_RUN_ONLY=false
BYOK_LIVE_ENABLED=true
BYOK_LIVE_CONFIRMATION=CONFIRM_BYOK_LIVE_RELAY_TEST
BYOK_LIVE_WINDOW_ID=${WINDOW_ID}
BYOK_LIVE_ATTEMPT_LIMIT_ENABLED=true
BYOK_LIVE_MAX_ATTEMPTS_PER_WINDOW=${ATTEMPT_CAP}
BYOK_LIVE_AUDIO_CAP_ENABLED=true
BYOK_LIVE_MAX_AUDIO_PER_WINDOW=${AUDIO_CAP}
BYOK_DIRECT_LIVE_ENABLED=true
BYOK_DIRECT_LIVE_CONFIRMATION=CONFIRM_BYOK_DIRECT_LIVE_TEST
TURNSTILE_BYOK_REQUIRED=true
EOF

  install -d -m 0700 "$ENV_DIR"
  install -m 0600 "$tmp_env" "$ENV_FILE"
  rm -f "$tmp_env"
  log "env file written with mode 0600: ${ENV_FILE}"
}

write_systemd_dropin() {
  local tmp_dropin
  tmp_dropin="$(tmp_file)"
  cat > "$tmp_dropin" <<EOF
[Service]
EnvironmentFile=${ENV_FILE}
EOF

  install -d -m 0755 "$SYSTEMD_DROPIN_DIR"
  install -m 0644 "$tmp_dropin" "$DROPIN_FILE"
  rm -f "$tmp_dropin"
  log "systemd drop-in written: ${DROPIN_FILE}"
}

restart_service() {
  systemctl daemon-reload
  systemctl restart "$SERVICE_NAME"
  log "service restarted: ${SERVICE_NAME}"
}

open_window() {
  validate_positive_int "$ATTEMPT_CAP" "attempt cap"
  validate_positive_int "$AUDIO_CAP" "audio cap"
  validate_window_id

  if [[ "$APPLY" != true ]]; then
    print_open_plan
    return 0
  fi

  require_root_for_apply
  log "mode=APPLY command=open"
  log "windowId=${WINDOW_ID} attemptCap=${ATTEMPT_CAP} audioCap=${AUDIO_CAP} turnstileRequired=true"
  write_live_env
  write_systemd_dropin
  restart_service

  local health_file
  health_file="$(tmp_file)"
  trap 'rm -f "$health_file"' RETURN
  fetch_health "$health_file"
  print_health "$health_file"
  assert_ready_preflight "$health_file"
}

print_close_plan() {
  log "mode=DRY-RUN command=close"
  log "service=${SERVICE_NAME}"
  log "healthUrl=${HEALTH_URL}"
  log "wouldRemoveEnvFile=${ENV_FILE}"
  log "wouldRemoveSystemdDropin=${DROPIN_FILE}"
  log "wouldRun=systemctl daemon-reload"
  log "wouldRun=systemctl restart ${SERVICE_NAME}"
  log "wouldVerify=SAFE_DEFAULT"
}

close_window() {
  if [[ "$APPLY" != true ]]; then
    print_close_plan
    return 0
  fi

  require_root_for_apply
  log "mode=APPLY command=close"
  rm -f "$ENV_FILE" "$DROPIN_FILE"
  log "live env and drop-in removed"
  restart_service

  local health_file
  health_file="$(tmp_file)"
  trap 'rm -f "$health_file"' RETURN
  fetch_health "$health_file"
  print_health "$health_file"
  assert_safe_default "$health_file"
}

COMMAND="${1:-help}"
shift || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)
      APPLY=true
      shift
      ;;
    --window-id)
      [[ $# -ge 2 ]] || die "--window-id requires a value"
      WINDOW_ID="$2"
      shift 2
      ;;
    --attempts)
      [[ $# -ge 2 ]] || die "--attempts requires a value"
      ATTEMPT_CAP="$2"
      shift 2
      ;;
    --audio)
      [[ $# -ge 2 ]] || die "--audio requires a value"
      AUDIO_CAP="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

case "$COMMAND" in
  status)
    status
    ;;
  open)
    open_window
    ;;
  close)
    close_window
    ;;
  help|--help|-h)
    usage
    ;;
  *)
    usage
    die "unknown command: ${COMMAND}"
    ;;
esac
