import styles from './Docs.module.css'

export default function Docs() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>开源说明</h1>
          <p className={styles.desc}>关于 MiniMax 音乐创作台</p>
        </div>

        <div className={styles.content}>
          <section className={styles.section}>
            <h2>关于项目</h2>
            <p>
              <strong>MiniMax 音乐创作台</strong>（mmx-music-studio）是一个开源、自托管、BYOK（Bring Your Own Key）的 MiniMax 音乐生成网站。
            </p>
            <p>
              项目目标是打造一个简约、有设计感、中文界面的音乐创作工具。用户可以填入自己的 MiniMax Token Plan Key，通过 MiniMax 的音乐生成能力，生成音乐、在线试听、下载 MP3、管理历史作品。
            </p>
          </section>

          <section className={styles.section}>
            <h2>非官方声明</h2>
            <div className={styles.highlight}>
              <p>
                ⚠️ 这是一个<strong>非官方的开源项目</strong>，与 MiniMax 无任何关联。
              </p>
              <p>
                本项目仅用于技术研究和个人学习目的。使用时请遵守 MiniMax 的服务条款和 API 使用政策。
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <h2>核心特性</h2>
            <ul className={styles.featureList}>
              <li>
                <span className={styles.featureIcon}>🎵</span>
                <div>
                  <strong>纯音乐生成</strong>
                  <p>输入描述词，快速生成 BGM、背景音乐、氛围音乐</p>
                </div>
              </li>
              <li>
                <span className={styles.featureIcon}>🎤</span>
                <div>
                  <strong>自动写词成歌</strong>
                  <p>输入主题，AI 自动写词并生成完整歌曲</p>
                </div>
              </li>
              <li>
                <span className={styles.featureIcon}>✍️</span>
                <div>
                  <strong>歌词成歌</strong>
                  <p>提供你的歌词，AI 为你谱曲并生成完整歌曲</p>
                </div>
              </li>
              <li>
                <span className={styles.featureIcon}>🔄</span>
                <div>
                  <strong>参考改编</strong>
                  <p>上传参考音频，AI 学习风格进行改编创作</p>
                </div>
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>安全与隐私</h2>
            <ul className={styles.bulletList}>
              <li>默认不保存用户 API Key</li>
              <li>Key 仅存在于当前会话内存中</li>
              <li>支持服务端环境变量模式，Key 不经过前端</li>
              <li>禁止日志打印 Authorization Header 和 API Key</li>
              <li>不收集任何用户数据</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>微信小程序准备</h2>
            <p>
              项目从第一天起就考虑了微信小程序迁移：
            </p>
            <ul className={styles.bulletList}>
              <li>业务逻辑全在 <code>packages/core</code>（平台无关）</li>
              <li>API 调用通过 <code>packages/adapters</code> 适配</li>
              <li>UI 组件小程序端用 Taro / uni-app 接入</li>
              <li>不依赖浏览器专有 API</li>
              <li>移动端优先设计</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>技术栈</h2>
            <div className={styles.techGrid}>
              <div className={styles.techItem}>
                <span className={styles.techName}>React 18</span>
                <span className={styles.techRole}>UI 框架</span>
              </div>
              <div className={styles.techItem}>
                <span className={styles.techName}>TypeScript</span>
                <span className={styles.techRole}>类型系统</span>
              </div>
              <div className={styles.techItem}>
                <span className={styles.techName}>Vite 5</span>
                <span className={styles.techRole}>构建工具</span>
              </div>
              <div className={styles.techItem}>
                <span className={styles.techName}>React Router</span>
                <span className={styles.techRole}>路由</span>
              </div>
              <div className={styles.techItem}>
                <span className={styles.techName}>CSS Modules</span>
                <span className={styles.techRole}>样式</span>
              </div>
              <div className={styles.techItem}>
                <span className={styles.techName}>Monorepo</span>
                <span className={styles.techRole}>项目结构</span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h2>开源协议</h2>
            <p>
              本项目基于 <strong>MIT License</strong> 开源。你可以自由使用、修改、分发本项目，包括商业用途，但需保留原作者署名和版权声明。
            </p>
          </section>

          <section className={styles.section}>
            <h2>当前阶段</h2>
            <div className={styles.phaseCard}>
              <div className={styles.phaseTag}>Phase 1</div>
              <h3>UI 原型 + 项目文档</h3>
              <p>仅静态页面，不调用真实 API。使用 Mock 数据展示 UI 效果。</p>
              <ul className={styles.phaseList}>
                <li>✅ 项目文档（README、PRODUCT、UI-SPEC、ARCHITECTURE、MINIPROGRAM-READY、SECURITY）</li>
                <li>✅ 静态 UI 原型（创作台、作品库、设置、文档页）</li>
                <li>✅ 响应式布局（移动端优先）</li>
                <li>✅ 中文界面</li>
                <li>⏳ 接入真实 MiniMax API（后续阶段）</li>
                <li>⏳ 微信小程序（后续阶段）</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}