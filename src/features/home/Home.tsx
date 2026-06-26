import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './Home.module.css'
import {
  getTrackAudioUrl,
  getTrackDownloadUrl,
  listTracks,
  type TrackLike,
} from '../../lib/serverApi'

const CURRENT_RELEASE = 'v0.4.33-alpha'

function trackCreatedAt(track: TrackLike): number {
  if (typeof track.createdAt === 'number') return track.createdAt
  if (typeof track.createdAt === 'string') {
    const parsed = Date.parse(track.createdAt)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

function isRealPlayableTrack(track: TrackLike): boolean {
  if (!track.id) return false
  if (track.visibility === 'demo') return false
  if (track.generationSource === 'mock') return false
  return Boolean(
    track.audioUrl ||
    track.status === 'ready' ||
    track.status === 'success' ||
    track.status === 'succeeded' ||
    track.status === 'completed',
  )
}

function pickLatestRealTrack(tracks: TrackLike[]): TrackLike | null {
  return [...tracks]
    .filter(isRealPlayableTrack)
    .sort((a, b) => trackCreatedAt(b) - trackCreatedAt(a))[0] ?? null
}

function modeLabel(mode: string): string {
  if (mode === 'instrumental' || mode === 'pure-music') return '纯音乐'
  if (mode === 'lyrics' || mode === 'lyric-song') return '歌词成歌'
  if (mode === 'auto' || mode === 'auto-song') return '自动成歌'
  return mode || '音乐作品'
}

export default function Home() {
  const [featuredTrack, setFeaturedTrack] = useState<TrackLike | null>(null)
  const [tracksLoading, setTracksLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void listTracks()
      .then((result) => {
        if (cancelled) return
        setFeaturedTrack(result.ok ? pickLatestRealTrack(result.tracks) : null)
      })
      .finally(() => {
        if (!cancelled) setTracksLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const featuredAudioUrl = featuredTrack
    ? featuredTrack.audioUrl || getTrackAudioUrl(featuredTrack.id)
    : ''
  const featuredDownloadUrl = featuredTrack
    ? featuredTrack.downloadUrl || getTrackDownloadUrl(featuredTrack.id)
    : ''

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className={styles.badgeDot} />
            {CURRENT_RELEASE} · Public-Lite Demo Ready
          </div>
          <h1 className={styles.title}>MMX Music Studio</h1>
          <p className={styles.subtitle}>
            5 人内轻量公开 BYOK 音乐生成 demo。输入音乐描述，使用自己的 MiniMax API Key，
            排队生成一首可播放、可下载的音乐。
          </p>
          <div className={styles.safeDefaultNotice} data-safe-default-ui="home">
            <strong>轻量公开模式</strong>
            <span>本站不保存 API Key；生成任务单并发排队执行；超过 5 个活跃用户时生成会暂时暂停，页面和作品库仍可浏览。</span>
          </div>
          <div className={styles.heroActions}>
            <Link to="/studio" className={styles.primaryBtn}>
              开始创作
            </Link>
            <Link to="/library" className={styles.secondaryBtn}>
              查看作品库
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.quickStart}>
        <h2 className={styles.sectionTitle}>三步开始</h2>
        <div className={styles.stepsGrid}>
          <div className={styles.step}>
            <div className={styles.stepNum}>1</div>
            <div className={styles.stepBody}>
              <p className={styles.stepHeading}>准备自己的 MiniMax API Key</p>
              <p className={styles.stepHint}>生成费用由你的 MiniMax 账户承担。</p>
            </div>
          </div>
          <div className={styles.stepArrow} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNum}>2</div>
            <div className={styles.stepBody}>
              <p className={styles.stepHeading}>输入 Key 和音乐描述</p>
              <p className={styles.stepHint}>可从 Studio 模板开始，不会自动提交。</p>
            </div>
          </div>
          <div className={styles.stepArrow} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNum}>3</div>
            <div className={styles.stepBody}>
              <p className={styles.stepHeading}>排队生成并试听</p>
              <p className={styles.stepHint}>完成后可播放、下载 MP3、进入 Library。</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.demoSection}>
        <h2 className={styles.sectionTitle}>Demo 说明</h2>
        <div className={styles.demoGrid}>
          <div className={styles.demoCard}>
            <h3>BYOK 自带 Key</h3>
            <p>你在页面填写自己的 MiniMax API Key。Key 仅在本次排队任务期间临时保存在服务器内存中，任务完成、失败、取消或过期后删除。</p>
          </div>
          <div className={styles.demoCard}>
            <h3>本站不保存 Key</h3>
            <p>Key 不写入磁盘、浏览器存储、作品库、manifest、日志或 Git。请不要在 prompt 中输入敏感信息。</p>
          </div>
          <div className={styles.demoCard}>
            <h3>单并发排队</h3>
            <p>任务按顺序执行，jobQueue concurrency=1。页面会展示排队、生成、成功或失败状态。</p>
          </div>
          <div className={styles.demoCard}>
            <h3>5 人内轻量公开</h3>
            <p>Public Lite 最多 5 个活跃用户。超过容量时只暂停生成和保存，不会停止整站。</p>
          </div>
        </div>
      </section>

      <section className={styles.featuredSection}>
        <div className={styles.featuredHeader}>
          <h2>最近真实生成作品</h2>
          <Link to="/library" className={styles.featuredLibraryLink}>进入 Library</Link>
        </div>
        {tracksLoading ? (
          <div className={styles.featuredEmpty}>正在读取作品库…</div>
        ) : featuredTrack ? (
          <div className={styles.featuredCard}>
            <div className={styles.featuredMeta}>
              <span className={styles.featuredKicker}>可播放 demo</span>
              <h3>{featuredTrack.title || '最近生成作品'}</h3>
              <p>
                {modeLabel(featuredTrack.mode)}
                {featuredTrack.durationText ? ` · ${featuredTrack.durationText}` : ''}
                {featuredTrack.generationSource ? ` · ${featuredTrack.generationSource}` : ''}
              </p>
            </div>
            <audio className={styles.featuredAudio} controls src={featuredAudioUrl} />
            <div className={styles.featuredActions}>
              <a href={featuredDownloadUrl} download className={styles.primaryBtn}>下载 MP3</a>
              <Link to={`/library?track=${encodeURIComponent(featuredTrack.id)}`} className={styles.secondaryBtn}>
                在作品库查看
              </Link>
            </div>
          </div>
        ) : (
          <div className={styles.featuredEmpty}>
            <strong>还没有可展示的真实生成作品</strong>
            <span>完成第一首 BYOK 生成后，这里会自动展示最近可播放作品。</span>
            <Link to="/studio" className={styles.inlineLink}>去 Studio 生成</Link>
          </div>
        )}
      </section>

      <section className={styles.capabilities}>
        <div className={styles.capGrid}>
          <Link to="/studio" className={styles.capCard}>
            <div className={styles.capIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <h3>Studio 创作</h3>
            <p>模板起步 · BYOK 排队生成 · 播放和下载</p>
          </Link>

          <Link to="/library" className={styles.capCard}>
            <div className={styles.capIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              </svg>
            </div>
            <h3>Library 作品库</h3>
            <p>播放 · 下载 MP3 · 查看历史作品</p>
          </Link>

          <div className={styles.capCard}>
            <div className={styles.capIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <h3>Key 不持久化</h3>
            <p>仅临时用于排队任务，不写入磁盘或浏览器存储。</p>
          </div>

          <div className={styles.capCard}>
            <div className={styles.capIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
              </svg>
            </div>
            <h3>轻量公开</h3>
            <p>适合小范围 demo；超过 5 人后再升级账号和配额系统。</p>
          </div>
        </div>
      </section>

      <section className={styles.feedbackSection}>
        <div className={styles.feedbackCard}>
          <div className={styles.feedbackBadge}>
            <span className={styles.feedbackDot}/>
            {CURRENT_RELEASE} · Public-Lite alpha
          </div>
          <h2 className={styles.feedbackTitle}>反馈与参与</h2>
          <div className={styles.feedbackLinks}>
            <a href="https://github.com/conanxin/mmx-music-studio/issues" target="_blank" rel="noopener noreferrer" className={styles.feedbackLink}>
              提交问题
            </a>
            <a href="https://github.com/conanxin/mmx-music-studio" target="_blank" rel="noopener noreferrer" className={styles.feedbackLink}>
              查看源码
            </a>
            <a href="https://github.com/conanxin/mmx-music-studio/releases/tag/v0.4.33-alpha" target="_blank" rel="noopener noreferrer" className={styles.feedbackLink}>
              Release Notes
            </a>
          </div>
          <p className={styles.feedbackPublicUrl}>
            公网访问：
            <a href="https://music.conanxin.com" target="_blank" rel="noopener noreferrer">music.conanxin.com</a>
          </p>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerLinks}>
          <Link to="/studio">创作</Link>
          <span>·</span>
          <Link to="/library">作品库</Link>
          <span>·</span>
          <a href="https://github.com/conanxin/mmx-music-studio/blob/master/CHANGELOG.md" target="_blank" rel="noopener noreferrer">Release Notes</a>
        </div>
        <p className={styles.disclaimer}>
          开源项目 · MIT License · 非官方 · Not affiliated with MiniMax
        </p>
      </footer>
    </div>
  )
}
