import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import styles from './Layout.module.css'
import type { GlobalPlayerTrack } from '../lib/globalPlayerTrack'

interface LayoutProps {
  currentPlayingTrack: GlobalPlayerTrack | null
  onSetPlayingTrack: (track: GlobalPlayerTrack | null) => void
}

export default function Layout({ currentPlayingTrack, onSetPlayingTrack }: LayoutProps) {
  const location = useLocation()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

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

  const togglePlay = () => {
    if (!audioRef.current || !currentPlayingTrack?.audioUrl) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
  }

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

      {/* Phase Product Polish-G: Global mini player */}
      {currentPlayingTrack && (
        <div className={styles.globalMiniPlayer}>
          <div className={styles.globalMiniPlayerInner}>
            <div className={styles.globalMiniPlayerInfo}>
              <span className={styles.globalMiniPlayerLabel}>当前播放</span>
              <span className={styles.globalMiniPlayerTitle}>{currentPlayingTrack.title}</span>
              {currentPlayingTrack.generationSource && (
                <span className={styles.globalMiniPlayerSource}>{currentPlayingTrack.generationSource}</span>
              )}
            </div>
            <div className={styles.globalMiniPlayerActions}>
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
                onClick={() => onSetPlayingTrack(null)}
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