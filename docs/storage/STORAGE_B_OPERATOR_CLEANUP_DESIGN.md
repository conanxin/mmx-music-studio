# Phase Storage-B0 — Operator-Confirmed Cleanup Dry-Run & Safety Design

> Status: **DRAFT — Phase B0 only**. No deletion is performed in B0.
> Audience: project maintainer, future operators, code reviewers.
> Companion scripts:
> - `scripts/storage-b-operator-cleanup-dry-run.sh` — read-only scan (B0)
> - `scripts/storage-b-confirmation-guard.sh` — confirmation guard (B0)
> - `scripts/storage-b-smoke-test.sh` — safety assertions (B0)

---

## 1. Why Phase Storage-B exists

`storage/` accumulates data while the alpha is in operation:

- generated audio files (`storage/tracks/*.mp3|*.wav`)
- mock-track test fixtures from earlier smoke runs
- per-day quota counters (`storage/quota/daily.json`)
- rate-limit / real-API attempt records (`storage/quota/real-api-attempts.json`)
- audit log entries (`storage/audit/audit.jsonl`)
- launch-guard runtime state (`storage/guard/public-generation-guard.json`)

**Storage-A** (already shipped) added:

- inventory summary
- retention dry-run
- backup manifest (read-only export)

**Storage-B** is the **operator-confirmed cleanup** phase. It is split into two sub-phases to keep risk incremental:

| Sub-phase | What it ships | What it MUST NOT do |
| --- | --- | --- |
| **Storage-B0** (this phase) | dry-run manifest, confirmation protocol, safety design doc, smoke test | delete any file, modify runtime state, call `/api/generate` |
| **Storage-B1** (future, NOT in this phase) | guarded `rm` path with two-factor confirmation (phrase + console review), rollback log, post-cleanup audit | bypass confirmation, silent deletion, delete files outside `storage/`, delete `.gitkeep` |

B0 is purely a **safety design + dry-run + guard skeleton**. B1 will not exist in this PR.

---

## 2. Current storage directories (B0 baseline)

The dry-run script reports the following categories. It does **not** alter any of them.

| Sub-path | Contents | Touch in B0? |
| --- | --- | --- |
| `storage/tracks/` | `manifest.json` + audio files (`.mp3`, `.wav`, …) + `.gitkeep` | No (read-only scan) |
| `storage/quota/` | `daily.json`, `real-api-attempts.json` + `.gitkeep` | No (read-only scan) |
| `storage/audit/` | `audit.jsonl` + `.gitkeep` | No (read-only scan) |
| `storage/guard/` | `public-generation-guard.json` + `.gitkeep` | No (read-only scan) |
| `storage/jobs/` | job scratch space (transient) | No (read-only scan) |

---

## 3. Non-destructive default (hard rule)

> The default mode of every script added in Storage-B0 is **read-only**. The string `destructive: false` appears in every emitted JSON manifest. No `rm`, `find -delete`, `unlink`, `truncate`, `mv`, `chmod`, `chown`, `dd`, or shell redirection that truncates files is permitted in any B0 script. This is enforced by `scripts/storage-b-smoke-test.sh`.

### Forbidden in B0 source code

```bash
rm -f …                 # BANNED
rm -r …                 # BANNED
find … -delete          # BANNED
unlink …                # BANNED
truncate -s 0 …         # BANNED
> file                  # BANNED (truncates)
mv storage/… /tmp/…     # BANNED
chmod 000 …             # BANNED
```

The dry-run script may **only** use:

- `stat`, `find -printf`, `readdir`, `wc`, `du`, `sha256sum`
- `ts` for timestamp formatting
- `echo` / `printf` to stdout or to a tmp file under `/tmp`
- `mktemp` for ephemeral scratch files in `/tmp`

The confirmation-guard script may **only** use:

- `echo` to stdout
- `exit 0` / `exit 1`
- an `if [ "$X" = "CONFIRM_STORAGE_B_CLEANUP" ]` check

---

## 4. Required confirmation phrase

Future Storage-B1 will require an **exact** confirmation phrase in the environment variable `STORAGE_B_CONFIRMATION`:

```text
STORAGE_B_CONFIRMATION=CONFIRM_STORAGE_B_CLEANUP
```

- Missing variable → exit non-zero, no action
- Wrong value → exit non-zero, no action
- Exact match → exit 0 (B0: only the guard prints `confirmation accepted`; **no cleanup is performed by the guard itself**)

The phrase is chosen so that:

- it is **unique** (cannot appear by accident in shell history or environment dumps)
- it is **uppercase, explicit** (`CONFIRM_STORAGE_B_CLEANUP`, not a common word)
- it is **not a default** — there is no reason for any other tool to set it

> B0 does **not** document or use any weaker confirmation (e.g. "y", "yes", or `--force`). The only way to acknowledge a destructive Storage-B1 action is to type the full phrase into the environment.

---

## 5. Cleanup candidate categories (B0 reports, B1 deletes)

The B0 dry-run manifest groups candidates into the following categories. **B0 reports them as JSON only.** B1 may delete a subset **only after** an operator reviews the manifest and types the confirmation phrase.

| Kind | Description | Default in B0 |
| --- | --- | --- |
| `orphan-audio` | audio file on disk that is not referenced by any `manifest.json` track entry | reported |
| `missing-audio-metadata` | `manifest.json` track entry referencing an audio file that does not exist | reported (metadata-only) |
| `old-track` | track record older than `--retention-days` (default: never applied — see §6) | reported (opt-in via flag) |
| `stale-guard` | `storage/guard/public-generation-guard.json` with `paused: true` and no recent activity (operator-only) | reported (B1: requires explicit kind allow-list) |
| `stale-audit` | `storage/audit/audit.jsonl` larger than a soft cap | reported (B1: rotate-only, never delete) |
| `stale-quota` | `storage/quota/*.json` with old date keys (older than `--retention-days`) | reported (B1: rewrite, never delete) |

