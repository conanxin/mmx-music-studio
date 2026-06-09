import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import styles from './Library.module.css';
import { MOCK_TASKS, formatDuration, formatRelativeTime, MODE_LABELS } from '../../mock/data';
import { listTracks, deleteTrack } from '../../lib/serverApi';
import type { TrackLike } from '../../lib/serverApi';
import type { GlobalPlayerTrack } from '../../lib/globalPlayerTrack';

const FAVORITES_KEY = 'mmx-studio:favorites';

type FilterSource = 'all' | 'mmx-cli' | 'minimax-api' | 'mock' | 'favorites';
type FilterTab = { key: FilterSource; label: string };

const FILTER_TABS: FilterTab[] = [
  { key: 'all', label: '全部' },
  { key: 'mmx-cli', label: 'MMX CLI' },
  { key: 'minimax-api', label: 'MiniMax API' },
  { key: 'mock', label: '示例' },
  { key: 'favorites', label: '收藏' },
];

type TrackItem = {
  id: string;
  title: string;
  mode: string;
  prompt?: string;
  lyrics?: string;
  durationText?: string;
  durationMs?: number;
  audioFormat?: string;
  audioMimeType?: string;
  createdAt: Date;
  audioUrl?: string;
  downloadUrl?: string;
  generationSource?: 'mock' | 'minimax' | 'mmx-cli';
  isMock?: boolean;
};

function serverTrackToItem(t: TrackLike): TrackItem {
  return {
    id: t.id,
    title: t.title,
    mode: t.mode,
    prompt: t.prompt,
    lyrics: t.lyrics,
    durationText: t.durationText,
    durationMs: t.durationMs,
    audioFormat: t.audioFormat,
    audioMimeType: t.audioMimeType,
    createdAt: new Date(t.createdAt || Date.now()),
    audioUrl: t.audioUrl,
    downloadUrl: t.downloadUrl,
    generationSource: t.generationSource,
    isMock: false,
  };
}

function mockTaskToItem(t: typeof MOCK_TASKS[0]): TrackItem {
  return {
    id: t.id,
    title: t.title,
    mode: t.mode,
    durationText: t.duration ? formatDuration(t.duration) : undefined,
    createdAt: t.createdAt,
    isMock: true,
  };
}

function readFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function writeFavorites(favs: Set<string>): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs]));
  } catch {
    // storage quota exceeded or private mode — ignore
  }
}

function sourceLabel(s?: string, isMock?: boolean): string {
  if (isMock) return '示例';
  if (s === 'mmx-cli') return 'MMX CLI';
  if (s === 'minimax') return 'MiniMax API';
  return s || '—';
}

function useCopyToast() {
  const [toast, setToast] = useState<string | null>(null);
  const showCopy = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);
  return { toast, showCopy };
}

