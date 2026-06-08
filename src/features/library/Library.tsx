import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './Library.module.css';
import { MOCK_TASKS, formatDuration, formatRelativeTime, MODE_LABELS } from '../../mock/data';
import { listTracks, deleteTrack } from '../../lib/serverApi';
import type { TrackLike } from '../../lib/serverApi';

type TrackItem = {
  id: string;
  title: string;
  mode: string;
  durationText?: string;
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
    durationText: t.durationText,
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

export default function Library() {
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiConnected, setApiConnected] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const handlePlay = (track: TrackItem) => {
    if (track.audioUrl) {
      const audio = new Audio(track.audioUrl);
      audio.play().catch(() => {});
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

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>作品库</h1>
          </div>
          <div className={styles.loading}>
            <span className={styles.spinner} />
            加载中…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>作品库</h1>
          <p className={styles.desc}>{tracks.length} 首作品</p>
        </div>

        {showHint && (
          <div className={styles.apiHint}>
            {!apiConnected
              ? '未连接本地服务，当前显示示例作品'
              : '还没有真实作品，去创作台生成第一首音乐'}
          </div>
        )}

        <div className={styles.grid}>
          {tracks.map(track => (
            <div key={track.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardInfo}>
                  <h3 className={styles.cardTitle}>{track.title}</h3>
                  <div className={styles.cardMeta}>
                    <span className={styles.cardMode}>
                      {MODE_LABELS[track.mode as keyof typeof MODE_LABELS] || track.mode}
                    </span>
                    {!track.isMock && track.generationSource && (
                      <span className={`${styles.sourceTag} ${track.generationSource === 'mock' ? styles.mockTag : track.generationSource === 'mmx-cli' ? styles.cliTag : styles.minimaxTag}`}>
                        {track.generationSource === 'mock' ? '本地模拟' : track.generationSource === 'mmx-cli' ? 'MMX CLI' : 'MiniMax'}
                      </span>
                    )}
                    {track.isMock && (
                      <span className={`${styles.sourceTag} ${styles.mockTag}`}>示例</span>
                    )}
                  </div>
                </div>
                <span className={styles.cardTime}>{formatRelativeTime(track.createdAt)}</span>
              </div>

              {/* Mini waveform */}
              <div className={styles.miniWave}>
                {Array.from({ length: 24 }, (_, i) => {
                  const h = [40, 60, 80, 100, 80, 60, 90, 70, 100, 80, 60, 90, 50, 80, 100, 70, 90, 60, 80, 100, 60, 80, 90, 70][i];
                  return <div key={i} className={styles.miniBar} style={{ height: `${h}%` }} />;
                })}
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.duration}>{track.durationText}</span>
                <div className={styles.cardActions}>
                  {track.audioUrl ? (
                    <button
                      className={styles.playBtn}
                      onClick={() => handlePlay(track)}
                      aria-label="试听"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                      试听
                    </button>
                  ) : (
                    <span className={`${styles.playBtn} ${styles.disabled}`} aria-label="试听">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                      试听
                    </span>
                  )}
                  {track.downloadUrl ? (
                    <a
                      href={track.downloadUrl}
                      download
                      className={styles.downloadBtn}
                      aria-label="下载"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      下载
                    </a>
                  ) : (
                    <span className={`${styles.downloadBtn} ${styles.disabled}`} aria-label="下载">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      下载
                    </span>
                  )}
                  {!track.isMock && (
                    <button
                      className={`${styles.deleteBtn} ${deletingId === track.id ? styles.deleting : ''}`}
                      onClick={() => handleDelete(track)}
                      disabled={deletingId === track.id}
                      aria-label="删除"
                    >
                      {deletingId === track.id ? '删除中…' : '删除'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {tracks.length === 0 && (
          <div className={styles.empty}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
            <h3>还没有作品</h3>
            <p>去创作台生成你的第一首音乐吧</p>
            <Link to="/studio" className={styles.emptyBtn}>开始创作</Link>
          </div>
        )}
      </div>
    </div>
  );
}
