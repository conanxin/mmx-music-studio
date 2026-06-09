# mmx-music-studio v0.4.7-alpha

## What is this release?

This release improves the Library sharing and export workflow. After generating music, users can now copy a share link, open a track detail drawer directly from a URL, and export track metadata as Markdown for reuse or documentation.

## Highlights

### Track share links

Share a track directly:

```
https://music.conanxin.com/library?track=<trackId>
```

When opened, the Library page automatically opens the detail drawer for that track.

### Markdown track info export

From the detail drawer, tap **导出** to copy full track metadata as Markdown:

```markdown
# Track Title

- 来源：MMX CLI
- 时长：2:28
- 创建时间：2026-06-09 08:18
- Track ID：track_xxx
- 下载：https://music.conanxin.com/api/tracks/track_xxx/download

## Prompt

Your original prompt text
```

If no prompt is recorded, shows "未记录 prompt".

### Copy actions in detail drawer

| Button | Action |
|--------|--------|
| 播放 | Play audio inline |
| 下载 | Download MP3 with safe filename |
| 复制提示词 | Copy prompt text |
| 分享 | Copy share link (`/library?track=<id>`) |
| 导出 | Copy Markdown track info |

### Mobile drawer action polish

- **639px and below**: Action buttons in 2-column grid
- **389px and below**: Action buttons stack to single column
- Bottom sheet drawer on mobile

### Safe download filenames

Download filenames use the track title directly (Unicode letters, numbers, spaces, hyphens, underscores preserved; everything else replaced with `_`):

```
轻柔钢琴测试音乐.mp3   ← safe, readable
```

## Current runtime

| Item | Value |
|------|-------|
| Public URL | https://music.conanxin.com |
| Backend | `cli` (recommended default) |
| systemd service | `mmx-music-studio.service` — active and enabled |
| Cloudflare Tunnel | active |
| Daily generation limit | 50/day |

## Notes

- Favorites remain browser-local (stored in `localStorage`)
- CLI backend remains the recommended default path
- BYOK API Adapter remains real-call verified once but experimental
- No new generation is performed for this release

## Known limitations

- **Cloudflare Access** is not enabled — public URL is unauthenticated
- **Async API task polling** remains future work
- Track share links are public app-route links, not private signed URLs

## Upgrade notes

This release does not change the data model or generation logic. Upgrade from v0.4.6-alpha by pulling and restarting the service:

```bash
cd /home/ubuntu/projects/mmx-music-studio
git pull origin master
sudo systemctl restart mmx-music-studio
```

No migration required.