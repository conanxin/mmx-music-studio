#!/usr/bin/env bash
# scripts/storage-a-smoke-test.sh
# Phase Storage-A smoke test
#
# Checks that Storage-A implementation is complete and no dangerous
# auto-deletion patterns exist. Does NOT call /api/generate or generate music.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

PASS=0
FAIL=0

pass() { echo "  ✅ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }

echo "=== Storage-A Smoke Test ==="
echo ""

# ── 1. docs/STORAGE_POLICY.md exists ───────────────────────────────────────────
if [[ -f "$PROJECT_DIR/docs/STORAGE_POLICY.md" ]]; then
  pass "docs/STORAGE_POLICY.md exists"
else
  fail "docs/STORAGE_POLICY.md missing"
fi

# ── 2. server/storage-maintenance.ts exists ──────────────────────────────────
if [[ -f "$PROJECT_DIR/server/storage-maintenance.ts" ]]; then
  pass "server/storage-maintenance.ts exists"
else
  fail "server/storage-maintenance.ts missing"
fi

# ── 3. Type exports ─────────────────────────────────────────────────────────────
STORAGE_MAINT="$PROJECT_DIR/server/storage-maintenance.ts"

for sym in StorageInventorySummary StorageRetentionCandidate StorageRetentionDryRun StorageBackupManifest; do
  if grep -q "export interface $sym" "$STORAGE_MAINT" 2>/dev/null; then
    pass "export interface $sym"
  else
    fail "export interface $sym missing"
  fi
done

# ── 4. Function exports ────────────────────────────────────────────────────────
for fn in buildStorageInventorySummary buildStorageRetentionDryRun buildStorageBackupManifest; do
  if grep -q "export function $fn" "$STORAGE_MAINT" 2>/dev/null; then
    pass "export function $fn"
  else
    fail "export function $fn missing"
  fi
done

# ── 5. Field presence in StorageInventorySummary ──────────────────────────────
if grep -q "orphanAudioFileCount:" "$STORAGE_MAINT" 2>/dev/null; then
  pass "orphanAudioFileCount field"
else
  fail "orphanAudioFileCount field missing"
fi

if grep -q "missingAudioFileCount:" "$STORAGE_MAINT" 2>/dev/null; then
  pass "missingAudioFileCount field"
else
  fail "missingAudioFileCount field missing"
fi

# ── 6. Field presence in StorageRetentionDryRun ─────────────────────────────────
if grep -q "retentionDays:" "$STORAGE_MAINT" 2>/dev/null; then
  pass "retentionDays field"
else
  fail "retentionDays field missing"
fi

if grep -q "dry-run\|'dry-run'" "$STORAGE_MAINT" 2>/dev/null; then
  pass "dry-run mode field"
else
  fail "dry-run mode field missing"
fi

if grep -q "reclaimableBytes:" "$STORAGE_MAINT" 2>/dev/null; then
  pass "reclaimableBytes field"
else
  fail "reclaimableBytes field missing"
fi

# ── 7. Scripts exist ───────────────────────────────────────────────────────────
for script in storage-a-inventory-report.sh storage-a-retention-dry-run.sh storage-a-backup-manifest.sh; do
  if [[ -f "$PROJECT_DIR/scripts/$script" ]]; then
    pass "$script exists"
  else
    fail "$script missing"
  fi
done

# ── 8. Scripts are executable ──────────────────────────────────────────────────
for script in storage-a-inventory-report.sh storage-a-retention-dry-run.sh storage-a-backup-manifest.sh; do
  if [[ -x "$PROJECT_DIR/scripts/$script" ]]; then
    pass "$script is executable"
  else
    fail "$script not executable"
  fi
done

# ── 9. Scripts use dry-run (not auto-delete) ───────────────────────────────────
if grep -q "dry-run\|DRY-RUN" "$PROJECT_DIR/scripts/storage-a-retention-dry-run.sh" 2>/dev/null; then
  pass "retention dry-run script uses dry-run mode"
else
  fail "retention dry-run script missing dry-run mode"
fi

# ── 10. Scripts do NOT contain dangerous rm commands ───────────────────────────
DANGEROUS=false
for script in storage-a-inventory-report.sh storage-a-retention-dry-run.sh storage-a-backup-manifest.sh; do
  if grep -qE "rm\s+-(rf|f|r)\s+[\"\']?storage/" "$PROJECT_DIR/scripts/$script" 2>/dev/null; then
    DANGEROUS=true
    break
  fi
done
if $DANGEROUS; then
  fail "Dangerous rm command found in storage scripts"
else
  pass "No dangerous rm commands in storage scripts"
fi

# ── 11. Scripts do NOT contain real token/key exposure ─────────────────────────
for script in storage-a-inventory-report.sh storage-a-retention-dry-run.sh storage-a-backup-manifest.sh; do
  if grep -qE "MINIMAX_API_KEY|MINIMAX_TOKEN|Authorization:\s*Bearer" \
       "$PROJECT_DIR/scripts/$script" 2>/dev/null; then
    fail "$script contains token/key exposure"
  else
    pass "$script has no token/key exposure"
  fi
done

# ── 12. README mentions Storage-A ─────────────────────────────────────────────
if grep -q "Storage Management\|Storage-A\|storage-a-" "$PROJECT_DIR/README.md" 2>/dev/null; then
  pass "README mentions Storage Management"
else
  fail "README missing Storage Management entry"
fi

# ── 13. Handoff mentions Storage-A ────────────────────────────────────────────
if grep -q "存储治理\|Storage-A\|storage.*management" \
     "$PROJECT_DIR/docs/DEVELOPMENT_HANDOFF.md" 2>/dev/null; then
  pass "Handoff mentions Storage Management"
else
  fail "Handoff missing Storage Management entry"
fi

# ── 14. PUBLIC_RELEASE_READINESS mentions storage management ───────────────────
if grep -q "storage.*management\|Storage-A\|retention" \
     "$PROJECT_DIR/docs/PUBLIC_RELEASE_READINESS.md" 2>/dev/null; then
  pass "PUBLIC_RELEASE_READINESS mentions storage management"
else
  fail "PUBLIC_RELEASE_READINESS missing storage management entry"
fi

# ── 15. OPS_MONITORING mentions storage commands ────────────────────────────────
if grep -q "storage-a-\|storage.*inventory\|storage.*retention" \
     "$PROJECT_DIR/docs/OPS_MONITORING.md" 2>/dev/null; then
  pass "OPS_MONITORING mentions storage commands"
else
  fail "OPS_MONITORING missing storage commands reference"
fi

# ── 16. STORAGE_POLICY mentions no auto-deletion ───────────────────────────────
if grep -qi "no automatic\|never.*delete\|never.*remove\|operator.*confirm" \
     "$PROJECT_DIR/docs/STORAGE_POLICY.md" 2>/dev/null; then
  pass "STORAGE_POLICY.md states no auto-deletion"
else
  fail "STORAGE_POLICY.md missing no-auto-deletion policy"
fi

# ── 17. STORAGE_POLICY mentions orphan/missing/old-track categories ───────────
for cat in orphan-audio missing-audio-metadata old-track; do
  if grep -q "$cat" "$PROJECT_DIR/docs/STORAGE_POLICY.md" 2>/dev/null; then
    pass "STORAGE_POLICY.md documents $cat"
  else
    fail "STORAGE_POLICY.md missing $cat category"
  fi
done

# ── 18. Backup manifest note field ─────────────────────────────────────────────
if grep -q "note.*manifest\|manifest.*note\|excludes.*raw\|note.*excludes" \
     "$STORAGE_MAINT" 2>/dev/null; then
  pass "Backup manifest excludes raw content note"
else
  fail "Backup manifest missing note about excluded content"
fi

# ── 19. No /api/generate calls in smoke test scripts ───────────────────────────
for script in storage-a-inventory-report.sh storage-a-retention-dry-run.sh storage-a-backup-manifest.sh; do
  if grep -q "/api/generate" "$PROJECT_DIR/scripts/$script" 2>/dev/null; then
    fail "$script calls /api/generate"
  else
    pass "$script does not call /api/generate"
  fi
done

# ── 20. No generation in StorageMaintenanceCandidate reason ───────────────────
if grep -qE "reason.*prompt\|reason.*lyrics\|reason.*token\|reason.*API" \
     "$STORAGE_MAINT" 2>/dev/null; then
  fail "Candidate reason exposes prompt/lyrics/token"
else
  pass "Candidate reason is safe (no prompt/lyrics/token)"
fi

# ── Results ──────────────────────────────────────────────────────────────────────
echo ""
echo "=== Results: $PASS PASS, $FAIL FAIL ==="
if [[ $FAIL -eq 0 ]]; then
  echo "STORAGE_A_SMOKE_PASS"
  exit 0
else
  echo "STORAGE_A_SMOKE_FAIL"
  exit 1
fi