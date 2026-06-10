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
              <span className={styles.statusValue}>v0.4.12-alpha</span>
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

      {/* Public Launch Readiness */}
      <section className={styles.launchSection}>
        <h2 className={styles.sectionTitle}>公开 Alpha · 可以开始试用</h2>
        <div className={styles.launchGrid}>
          <div className={styles.launchCard}>
            <div className={styles.launchCardIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <h3>真实生成</h3>
            <p>当前默认使用服务器 MMX CLI backend 生成音乐。</p>
          </div>
          <div className={styles.launchCard}>
            <div className={styles.launchCardIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
              </svg>
            </div>
            <h3>作品库</h3>
            <p>生成后的作品会进入 Library，可搜索、收藏、播放、导出。</p>
          </div>
          <div className={styles.launchCard}>
            <div className={styles.launchCardIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <h3>本地体验</h3>
            <p>收藏、模板、播放队列保存在当前浏览器。</p>
          </div>
          <div className={styles.launchCard}>
            <div className={styles.launchCardIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
              </svg>
            </div>
            <h3>实验能力</h3>
            <p>BYOK API Adapter 已验证 direct_audio，async polling 已预备，仍属实验能力。</p>
          </div>
        </div>
        <div className={styles.launchCta}>
          <Link to="/studio" className={styles.primaryBtn}>开始创作</Link>
          <Link to="/library" className={styles.secondaryBtn}>查看作品库</Link>
          <a href="https://github.com/conanxin/mmx-music-studio" target="_blank" rel="noopener noreferrer" className={styles.ghBtn}>GitHub</a>
        </div>
      </section>

      {/* Data & Trust */}
      <section className={styles.trustSection}>
        <h2 className={styles.sectionTitle}>数据与限制</h2>
        <div className={styles.trustGrid}>
          <div className={styles.trustCard}>
            <h3>浏览器本地数据</h3>
            <p>收藏、Prompt 模板、播放队列、播放进度保存在当前浏览器 localStorage。</p>
          </div>
          <div className={styles.trustCard}>
            <h3>生成记录</h3>
            <p>生成后的曲目信息由服务器保存，用于 Library 展示和播放。</p>
          </div>
          <div className={styles.trustCard}>
            <h3>API Key</h3>
            <p>BYOK Key 仅用于一次生成请求的内存任务上下文，不写入磁盘；当前默认推荐 CLI backend。</p>
          </div>
          <div className={styles.trustCard}>
            <h3>当前限制</h3>
            <p>当前是 alpha 版本；Cloudflare Access 未启用；请不要输入敏感 prompt。</p>
          </div>
          <div className={styles.trustCard}>
            <h3>生成保护</h3>
            <p>公开 Alpha 启用了轻量生成保护：同一访问来源每日有生成次数与冷却限制，用于保护服务器和额度。</p>
            <p>运行状态可通过健康检查与公开状态摘要观察。</p>
          </div>
        </div>
      </section>

      {/* Feedback & Version */}
      <section className={styles.feedbackSection}>
        <div className={styles.feedbackCard}>
          <div className={styles.feedbackBadge}>
            <span className={styles.feedbackDot}/>
            v0.4.16-alpha · Public Alpha
          </div>
          <h2 className={styles.feedbackTitle}>反馈与参与</h2>
          <div className={styles.feedbackLinks}>
            <a href="https://github.com/conanxin/mmx-music-studio/issues" target="_blank" rel="noopener noreferrer" className={styles.feedbackLink}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              提交问题
            </a>
            <a href="https://github.com/conanxin/mmx-music-studio" target="_blank" rel="noopener noreferrer" className={styles.feedbackLink}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/>
              </svg>
              查看源码
            </a>
            <a href="https://github.com/conanxin/mmx-music-studio/releases/tag/v0.4.12-alpha" target="_blank" rel="noopener noreferrer" className={styles.feedbackLink}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Release Notes
            </a>
          </div>
          <p className={styles.feedbackPublicUrl}>
            公网访问：
            <a href="https://music.conanxin.com" target="_blank" rel="noopener noreferrer">music.conanxin.com</a>
          </p>
          <p className={styles.feedbackPublicUrl}>
            运行状态：
            <a href="/ops" target="_blank" rel="noopener noreferrer">运维诊断页</a>（只读）
          </p>
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