export default function Library({
  currentPlayingTrack,
  onSetPlayingTrack,
}: {
  currentPlayingTrack: GlobalPlayerTrack | null
  onSetPlayingTrack: (track: GlobalPlayerTrack | null) => void
}) {
  // currentPlayingTrack is received from App-level state for future highlight support
  void currentPlayingTrack
  const [searchParams, setSearchParams] = useSearchParams();
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiConnected, setApiConnected] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<FilterSource>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailTrack, setDetailTrack] = useState<TrackItem | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => readFavorites());
  const { toast, showCopy } = useCopyToast();

  const loadTracks = async () => {
    setLoading(true);
    try {
      const result = await listTracks();
      if (result.ok && result.tracks.length > 0) {
        setTracks(result.tracks.map(serverTrackToItem));
        setApiConnected(true);
        setShowHint(false);
      } else {
        setTracks(MOCK_TASKS.map(mockTaskToItem));
        setApiConnected(true);
        setShowHint(true);
      }
    } catch {
      setTracks(MOCK_TASKS.map(mockTaskToItem));
      setApiConnected(false);
      setShowHint(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTracks();
  }, []);

  // Auto-open detail drawer when ?track=<id> is in the URL
  useEffect(() => {
    const trackId = searchParams.get('track');
    if (!trackId) return;
    if (tracks.length === 0) return;
    const found = tracks.find(t => t.id === trackId);
    if (found) {
      setDetailTrack(found);
      setSearchParams({}, { replace: true });
    }
  }, [tracks, searchParams, setSearchParams]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      writeFavorites(next);
      return next;
    });
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => showCopy('已复制 ID')).catch(() => showCopy('复制失败'));
  };

  const handleCopyPrompt = (prompt?: string) => {
    if (!prompt) { showCopy('无提示词'); return; }
    navigator.clipboard.writeText(prompt).then(() => showCopy('已复制提示词')).catch(() => showCopy('复制失败'));
  };

  const handleCopyShareLink = (track: TrackItem) => {
    const shareUrl = `${window.location.origin}/library?track=${encodeURIComponent(track.id)}`;
    navigator.clipboard.writeText(shareUrl).then(() => showCopy('分享链接已复制')).catch(() => showCopy('复制失败'));
  };

  const handleExportTrackInfo = (track: TrackItem) => {
    const source = track.isMock ? '示例' : (track.generationSource === 'mmx-cli' ? 'MMX CLI' : track.generationSource === 'minimax' ? 'MiniMax API' : track.generationSource || '—');
    const createdAt = track.createdAt ? new Date(track.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '—';
    const downloadLine = track.downloadUrl ? `- 下载：${track.downloadUrl}` : '';
    const promptLine = track.prompt ? `\n\n## Prompt\n\n${track.prompt}` : '\n\n## Prompt\n\n未记录 prompt';
    const md = `# ${track.title || '无标题'}
\n- 来源：${source}
- 时长：${track.durationText || '—'}
- 创建时间：${createdAt}
- Track ID：${track.id}${downloadLine}${promptLine}
`;
    navigator.clipboard.writeText(md).then(() => showCopy('作品信息已复制')).catch(() => showCopy('复制失败'));
  };

  // Phase Product Polish-G: Convert TrackItem → GlobalPlayerTrack
function itemToGlobal(track: TrackItem): GlobalPlayerTrack {
  return {
    id: track.id,
    title: track.title,
    audioUrl: track.audioUrl ?? '',
    downloadUrl: track.downloadUrl,
    durationText: track.durationText,
    generationSource: track.generationSource,
    mode: track.mode,
  };
}

const handlePlay = (track: TrackItem) => {
  // Phase Product Polish-G: delegate to global player
  if (track.audioUrl) {
    onSetPlayingTrack(itemToGlobal(track));
  }
};

  const handleDelete = async (track: TrackItem) => {
    if (!apiConnected || track.isMock) return;
    if (!window.confirm(`确定要删除「${track.title}」吗？`)) return;
    setDeletingId(track.id);
    try {
      const result = await deleteTrack(track.id);
      if (result.ok) {
        setTracks(prev => prev.filter(t => t.id !== track.id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  // Combined filter: source × search
  const filteredTracks = tracks.filter(t => {
    // Source filter
    if (filterSource === 'favorites') {
      if (!favorites.has(t.id)) return false;
    } else if (filterSource === 'mock') {
      if (!t.isMock) return false;
    } else if (filterSource === 'mmx-cli') {
      if (t.generationSource !== 'mmx-cli') return false;
    } else if (filterSource === 'minimax-api') {
      if (t.generationSource !== 'minimax') return false;
    }
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchPrompt = (t.prompt || '').toLowerCase().includes(q);
      const matchLyrics = (t.lyrics || '').toLowerCase().includes(q);
      const matchSource = sourceLabel(t.generationSource, t.isMock).toLowerCase().includes(q);
      const matchMode = (MODE_LABELS[t.mode as keyof typeof MODE_LABELS] || t.mode).toLowerCase().includes(q);
      if (!matchTitle && !matchPrompt && !matchLyrics && !matchSource && !matchMode) return false;
    }
    return true;
  });

  const handleCloseDetail = () => setDetailTrack(null);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>作品库</h1>
          </div>
          <div className={styles.loading}><span className={styles.spinner} />加载中…</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <h1 className={styles.title}>作品库</h1>
            <p className={styles.desc}>
              {filteredTracks.length === tracks.length
                ? `${tracks.length} 首作品`
                : `${filteredTracks.length} / ${tracks.length} 首`}
            </p>
          </div>

          {/* Search */}
          <div className={styles.searchRow}>
            <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className={styles.searchInput}
              placeholder="搜索标题、提示词或来源…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className={styles.searchClear} onClick={() => setSearchQuery('')} aria-label="清除搜索">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>

          {/* Source filter tabs */}
          <div className={styles.filterTabs}>
            {FILTER_TABS.map(f => (
              <button
                key={f.key}
                className={`${styles.filterTab} ${filterSource === f.key ? styles.active : ''}`}
                onClick={() => setFilterSource(f.key)}
              >
                {f.key === 'favorites' && favorites.size > 0 ? (
                  <span className={styles.filterWithBadge}>
                    {f.label}<span className={styles.badge}>{favorites.size}</span>
                  </span>
                ) : f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hint */}
        {showHint && (
          <div className={styles.apiHint}>
            {!apiConnected ? '未连接本地服务，当前显示示例作品' : '还没有真实作品，去创作台生成第一首音乐'}
          </div>
        )}

        {/* Grid */}
        <div className={styles.grid}>
          {filteredTracks.map(track => (
            <div key={track.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardInfo}>
                  <h3 className={styles.cardTitle}>{track.title}</h3>
                  <div className={styles.cardMeta}>
                    <span className={styles.cardMode}>
                      {MODE_LABELS[track.mode as keyof typeof MODE_LABELS] || track.mode}
                    </span>
                    <span className={`${styles.sourceTag} ${track.generationSource === 'mmx-cli' ? styles.cliTag : track.generationSource === 'minimax' ? styles.minimaxTag : styles.mockTag}`}>
                      {sourceLabel(track.generationSource, track.isMock)}
                    </span>
                  </div>
                </div>
                {/* Favorite button */}
                <button
                  className={`${styles.favoriteBtn} ${favorites.has(track.id) ? styles.favorited : ''}`}
                  onClick={() => toggleFavorite(track.id)}
                  aria-label={favorites.has(track.id) ? '取消收藏' : '收藏'}
                >
                  {favorites.has(track.id) ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  )}
                </button>
              </div>

              {/* Mini waveform */}
              <div className={styles.miniWave}>
                {Array.from({ length: 24 }, (_, i) => {
                  const h = [40,60,80,100,80,60,90,70,100,80,60,90,50,80,100,70,90,60,80,100,60,80,90,70][i];
                  return <div key={i} className={styles.miniBar} style={{ height: `${h}%` }} />;
                })}
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.duration}>{track.durationText}</span>
                <div className={styles.cardActions}>
                  {track.audioUrl ? (
                    <button className={styles.playBtn} onClick={() => handlePlay(track)} aria-label="试听">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      试听
                    </button>
                  ) : (
                    <span className={`${styles.playBtn} ${styles.disabled}`} aria-label="试听">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      试听
                    </span>
                  )}
                  <button className={styles.detailBtn} onClick={() => setDetailTrack(track)} aria-label="详情">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    详情
                  </button>
                  {!track.isMock && (
                    <button className={`${styles.deleteBtn} ${deletingId === track.id ? styles.deleting : ''}`}
                      onClick={() => handleDelete(track)} disabled={deletingId === track.id} aria-label="删除">
                      {deletingId === track.id ? '删除中…' : '删除'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {filteredTracks.length === 0 && !loading && (
          <div className={styles.empty}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            {searchQuery ? (
              <>
                <h3>没有匹配「{searchQuery}」的作品</h3>
                <p>试试其他关键词，或清除搜索</p>
                <button className={styles.emptyBtn} onClick={() => setSearchQuery('')}>清除搜索</button>
              </>
            ) : filterSource === 'favorites' ? (
              <>
                <h3>还没有收藏</h3>
                <p>点击作品卡片上的星标收藏你喜欢的音乐</p>
              </>
            ) : (
              <>
                <h3>还没有这个来源的作品</h3>
                <p>换个筛选条件，或去创作台生成新的音乐</p>
                <Link to="/studio" className={styles.emptyBtn}>开始创作</Link>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Detail Drawer ── */}
      {detailTrack && (
        <>
          <div className={styles.drawerOverlay} onClick={handleCloseDetail} />
          <div className={styles.drawer}>
            <div className={styles.drawerHeader}>
              <h2 className={styles.drawerTitle}>作品详情</h2>
              <button className={styles.drawerClose} onClick={handleCloseDetail} aria-label="关闭">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className={styles.drawerBody}>
              <h3 className={styles.detailTitle}>{detailTrack.title}</h3>

              <div className={styles.detailMeta}>
                <span className={`${styles.sourceTag} ${detailTrack.generationSource === 'mmx-cli' ? styles.cliTag : detailTrack.generationSource === 'minimax' ? styles.minimaxTag : styles.mockTag}`}>
                  {sourceLabel(detailTrack.generationSource, detailTrack.isMock)}
                </span>
                <span className={styles.detailMode}>
                  {MODE_LABELS[detailTrack.mode as keyof typeof MODE_LABELS] || detailTrack.mode}
                </span>
              </div>

              <div className={styles.detailGrid}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>创建时间</span>
                  <span className={styles.detailValue}>{formatRelativeTime(detailTrack.createdAt)}</span>
                </div>
                {detailTrack.durationText && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>时长</span>
                    <span className={styles.detailValue}>{detailTrack.durationText}</span>
                  </div>
                )}
                {detailTrack.durationMs && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>时长（毫秒）</span>
                    <span className={styles.detailValue}>{detailTrack.durationMs.toLocaleString()} ms</span>
                  </div>
                )}
                {detailTrack.audioFormat && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>音频格式</span>
                    <span className={styles.detailValue}>{detailTrack.audioFormat.toUpperCase()}</span>
                  </div>
                )}
                {detailTrack.audioMimeType && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>MIME</span>
                    <span className={styles.detailValue}>{detailTrack.audioMimeType}</span>
                  </div>
                )}
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Track ID</span>
                  <div className={styles.detailIdRow}>
                    <span className={styles.detailId}>{detailTrack.id}</span>
                    <button className={styles.copyBtn} onClick={() => handleCopyId(detailTrack.id)} aria-label="复制 ID">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                      </svg>
                      复制
                    </button>
                  </div>
                </div>
              </div>

              {(detailTrack.prompt || detailTrack.lyrics) && (
                <div className={styles.detailSection}>
                  {detailTrack.prompt && (
                    <>
                      <div className={styles.detailSectionLabel}>
                        <span>提示词</span>
                        <button className={styles.copyBtn} onClick={() => handleCopyPrompt(detailTrack.prompt)} aria-label="复制提示词">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                          </svg>
                          复制
                        </button>
                      </div>
                      <p className={styles.detailPrompt}>{detailTrack.prompt}</p>
                    </>
                  )}
                  {detailTrack.lyrics && (
                    <>
                      <div className={styles.detailSectionLabel}>歌词</div>
                      <p className={styles.detailPrompt}>{detailTrack.lyrics}</p>
                    </>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className={styles.detailActions}>
                {detailTrack.audioUrl ? (
                  <button className={styles.actionBtn} onClick={() => handlePlay(detailTrack)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    播放
                  </button>
                ) : (
                  <span className={`${styles.actionBtn} ${styles.disabled}`}>无可播放音频</span>
                )}
                {detailTrack.downloadUrl ? (
                  <a href={detailTrack.downloadUrl} download className={`${styles.actionBtn} ${styles.secondary}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    下载
                  </a>
                ) : (
                  <span className={`${styles.actionBtn} ${styles.secondary} ${styles.disabled}`}>无可下载</span>
                )}
                {detailTrack.prompt && (
                  <button className={`${styles.actionBtn} ${styles.secondary}`} onClick={() => handleCopyPrompt(detailTrack.prompt)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                    复制提示词
                  </button>
                )}
                <button className={`${styles.actionBtn} ${styles.secondary}`} onClick={() => handleCopyShareLink(detailTrack)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                  </svg>
                  分享
                </button>
                <button className={`${styles.actionBtn} ${styles.secondary}`} onClick={() => handleExportTrackInfo(detailTrack)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                  </svg>
                  导出
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
