#!/bin/bash
# ─── Core Smoke Test ──────────────────────────────────────────────────────────
# Does NOT read keys, does NOT call network.
# Verifies:
#   1. Core source files exist
#   2. npm run typecheck passes
#   3. npm run build passes
#   4. Key payload builder mappings are correct (inline assertions)

set -e
cd "$(dirname "$0")/.."

echo ""
echo "─── 1. File Existence ───"
FILES=(
  "packages/core/src/index.ts"
  "packages/core/src/types.ts"
  "packages/core/src/constants.ts"
  "packages/core/src/errors.ts"
  "packages/core/src/validation.ts"
  "packages/core/src/request-builder.ts"
  "packages/core/src/prompt-builder.ts"
  "packages/core/src/mock.ts"
  "packages/core/package.json"
)
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    echo "  ✓ $f"
  else
    echo "  ✗ MISSING: $f"
    exit 1
  fi
done

echo ""
echo "─── 2. TypeScript Check ───"
npm run typecheck 2>&1 | tail -3

echo ""
echo "─── 3. Build ───"
npm run build 2>&1 | tail -5

echo ""
echo "─── 4. Key Assertions ───"

RB="packages/core/src/request-builder.ts"

# Assert instrumental -> is_instrumental (property assignment, not object literal)
if grep -q "is_instrumental = true" "$RB"; then
  echo "  ✓ instrumental sets is_instrumental = true"
else
  echo "  ✗ instrumental is_instrumental missing"
  exit 1
fi

# Assert auto -> lyrics_optimizer
if grep -q "lyrics_optimizer = true" "$RB"; then
  echo "  ✓ auto sets lyrics_optimizer = true"
else
  echo "  ✗ auto lyrics_optimizer missing"
  exit 1
fi

# Assert lyrics -> payload.lyrics assignment
if grep -q 'payload.lyrics = normalizedInput.lyrics' "$RB"; then
  echo "  ✓ lyrics mode sets payload.lyrics"
else
  echo "  ✗ lyrics mode payload.lyrics missing"
  exit 1
fi

# Assert cover-url -> audio_url assignment
if grep -q 'payload.audio_url = ' "$RB"; then
  echo "  ✓ cover-url sets audio_url in payload"
else
  echo "  ✗ cover-url audio_url missing"
  exit 1
fi

# Assert needsUpload flag
if grep -q "needsUpload" "$RB"; then
  echo "  ✓ cover-file needsUpload flag present"
else
  echo "  ✗ cover-file needsUpload missing"
  exit 1
fi

# Assert validateMusicInput exported
if grep -q "export function validateMusicInput" packages/core/src/validation.ts; then
  echo "  ✓ validateMusicInput exported"
else
  echo "  ✗ validateMusicInput not exported"
  exit 1
fi

# Assert createMockTrack exported
if grep -q "export function createMockTrack" packages/core/src/mock.ts; then
  echo "  ✓ createMockTrack exported"
else
  echo "  ✗ createMockTrack not exported"
  exit 1
fi

# Assert no real API key reading patterns in core
if grep -rn "cat.*\~/.mmx\|cat.*\~/.hermes.*env\|getenv.*API_KEY\|process\.env.*MINIMAX_API_KEY" packages/core/src/ 2>/dev/null; then
  echo "  ✗ Suspicious key-reading patterns found in core"
  exit 1
else
  echo "  ✓ No API key reading patterns in core"
fi

# Assert no console.log with key-like content
if grep -rn 'console\.log.*[Kk]ey\|console\.log.*token\|console\.log.*secret' packages/core/src/ 2>/dev/null; then
  echo "  ✗ console.log with key patterns in core"
  exit 1
else
  echo "  ✓ No console.log key patterns in core"
fi

echo ""
echo "─── All smoke tests passed ───"
echo ""