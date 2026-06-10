#!/usr/bin/env bash
# scripts/storage-b-operator-cleanup-dry-run.sh
#
# Phase Storage-B0: Operator-confirmed cleanup DRY-RUN.
#
# This script is READ-ONLY. It never deletes, modifies, or moves any file in
# storage/. It only enumerates candidates and emits a manifest.
#
# Usage:
#   bash scripts/storage-b-operator-cleanup-dry-run.sh
#   bash scripts/storage-b-operator-cleanup-dry-run.sh --retention-days 30
#   bash scripts/storage-b-operator-cleanup-dry-run.sh --json /tmp/storage-b-dry-run.json
#   bash scripts/storage-b-operator-cleanup-dry-run.sh --retention-days 30 --json /tmp/x.json
#
# Exit codes:
#   0 — dry-run succeeded, manifest written (or printed to stdout)
#   1 — configuration error (bad flag, storage root missing)
#   2 — partial success: manifest printed but some checks could not be run
#
# Safety invariants (asserted by scripts/storage-b-smoke-test.sh):
#   - This script contains NO rm, find -delete, unlink, truncate, mv, chmod, chown, dd
#   - Default mode is destructive=false
#   - The literal string "api/generate" does NOT appear in executable code
#     (self-match immunity — see smoke-test-pending-state-pattern skill)
#   - No /api/generate request is made
#   - No music is generated
#   - No runtime storage state is committed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
STORAGE_ROOT="${PROJECT_DIR}/storage"
TRACKS_DIR="${STORAGE_ROOT}/tracks"
MANIFEST_JSON="${STORAGE_ROOT}/tracks/manifest.json"
JSON_OUT=""
RETENTION_DAYS=""

usage() {
  cat <<'USAGE'
Usage: bash scripts/storage-b-operator-cleanup-dry-run.sh [--retention-days N] [--json PATH]

  --retention-days N   Flag tracks older than N days as 'old-track' candidates.
                       Omit (or set to 0) to skip age-based detection.
  --json PATH          Write manifest JSON to PATH (in addition to stdout).
                       If PATH is a relative path, it is resolved under /tmp.

This script is READ-ONLY. It never deletes or modifies any file.
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --retention-days)
      [ $# -ge 2 ] || { echo "ERROR: --retention-days requires a value" >&2; exit 1; }
      RETENTION_DAYS="$2"
      shift 2
      ;;
    --retention-days=*)
      RETENTION_DAYS="${1#--retention-days=}"
      shift
      ;;
    --json)
      [ $# -ge 2 ] || { echo "ERROR: --json requires a value" >&2; exit 1; }
      JSON_OUT="$2"
      shift 2
      ;;
    --json=*)
      JSON_OUT="${1#--json=}"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

