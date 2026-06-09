import { Link } from 'react-router-dom'
import styles from './Home.module.css'

export default function Home() {
  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className={styles.badgeDot} />
            公网已启用 · 推荐 MMX CLI 模式
          </div>
          <h1 className={styles.title}>MMX Music Studio</h1>
          <p className={styles.subtitle}>
            一个自托管的 AI 音乐创作工作台：写下场景和情绪，生成、试听、
            收藏并下载你的音乐。
          </p>
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

      {/* Quick Start */}
      <section className={styles.quickStart}>
        <h2 className={styles.sectionTitle}>快速开始</h2>
        <div className={styles.stepsGrid}>
          <div className={styles.step}>
            <div className={styles.stepNum}>1</div>
            <div className={styles.stepBody}>
              <p className={styles.stepHeading}>写一句音乐描述</p>
              <p className={styles.stepHint}>例如："深夜编程，Coffee Jazz"</p>
            </div>
          </div>
          <div className={styles.stepArrow}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNum}>2</div>
            <div className={styles.stepBody}>
              <p className={styles.stepHeading}>点击生成，等待完成</p>
              <p className={styles.stepHint}>MMX CLI 后端，本地运行，无需 API Key</p>
            </div>
          </div>
          <div className={styles.stepArrow}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNum}>3</div>
            <div className={styles.stepBody}>
              <p className={styles.stepHeading}>播放、下载或收藏</p>
              <p className={styles.stepHint}>MP3 直接下载，支持收藏到作品库</p>
            </div>
          </div>
        </div>
      </section>

      {/* Status Card */}
      <section className={styles.statusSection}>
        <div className={styles.statusCard}>
          <div className={styles.statusRow}>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>公网地址</span>
              <span className={styles.statusValue}>
               <a href="https://music.conanxin.com" target="_blank" rel="noopener noreferrer">
                  music.conanxin.com
                </a>
              </span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>推荐后端</span>
              <span className={styles.statusValue}>MMX CLI</span>
            </div>
           <div className={styles.statusItem}>
              <span className={styles.statusLabel}>当前版本</span>
              <span className={styles.statusValue}>v0.4.4-alpha</span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>API Adapter</span>
              <span className={styles.statusValue}>BYOK · 已验证</span>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
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
            <p>文字描述生成 BGM · 氛围音乐 · 纯音乐</p>
          </Link>

          <Link to="/library" className={styles.capCard}>
            <div className={styles.capIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 01419.5v-15A2.5 2.5 0 016.5 2z" />
              </svg>
            </div>
            <h3>Library 作品库</h3>
            <p>搜索 · 收藏 · 详情 · 下载 MP3</p>
          </Link>

          <div className={styles.capCard}>
            <div className={styles.capIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <h3>BYOK API Adapter</h3>
            <p>自备 Token Plan Key · 实验性功能</p>
          </div>

          <div className={styles.capCard}>
            <div className={styles.capIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 01410 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
              </svg>
            </div>
            <h3>Cloudflare Tunnel</h3>
            <p>公网免 SSH Tunnel 访问 · HTTPS</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerLinks}>
          <Link to="/settings">设置</Link>
          <span>·</span>
          <Link to="/docs">文档</Link>
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