### Categories that **never** appear in a delete manifest

- `runtime-state` — anything in `storage/guard/`, `storage/jobs/`, `storage/quota/daily.json` is runtime. B1 may **only** rewrite, never delete.
- `audio-real` — `*.mp3` produced by a successful real-API generation. Even if orphan, B1 will require a separate `STORAGE_B_CONFIRM_AUDIO` phrase (NOT in scope of B0).
- `mock-fixture` — `mock_track_17_*.wav` files are smoke-test artifacts. They can only be deleted if B1 has a `STORAGE_B_CONFIRM_MOCK` phrase (NOT in scope of B0).

---

## 6. Retention window (B0: opt-in only)

The dry-run script accepts `--retention-days N` to flag tracks older than `N` days. **The default is no retention** — only `orphan-audio` and `missing-audio-metadata` are reported unless an operator passes a retention value.

Rationale: an alpha with a small operator audience should not lose data by default. If a value is provided, it is logged prominently in the manifest header.

---

## 7. Required report fields (B0 manifest schema)

Every B0 dry-run JSON manifest contains:

```json
{
  "version": "storage-b-dry-run/v1",
  "destructive": false,
  "generatedAt": "2026-06-11T...",
  "storageRoot": "storage/tracks",
  "retentionDays": null,
  "counts": {
    "audioFileCount": 0,
    "metadataTrackCount": 0,
    "orphanAudioCandidates": 0,
    "missingAudioCandidates": 0,
    "oldTrackCandidates": 0
  },
  "candidates": [
    { "kind": "orphan-audio", "path": "storage/tracks/...", "approxBytes": 0, "reason": "..." }
  ],
  "estimatedReclaimableBytes": 0,
  "rollbackNote": "No files were modified. To restore, no action is needed. If B1 ever runs, the cleanup log is appended to storage/cleanup.log (B0: file does not exist yet)."
}
```

Notes:

- `destructive: false` is a **literal string check** by the smoke test.
- `rollbackNote` is a human-readable string, not a script.
- No audio content, prompt text, or note text is included in the manifest.

---

## 8. Never-delete list (enforced by B0 smoke test)

The smoke test asserts the B0 dry-run script does **not** import, source, or invoke any of:

- `rm`
- `find -delete`
- `unlink`
- `truncate`
- `mv` to a path outside `/tmp`
- `chmod`/`chown` on storage files
- `dd` against storage files

It also asserts that the design doc explicitly lists the following **never-delete** items:

- `.gitkeep` files
- source code (everything outside `storage/`)
- documentation (`docs/`, `README.md`, etc.)
- release notes (`docs/release/`, `CHANGELOG.md`)
- `.env` (config)
- unknown files (anything not in a documented category — operator must classify before B1)
- files outside `storage/`

---

## 9. Rollback note (B0)

> No files were modified by any Storage-B0 script. There is no rollback to perform.
>
> If a future Storage-B1 ever runs, its action log will be appended to `storage/cleanup.log` (this file does not exist in B0; B0 does not create it). To "rollback" a B1 deletion, the operator would need a separate backup, which is **out of scope** for B0. B0's position is: do not delete what you do not have a backup of.

---

## 10. Human confirmation protocol (B0 skeleton only)

```
[future Storage-B1 — NOT in this phase]
operator@host:~$ STORAGE_B_CONFIRMATION=CONFIRM_STORAGE_B_CLEANUP \
                 STORAGE_B_CONFIRM_AUDIO=1 \
                 bash scripts/storage-b1-apply-cleanup.sh \
                   --manifest /tmp/storage-b-dry-run.json

storage-b-confirmation-guard.sh: confirmation accepted
storage-b1-apply-cleanup.sh: refusing to run: B1 script does not exist
```

B0 includes only `storage-b-confirmation-guard.sh`, which:

1. reads `STORAGE_B_CONFIRMATION`
2. compares it to the literal string `CONFIRM_STORAGE_B_CLEANUP`
3. prints `confirmation missing`, `confirmation rejected`, or `confirmation accepted`
4. exits accordingly

**The guard does not delete anything.** It exists so that B1 scripts can call it before any destructive action, and so that operators can test the protocol in B0 without risk.

---

## 11. Safety and privacy invariants (B0)

- The dry-run script never writes to `storage/`.
- The dry-run script never writes to `~/.config/`, `/etc/`, or anywhere outside `/tmp`.
- The smoke test asserts no path string contains the literal `/api/generate` (self-match immunity — see `smoke-test-pending-state-pattern` skill).
- No music is generated by any B0 script.
- No `STORAGE_B_*` environment variable is read or set anywhere except the confirmation-guard script.
- The CI run does not pass `STORAGE_B_CONFIRMATION` — so even if B0 ever introduced a bug, nothing destructive could run.

---

## 12. What is NOT in B0

- No `rm` of any file
- No scheduled cleanup (cron / systemd timer)
- No auto-expiry of audit log
- No auto-expiry of quota counters
- No auto-expiry of guard state
- No upload of manifest to a remote location
- No public endpoint exposing candidate lists
- No GitHub Actions workflow that performs cleanup
- No release tag, no version bump

B0 is documentation + scripts + smoke test only.