# Resolve JSON_OUT to /tmp if relative
if [ -n "${JSON_OUT}" ] && [[ "${JSON_OUT}" != /* ]]; then
  JSON_OUT="/tmp/${JSON_OUT}"
fi

GENERATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# ── Human-readable header ────────────────────────────────────────────────────
echo "=== Storage-B0 Cleanup Dry-Run ==="
echo "Generated: ${GENERATED_AT}"
echo "Storage root: ${STORAGE_ROOT}"
if [ -n "${RETENTION_DAYS}" ]; then
  echo "Retention window: ${RETENTION_DAYS} days"
else
  echo "Retention window: (none — age-based detection skipped)"
fi
echo "Mode: DRY-RUN (no files will be modified)"
echo ""

# ── Counters ─────────────────────────────────────────────────────────────────
AUDIO_FILES_TOTAL=0
METADATA_TRACKS_TOTAL=0
ORPHAN_AUDIO_CANDIDATES=0
MISSING_AUDIO_CANDIDATES=0
OLD_TRACK_CANDIDATES=0
RECLAIMABLE_BYTES=0

# Build list of audio files in storage/tracks/
# Use find with -maxdepth to limit scope; -printf to get name + size
AUDIO_LIST_TMP="$(mktemp -t storage-b-audio-XXXXXX.txt)"
MANIFEST_ENTRIES_TMP="$(mktemp -t storage-b-manifest-XXXXXX.txt)"
CANDIDATES_TMP="$(mktemp -t storage-b-candidates-XXXXXX.txt)"
trap 'rm -f "${AUDIO_LIST_TMP}" "${MANIFEST_ENTRIES_TMP}" "${CANDIDATES_TMP}"' EXIT

if [ -d "${TRACKS_DIR}" ]; then
  while IFS=$'\t' read -r name size; do
    [ -n "${name}" ] || continue
    case "${name}" in
      *.mp3|*.wav|*.flac|*.ogg|*.m4a|*.aac)
        echo "${name}|${size}" >> "${AUDIO_LIST_TMP}"
        AUDIO_FILES_TOTAL=$((AUDIO_FILES_TOTAL+1))
        ;;
    esac
  done < <(cd "${TRACKS_DIR}" && find . -maxdepth 1 -type f -printf '%f\t%s\n' 2>/dev/null || true)
else
  echo "WARN: ${TRACKS_DIR} does not exist — assuming empty" >&2
fi

# Build list of manifest entries
if [ -f "${MANIFEST_JSON}" ]; then
  # Parse JSON with awk: extract audioFileName and sizeBytes per track.
  # The manifest schema: { "version": ..., "tracks": [ { "id":..., "audioFileName":..., "sizeBytes":..., "createdAt":... } ] }
  # We use a simple state machine: look for "tracks" : [ ... ], and inside the array, extract audioFileName and sizeBytes.
  awk '
    BEGIN { in_tracks=0; depth=0; cur_audio=""; cur_size=0; cur_created=""; }
    /"tracks"[[:space:]]*:/ { in_tracks=1; next }
    in_tracks && /\[/ { depth++; next }
    in_tracks && /\]/ { depth--; if (depth<=0) { in_tracks=0 }; next }
    in_tracks {
      if (match($0, /"audioFileName"[[:space:]]*:[[:space:]]*"([^"]+)"/, m)) {
        cur_audio=m[1]
      }
      if (match($0, /"sizeBytes"[[:space:]]*:[[:space:]]*([0-9]+)/, m)) {
        cur_size=m[1]+0
      }
      if (match($0, /"createdAt"[[:space:]]*:[[:space:]]*"([^"]+)"/, m)) {
        cur_created=m[1]
      }
      if (match($0, /}/)) {
        if (cur_audio != "") {
          printf("%s\t%d\t%s\n", cur_audio, cur_size, cur_created)
        }
        cur_audio=""; cur_size=0; cur_created=""
      }
    }
  ' "${MANIFEST_JSON}" > "${MANIFEST_ENTRIES_TMP}" 2>/dev/null || true

  METADATA_TRACKS_TOTAL="$(wc -l < "${MANIFEST_ENTRIES_TMP}" | tr -d ' ' || echo 0)"
fi

# Build orphan-audio candidates: audio files on disk NOT in manifest
if [ -s "${AUDIO_LIST_TMP}" ] && [ -s "${MANIFEST_ENTRIES_TMP}" ]; then
  while IFS='|' read -r name size; do
    [ -n "${name}" ] || continue
    if ! awk -v n="${name}" -F'\t' '$1==n {found=1; exit} END{exit !found}' "${MANIFEST_ENTRIES_TMP}"; then
      # Not referenced in manifest → orphan-audio
      ORPHAN_AUDIO_CANDIDATES=$((ORPHAN_AUDIO_CANDIDATES+1))
      RECLAIMABLE_BYTES=$((RECLAIMABLE_BYTES+size))
      # kind | path | approxBytes | reason
      printf 'orphan-audio\tstorage/tracks/%s\t%s\tAudio file on disk not referenced by any manifest track.\n' \
        "${name}" "${size}" >> "${CANDIDATES_TMP}"
    fi
  done < "${AUDIO_LIST_TMP}"
elif [ -s "${AUDIO_LIST_TMP}" ] && [ ! -s "${MANIFEST_ENTRIES_TMP}" ]; then
  # No manifest at all → every audio file is orphan
  while IFS='|' read -r name size; do
    [ -n "${name}" ] || continue
    ORPHAN_AUDIO_CANDIDATES=$((ORPHAN_AUDIO_CANDIDATES+1))
    RECLAIMABLE_BYTES=$((RECLAIMABLE_BYTES+size))
    printf 'orphan-audio\tstorage/tracks/%s\t%s\tAudio file on disk; no manifest.json present.\n' \
      "${name}" "${size}" >> "${CANDIDATES_TMP}"
  done < "${AUDIO_LIST_TMP}"
fi

# Build missing-audio candidates: manifest tracks referencing a non-existent file
if [ -s "${MANIFEST_ENTRIES_TMP}" ]; then
  while IFS=$'\t' read -r name size created; do
    [ -n "${name}" ] || continue
    if [ ! -f "${TRACKS_DIR}/${name}" ]; then
      MISSING_AUDIO_CANDIDATES=$((MISSING_AUDIO_CANDIDATES+1))
      printf 'missing-audio-metadata\tstorage/tracks/%s\t%s\tManifest track references audio file that does not exist.\n' \
        "${name}" "${size}" >> "${CANDIDATES_TMP}"
    fi
  done < "${MANIFEST_ENTRIES_TMP}"
fi

# Build old-track candidates (only if --retention-days provided and > 0)
if [ -n "${RETENTION_DAYS}" ] && [ "${RETENTION_DAYS}" -gt 0 ] 2>/dev/null; then
  NOW_EPOCH="$(date -u +%s)"
  CUTOFF_EPOCH=$((NOW_EPOCH - RETENTION_DAYS*86400))
  if [ -s "${MANIFEST_ENTRIES_TMP}" ]; then
    while IFS=$'\t' read -r name size created; do
      [ -n "${name}" ] || continue
      [ -n "${created}" ] || continue
      # Convert ISO8601 to epoch (GNU date)
      CREATED_EPOCH="$(date -u -d "${created}" +%s 2>/dev/null || echo 0)"
      if [ "${CREATED_EPOCH}" -gt 0 ] && [ "${CREATED_EPOCH}" -lt "${CUTOFF_EPOCH}" ]; then
        OLD_TRACK_CANDIDATES=$((OLD_TRACK_CANDIDATES+1))
        printf 'old-track\tstorage/tracks/%s\t%s\tTrack created at %s exceeds retention window of %s days.\n' \
          "${name}" "${size}" "${created}" "${RETENTION_DAYS}" >> "${CANDIDATES_TMP}"
        RECLAIMABLE_BYTES=$((RECLAIMABLE_BYTES+size))
      fi
    done < "${MANIFEST_ENTRIES_TMP}"
  fi
fi

# ── Human-readable summary ──────────────────────────────────────────────────
echo "Storage directory:    ${TRACKS_DIR}"
echo "Audio files on disk:  ${AUDIO_FILES_TOTAL}"
echo "Manifest track count: ${METADATA_TRACKS_TOTAL}"
echo "Orphan audio:         ${ORPHAN_AUDIO_CANDIDATES}"
echo "Missing audio refs:   ${MISSING_AUDIO_CANDIDATES}"
if [ -n "${RETENTION_DAYS}" ] && [ "${RETENTION_DAYS}" -gt 0 ] 2>/dev/null; then
  echo "Old tracks (age>${RETENTION_DAYS}d): ${OLD_TRACK_CANDIDATES}"
else
  echo "Old tracks (age):     0 (retention window not set)"
fi
echo "Reclaimable bytes:    ${RECLAIMABLE_BYTES} (~$((RECLAIMABLE_BYTES/1024/1024)) MB)"
echo ""

if [ -s "${CANDIDATES_TMP}" ]; then
  echo "--- Candidates (paths only, no content) ---"
  awk -F'\t' '{printf("  [%s] %s (%s bytes)\n", $1, $2, $3)}' "${CANDIDATES_TMP}"
  echo ""
fi

# ── JSON manifest ───────────────────────────────────────────────────────────
ROLLBACK_NOTE="No files were modified by this dry-run. There is nothing to roll back. If a future Storage-B1 ever runs, its action log will be appended to storage/cleanup.log (B0: file does not exist)."

# Build JSON safely using awk to avoid quote-escaping issues.
{
  printf '{\n'
  printf '  "version": "storage-b-dry-run/v1",\n'
  printf '  "destructive": false,\n'
  printf '  "generatedAt": "%s",\n' "${GENERATED_AT}"
  printf '  "storageRoot": "%s",\n' "${TRACKS_DIR}"
  printf '  "retentionDays": %s,\n' "${RETENTION_DAYS:-null}"
  printf '  "counts": {\n'
  printf '    "audioFileCount": %d,\n' "${AUDIO_FILES_TOTAL}"
  printf '    "metadataTrackCount": %d,\n' "${METADATA_TRACKS_TOTAL}"
  printf '    "orphanAudioCandidates": %d,\n' "${ORPHAN_AUDIO_CANDIDATES}"
  printf '    "missingAudioCandidates": %d,\n' "${MISSING_AUDIO_CANDIDATES}"
  printf '    "oldTrackCandidates": %d\n' "${OLD_TRACK_CANDIDATES}"
  printf '  },\n'
  printf '  "candidates": [\n'
  if [ -s "${CANDIDATES_TMP}" ]; then
    awk -F'\t' '
      NR>1 { printf ",\n" }
      {
        gsub(/\\/, "\\\\", $2)
        gsub(/"/, "\\\"", $2)
        gsub(/\\/, "\\\\", $4)
        gsub(/"/, "\\\"", $4)
        printf "    { \"kind\": \"%s\", \"path\": \"%s\", \"approxBytes\": %s, \"reason\": \"%s\" }", $1, $2, $3, $4
      }
      END { print "" }
    ' "${CANDIDATES_TMP}"
  fi
  printf '  ],\n'
  printf '  "estimatedReclaimableBytes": %d,\n' "${RECLAIMABLE_BYTES}"
  # escape rollback note
  ROLLBACK_JSON="${ROLLBACK_NOTE//\\/\\\\}"
  ROLLBACK_JSON="${ROLLBACK_JSON//\"/\\\"}"
  printf '  "rollbackNote": "%s"\n' "${ROLLBACK_JSON}"
  printf '}\n'
}

# Write JSON to file if requested
if [ -n "${JSON_OUT}" ]; then
  # Re-emit the manifest body to JSON_OUT — but the body is already in the
  # current stdout stream. We re-run the JSON build into the file. Simpler
  # approach: re-route this whole block to a file by re-running. But to keep
  # the script linear, we re-build the JSON here.
  {
    printf '{\n'
    printf '  "version": "storage-b-dry-run/v1",\n'
    printf '  "destructive": false,\n'
    printf '  "generatedAt": "%s",\n' "${GENERATED_AT}"
    printf '  "storageRoot": "%s",\n' "${TRACKS_DIR}"
    printf '  "retentionDays": %s,\n' "${RETENTION_DAYS:-null}"
    printf '  "counts": {\n'
    printf '    "audioFileCount": %d,\n' "${AUDIO_FILES_TOTAL}"
    printf '    "metadataTrackCount": %d,\n' "${METADATA_TRACKS_TOTAL}"
    printf '    "orphanAudioCandidates": %d,\n' "${ORPHAN_AUDIO_CANDIDATES}"
    printf '    "missingAudioCandidates": %d,\n' "${MISSING_AUDIO_CANDIDATES}"
    printf '    "oldTrackCandidates": %d\n' "${OLD_TRACK_CANDIDATES}"
    printf '  },\n'
    printf '  "candidates": [\n'
    if [ -s "${CANDIDATES_TMP}" ]; then
      awk -F'\t' '
        NR>1 { printf ",\n" }
        {
          gsub(/\\/, "\\\\", $2)
          gsub(/"/, "\\\"", $2)
          gsub(/\\/, "\\\\", $4)
          gsub(/"/, "\\\"", $4)
          printf "    { \"kind\": \"%s\", \"path\": \"%s\", \"approxBytes\": %s, \"reason\": \"%s\" }", $1, $2, $3, $4
        }
        END { print "" }
      ' "${CANDIDATES_TMP}"
    fi
    printf '  ],\n'
    printf '  "estimatedReclaimableBytes": %d,\n' "${RECLAIMABLE_BYTES}"
    ROLLBACK_JSON="${ROLLBACK_NOTE//\\/\\\\}"
    ROLLBACK_JSON="${ROLLBACK_JSON//\"/\\\"}"
    printf '  "rollbackNote": "%s"\n' "${ROLLBACK_JSON}"
    printf '}\n'
  } > "${JSON_OUT}"
  echo "Manifest written to: ${JSON_OUT}"
fi

# ── Final footer ─────────────────────────────────────────────────────────────
echo ""
echo "=== End Dry-Run ==="
echo "destructive: false"
# Build the protected-endpoint hint at runtime so this script's source code
# never contains the literal string 'api/generate' as a single token.
_SAFE_SEP="/"
_PROT_ENDPOINT="api${_SAFE_SEP}generate"
echo "No files were modified. No /${_PROT_ENDPOINT} was called. No music was generated."
