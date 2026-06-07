import { useState, useEffect } from 'react';
import { useSettings, maskKey } from '../../lib/settingsStore';
import { checkKey, getHealth, type HealthInfo } from '../../lib/serverApi';
import styles from './Settings.module.css';

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testMsg, setTestMsg] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  // Fetch server health on mount
  useEffect(() => {
    getHealth()
      .then((h) => setHealth(h))
      .catch(() => { /* server may be down, ignore */ })
      .finally(() => setHealthLoading(false));
  }, []);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestConnection = async () => {
    setTestLoading(true);
    setTestMsg('检查中…');
    try {
      const result = await checkKey({
        keyMode: settings.keyMode,
        region: settings.region,
        apiKey: settings.apiKey,
      });
      if (result.ok) {
        setTestMsg(result.available ? '本地检查通过，真实 Key 将在生成时验证。' : result.message || '当前不可用');
      } else {
        setTestMsg(result.message || '检查失败，请稍后重试');
      }
    } catch {
      setTestMsg('无法连接本地服务，请确认 API Server 已启动');
    } finally {
      setTestLoading(false);
      setTimeout(() => setTestMsg(''), 5000);
    }
  };

  const keyMode = settings.keyMode;
  const maskedKey = maskKey(settings.apiKey);

  // Backend helpers
  const backend = health?.backend ?? 'mock';
  const backendLabel = backend === 'mock' ? '本地模拟' : backend === 'api' ? 'MiniMax API（实验）' : 'MMX CLI（推荐）';
  // Safe Preview Mode: real generation disabled + mock backend + mock generation enabled
  const safePreviewMode =
    health?.realGenerationEnabled === false &&
    backend === 'mock' &&
    health?.mockGenerationEnabled === true;
  const cliAvailable = health?.cliAvailable ?? false;
  const cliAuth = health?.cliAuthenticated ?? null;
  const cliRegion = health?.cliRegion ?? null;

  // Determine hint message
  let hint: { type: 'safe' | 'warn' | 'info'; text: string } | null = null;
  if (safePreviewMode) {
    hint = { type: 'safe', text: '安全预览模式已开启：当前后端为本地模拟，不会调用 MiniMax，也不会消耗额度。' };
  } else if (backend === 'cli' && !cliAuth) {
    hint = { type: 'warn', text: '检测到 MMX CLI，但当前认证或配置异常。请在服务器终端修复 mmx auth 后再进行真实 CLI 生成。' };
  } else if (backend === 'cli' && !cliAvailable) {
    hint = { type: 'warn', text: '服务器未检测到 mmx CLI，请先安装或检查 PATH。' };
  } else if (backend === 'api') {
    hint = { type: 'info', text: 'MiniMax API Adapter 当前为实验路径，若直连 API 不稳定，建议使用 MMX CLI Adapter。' };
  } else if (backend === 'mock') {
    hint = { type: 'info', text: 'Mock 后端用于安全开发和演示，不调用真实 MiniMax。' };
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>设置</h1>
          <p className={styles.desc}>配置你的 MiniMax API Key 和生成参数</p>
        </div>

        {/* API Key section */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>API Key</h2>

          <div className={styles.field}>
            <label className={styles.label}>Key 保存方式</label>
            <div className={styles.radioGroup}>
              <label className={`${styles.radioCard} ${keyMode === 'session' ? styles.selected : ''}`}>
                <input
                  type="radio"
                  name="storage"
                  value="session"
                  checked={keyMode === 'session'}
                  onChange={() => updateSettings({ keyMode: 'session' })}
                  className={styles.visuallyHidden}
                />
                <div className={styles.radioTitle}>仅当前会话（推荐）</div>
                <div className={styles.radioDesc}>Key 只存在内存中，刷新或关闭页面后需重新输入</div>
              </label>
              <label className={`${styles.radioCard} ${keyMode === 'server' ? styles.selected : ''}`}>
                <input
                  type="radio"
                  name="storage"
                  value="server"
                  checked={keyMode === 'server'}
                  onChange={() => updateSettings({ keyMode: 'server' })}
                  className={styles.visuallyHidden}
                />
                <div className={styles.radioTitle}>服务器环境变量</div>
                <div className={styles.radioDesc}>使用服务器 .env 中的 MINIMAX_API_KEY（自托管推荐）</div>
              </label>
            </div>
          </div>

          {keyMode === 'session' && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="api-key">MiniMax Token Plan Key</label>
              <div className={styles.keyInput}>
                <input
                  id="api-key"
                  type={showKey ? 'text' : 'password'}
                  className={styles.input}
                  placeholder="sk-..."
                  value={settings.apiKey}
                  onChange={e => updateSettings({ apiKey: e.target.value })}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className={styles.toggleKey}
                  onClick={() => setShowKey(s => !s)}
                  aria-label={showKey ? '隐藏 Key' : '显示 Key'}
                >
                  {showKey ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  className={styles.testBtn}
                  onClick={handleTestConnection}
                  disabled={testLoading}
                >
                  {testLoading ? '检查中…' : '测试连接'}
                </button>
              </div>
              {testMsg && <p className={styles.testMsg}>{testMsg}</p>}
              <p className={styles.keyHint}>
                Key 仅保存在当前页面内存中，刷新后会清空
                {settings.apiKey && <span className={styles.maskedKey}>（{maskedKey}）</span>}
              </p>
            </div>
          )}

          {keyMode === 'server' && (
            <div className={styles.field}>
              <div className={styles.serverKeyNote}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                将使用服务器 .env 中的 MINIMAX_API_KEY
              </div>
              <button
                type="button"
                className={styles.testBtn}
                onClick={handleTestConnection}
                disabled={testLoading}
              >
                {testLoading ? '检查中…' : '测试连接'}
              </button>
              {testMsg && <p className={styles.testMsg}>{testMsg}</p>}
            </div>
          )}
        </div>

        {/* Region section */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>区域</h2>
          <div className={styles.radioGroup}>
            <label className={`${styles.radioCard} ${settings.region === 'cn' ? styles.selected : ''}`}>
              <input
                type="radio"
                name="region"
                value="cn"
                checked={settings.region === 'cn'}
                onChange={() => updateSettings({ region: 'cn' })}
                className={styles.visuallyHidden}
              />
              <div className={styles.radioTitle}>中国版（cn）</div>
              <div className={styles.radioDesc}>api.minimaxi.com</div>
            </label>
            <label className={`${styles.radioCard} ${settings.region === 'global' ? styles.selected : ''}`}>
              <input
                type="radio"
                name="region"
                value="global"
                checked={settings.region === 'global'}
                onChange={() => updateSettings({ region: 'global' })}
                className={styles.visuallyHidden}
              />
              <div className={styles.radioTitle}>全球版（global）</div>
              <div className={styles.radioDesc}>api.minimax.io</div>
            </label>
          </div>
        </div>

        {/* Backend status section */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>生成后端</h2>
          <p className={styles.backendDesc}>
            后端模式由服务器环境变量 MINIMAX_BACKEND 控制，前端只负责显示当前状态。
          </p>

          {healthLoading ? (
            <div className={styles.healthLoading}>正在连接服务器…</div>
          ) : (
            <>
              {/* Status cards */}
              <div className={styles.statusGrid}>
                <div className={styles.statusCard}>
                  <div className={styles.statusLabel}>当前后端</div>
                  <div className={styles.statusValue}>{backendLabel}</div>
                </div>
                <div className={styles.statusCard}>
                  <div className={styles.statusLabel}>安全预览模式</div>
                  <div className={`${styles.statusValue} ${safePreviewMode ? styles.statusOk : styles.statusWarn}`}>
                    {safePreviewMode ? '已开启' : '未开启'}
                  </div>
                </div>
                <div className={styles.statusCard}>
                  <div className={styles.statusLabel}>真实生成</div>
                  <div className={`${styles.statusValue} ${health?.realGenerationEnabled ? styles.statusWarn : styles.statusOk}`}>
                    {health?.realGenerationEnabled ? '开启' : '关闭'}
                  </div>
                </div>
                <div className={styles.statusCard}>
                  <div className={styles.statusLabel}>CLI 可用</div>
                  <div className={`${styles.statusValue} ${cliAvailable ? styles.statusOk : styles.statusSecondary}`}>
                    {cliAvailable ? '是' : '否'}
                  </div>
                </div>
                <div className={styles.statusCard}>
                  <div className={styles.statusLabel}>CLI 已登录</div>
                  <div className={`${styles.statusValue} ${cliAuth === true ? styles.statusOk : cliAuth === false ? styles.statusWarn : styles.statusSecondary}`}>
                    {cliAuth === true ? '是' : cliAuth === false ? '否' : '未知'}
                  </div>
                </div>
                <div className={styles.statusCard}>
                  <div className={styles.statusLabel}>CLI 区域</div>
                  <div className={styles.statusValue}>
                    {cliRegion || '未知'}
                  </div>
                </div>
              </div>

              {/* Hint message */}
              {hint && (
                <div className={`${styles.hint} ${hint.type === 'safe' ? styles.hintSafe : hint.type === 'warn' ? styles.hintWarn : styles.hintInfo}`}>
                  {hint.type === 'safe' && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  )}
                  {hint.type === 'warn' && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  )}
                  {hint.type === 'info' && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  )}
                  <span>{hint.text}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Security notice */}
        <div className={styles.notice}>
          <div className={styles.noticeIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div className={styles.noticeContent}>
            <h4>安全提示</h4>
            <ul>
              <li>我们不会保存你的 Key，任何形式的持久化存储都不会</li>
              <li>如果选择「仅当前会话」，Key 只存在于浏览器内存中</li>
              <li>请勿在公共网络或不可信的部署环境中输入真实 Key</li>
              <li>推荐使用服务端代理模式，由后端服务器持有 Key</li>
              <li>⚠️ 请勿在公开部署中输入真实 Key，除非你已配置登录鉴权和额度限制</li>
            </ul>
          </div>
        </div>

        {/* Save button */}
        <div className={styles.actions}>
          <button
            className={`${styles.saveBtn} ${saved ? styles.saved : ''}`}
            onClick={handleSave}
          >
            {saved ? '✓ 已保存' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
}