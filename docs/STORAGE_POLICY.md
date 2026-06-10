# Storage Policy — mmx-music-studio

> Current alpha posture · Phase Storage-A

---

## Current Alpha Posture

The public alpha stores generated track records and audio files on the server for Library playback. No automatic cleanup runs. No retention enforcement is active.

---

## What Is Stored

| Category | Location | Description |
|----------|----------|-------------|
| Track metadata | `storage/tracks/manifest.json` | Title, mode, model, prompt, lyrics, audioFileName, duration, sizeBytes, createdAt |
| Audio files | `storage/tracks/*.mp3` | Generated audio content |
| Guard state | `storage/guard/public-generation-guard.json` | Hashed source counters (SHA256, not raw IP) |
| Quota state | `storage/quota/` | Per-source quota counters |
| Audit logs | `storage/audit/` | Audit trail for blocked/generation events |
| Job state | `storage/jobs/` | Job queue state |

---

## What Is NOT Committed

The following must never be committed to the repository:

| Category | Reason |
|----------|--------|
| Generated audio files | User-generated content, not source code |
| Runtime guard state | Runtime counters, resets on server restart |
| Runtime quota state | Runtime quota data, resets on server restart |
| Audit logs | Contains event timestamps and hashed identifiers |
| `storage/tracks/` audio + manifest | Live data from actual generations |
| `.env` | Contains real secrets |
| `storage/reports/` runtime reports | Operator-only, generated at runtime |

---

## Retention Policy Proposal

The following policy is proposed for future automation. It is not yet enforced:

### Default Alpha Retention Policy

1. **Keep all valid tracks by default** — no automatic deletion
2. **Review storage** when audio data exceeds 1 GB
3. **Use dry-run before any cleanup** — `scripts/storage-a-retention-dry-run.sh`
4. **Do not delete files automatically** — operator must confirm
5. **Export backup manifest before cleanup** — `scripts/storage-a-backup-manifest.sh`

### Cleanup Categories

| Category | Definition |
|----------|------------|
| **orphan-audio** | Audio file exists on disk but is not referenced by any manifest track |
| **missing-audio-metadata** | Track record in manifest references an audio file that does not exist on disk |
| **old-track** | Valid track older than the retention window |

### Safety Rules

- Cleanup must always start as **dry-run** (`mode: 'dry-run'`)
- Cleanup must **never remove files without explicit operator confirmation**
- Raw filesystem paths must **never be exposed in public endpoints**
- Runtime storage directories must **never be committed**
- The `storage-a-retention-dry-run.sh` script will **NEVER delete files automatically**

---

## Storage Inventory Tools

| Script | Purpose |
|--------|---------|
| `scripts/storage-a-inventory-report.sh` | Current state: track count, audio count, orphan/missing counts |
| `scripts/storage-a-retention-dry-run.sh` | Dry-run retention report: candidate count, reclaimable bytes, by-kind breakdown |
| `scripts/storage-a-backup-manifest.sh` | Lightweight JSON manifest snapshot (safe to store externally) |
| `GET /api/status` | Public-safe storage aggregate: trackCount, audioFileCount, approxAudioBytes |

---

## `GET /api/status` Storage Aggregate

The public `/api/status` endpoint exposes a **public-safe subset** of storage data:

```json
{
  "runtimeStatus": {
    "storage": {
      "trackCount": 300,
      "audioFileCount": 300,
      "approxAudioBytes": 119543624,
      "readable": true
    }
  }
}
```

The following are **NOT exposed** in `/api/status`:

- Orphan audio file count
- Missing audio metadata count
- Individual candidate details
- Raw filesystem paths
- User prompts or lyrics

These are available only via operator scripts (`scripts/storage-a-*.sh`).

---

## Next Steps

- **Phase Storage-B** — confirmed cleanup with operator review
- **Phase Deploy-CF-C** — Cloudflare Access (optional)