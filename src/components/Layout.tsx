import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import styles from './Layout.module.css'
import type { GlobalPlayerTrack } from '../lib/globalPlayerTrack'

interface LayoutProps {
  currentPlayingTrack: GlobalPlayerTrack | null
  onSetPlayingTrack: (track: GlobalPlayerTrack | null) => void
  playbackQueue: GlobalPlayerTrack[]
  playbackIndex: number
  queueSourceLabel?: string
  onPlayNext: () => void
  onPlayPrevious: () => void
  onRemoveFromQueue: (index: number) => void
  onClearQueue: () => void
}

export default function Layout({
  currentPlayingTrack,
  onSetPlayingTrack,
  playbackQueue,
  playbackIndex,
  queueSourceLabel,
  onPlayNext,
  onPlayPrevious,
  onRemoveFromQueue,
  onClearQueue,
}: LayoutProps) {
  const location = useLocation()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [isQueueOpen, setIsQueueOpen] = useState(false)

  // Sync audio when track changes
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
    }
    const audio = audioRef.current
    if (currentPlayingTrack?.audioUrl) {
      if (audio.src !== currentPlayingTrack.audioUrl) {
        audio.src = currentPlayingTrack.audioUrl
        setPlaying(false)
      }
    }
  }, [currentPlayingTrack])

  // Stop when track is cleared
  useEffect(() => {
    if (!currentPlayingTrack && audioRef.current) {
      audioRef.current.pause()
      setPlaying(false)
    }
  }, [currentPlayingTrack])

  // Phase Product Polish-H: audio ended → auto-play next
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const handleEnded = () => {
      onPlayNext()
    }
    audio.addEventListener('ended', handleEnded)
    return () => {
      audio.removeEventListener('ended', handleEnded)
    }
  }, [onPlayNext])

  const togglePlay = () => {
    if (!audioRef.current || !currentPlayingTrack?.audioUrl) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
  }

  const toggleQueue = () => setIsQueueOpen(prev => !prev)

  // Derived: queue info
  const queueLength = playbackQueue.length
  const hasPrev = playbackIndex > 0
  const hasNext = playbackIndex < queueLength - 1
  const showQueueLabel = queueSourceLabel || (queueLength > 1 ? `第 ${playbackIndex + 1} / ${queueLength} 首` : queueLength === 1 ? '单曲播放' : '')

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.logo}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#B8FF6A" strokeWidth="2"/>
              <path d="M9 8l6 4-6 4V8z" fill="#B8FF6A"/>
            </svg>
            <span className={styles.logoText}>MiniMax 音乐创作台</span>
          </Link>

          <nav className={styles.nav}>
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`${styles.navLink} ${location.pathname === item.path ? styles.active : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className={styles.headerRight}>
            <Link to="/settings" className={styles.settingsBtn} aria-label="设置">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      {/* Phase Product Polish-G + H: Global mini player */}
      {currentPlayingTrack && (
        <div className={styles.globalMiniPlayer}>
          <div className={styles.globalMiniPlayerInner}>
            {/* Queue panel (slides in from right) */}
            {isQueueOpen && (
              <div className={styles.queuePanel}>
                <div className={styles.queuePanelHeader}>
                  <span className={styles.queuePanelTitle}>播放队列</span>
                  {queueSourceLabel && (
                    <span className={styles.queueSourceLabel}>{queueSourceLabel}</span>
                  )}
                  <button
                    className={styles.queuePanelClose}
                    onClick={toggleQueue}
                    aria-label="关闭队列"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                <div className={styles.queuePanelBody}>
                  {playbackQueue.length === 0 ? (
                    <div className={styles.queueEmpty}>队列为空</div>
                  ) : (
                    playbackQueue.map((track, i) => (
                      <div
                        key={track.id}
                        className={`${styles.queueItem} ${i === playbackIndex ? styles.queueItemActive : ''}`}
                        onClick={() => {
                          // Jump to this track by calling onPlayPrevious/onPlayNext repeatedly
                          // We can't directly set index from here, so we just close the panel
                          // The parent will handle navigation through normal prev/next
                          setIsQueueOpen(false)
                        }}
                      >
                        <span className={styles.queueItemIndex}>{i + 1}</span>
                        <span className={styles.queueItemTitle}>{track.title}</span>
                        {track.generationSource && (
                          <span className={styles.queueItemSource}>{track.generationSource}</span>
                        )}
                        <button
                          className={styles.queueItemRemove}
                          onClick={e => { e.stopPropagation(); onRemoveFromQueue(i); }}
                          aria-label="从队列移除"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                     </div>
                    ))
                  )}
                </div>
                {playbackQueue.length > 0 && (
                  <div className={styles.queuePanelFooter}>
                    <button className={styles.clearQueueBtn} onClick={() => { onClearQueue(); setIsQueueOpen(false); }}>
                      清空队列
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className={styles.globalMiniPlayerInfo}>
              <span className={styles.globalMiniPlayerLabel}>当前播放</span>
              <span className={styles.globalMiniPlayerTitle}>{currentPlayingTrack.title}</span>
              {currentPlayingTrack.generationSource && (
                <span className={styles.globalMiniPlayerSource}>{currentPlayingTrack.generationSource}</span>
              )}
              {showQueueLabel && (
                <span className={styles.globalMiniPlayerQueueLabel}>{showQueueLabel}</span>
              )}
            </div>
            <div className={styles.globalMiniPlayerActions}>
              {/* Phase Product Polish-H: Previous */}
              <button
                className={`${styles.globalMiniPlayerPrev} ${!hasPrev ? styles.disabled : ''}`}
                onClick={hasPrev ? onPlayPrevious : undefined}
                disabled={!hasPrev}
                title="上一首"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                </svg>
              </button>

              {currentPlayingTrack.audioUrl && (
                <button
                  className={styles.globalMiniPlayerPlay}
                  onClick={togglePlay}
                  title={playing ? '暂停' : '播放'}
                >
                  {playing ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="6" y="4" width="4" height="16"/>
                      <rect x="14" y="4" width="4" height="16"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                  )}
                </button>
              )}

              {/* Phase Product Polish-H: Next */}
              <button
                className={`${styles.globalMiniPlayerNext} ${!hasNext ? styles.disabled : ''}`}
                onClick={hasNext ? onPlayNext : undefined}
                disabled={!hasNext}
                title="下一首"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                </svg>
              </button>

              {currentPlayingTrack.downloadUrl && (
                <a
                  href={currentPlayingTrack.downloadUrl}
                  className={styles.globalMiniPlayerDownload}
                  download
                  title="下载 MP3"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </a>
              )}

              {/* Phase Product Polish-H: Queue toggle */}
              <button
                className={`${styles.globalMiniPlayerQueue} ${isQueueOpen ? styles.active : ''}`}
                onClick={toggleQueue}
                title="播放队列"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6"/>
                  <line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                {queueLength > 1 && <span className={styles.queueBadge}>{queueLength}</span>}
              </button>

              <Link
                to="/library"
                className={styles.globalMiniPlayerLibrary}
                title="查看作品库"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
                </svg>
              </Link>
              <button
                className={styles.globalMiniPlayerClose}
                onClick={() => { onSetPlayingTrack(null); setIsQueueOpen(false); }}
                title="关闭"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const navItems = [
  { path: '/', label: '首页' },
  { path: '/studio', label: '创作' },
  { path: '/library', label: '作品' },
  { path: '/jobs', label: '任务' },
  { path: '/settings', label: '设置' },
  { path: '/docs', label: '文档' },
]