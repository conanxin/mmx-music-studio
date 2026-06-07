import { useState, useEffect } from 'react';
import { useSettings, maskKey } from '../../lib/settingsStore';
import { checkKey, getHealth, getGenAccessStatus, unlockGenAccess, logoutGenAccess, type HealthInfo } from '../../lib/serverApi';
import styles from './Settings.module.css';

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testMsg, setTestMsg] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  // Phase 4C: Generation Access state
  const [genAccessEnabled, setGenAccessEnabled] = useState(false);
  const [genAccessUnlocked, setGenAccessUnlocked] = useState(false);
  const [genPin, setGenPin] = useState('');
  const [genPinMsg, setGenPinMsg] = useState('');

  // Fetch server health and generation access status on mount
  useEffect(() => {
    Promise.all([
      getHealth().catch(() => null),
      getGenAccessStatus().catch(() => null),
    ]).then(([h, ga]) => {
      if (h) setHealth(h);
      if (ga) {
        setGenAccessEnabled(ga.enabled);
        setGenAccessUnlocked(ga.unlocked);
      }
    }).finally(() => {
      setHealthLoading(false);
    });
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

  // Phase 4C: Generation Access unlock
  const handleGenAccessUnlock = async () => {
    if (!genPin.trim()) {
      setGenPinMsg('请输入生成访问码');
      return;
    }
    setGenPinMsg('解锁中…');
    const result = await unlockGenAccess(genPin);
    if (result.ok) {
      setGenAccessUnlocked(true);
      setGenPin('');
      setGenPinMsg('已解锁生成权限');
    } else {
      setGenPinMsg(result.message || '访问码不正确');
    }
  };

  // Phase 4C: Generation Access logout
  const handleGenAccessLogout = async () => {
    await logoutGenAccess();
    setGenAccessUnlocked(false);
    setGenPinMsg('');
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

  // Runtime mode derivation
  const runtimeMode = ((): string => {
    if (health === null) return '连接中…';
    if (health.previewAccessEnabled) return '访问保护';
    if (health.realGenerationEnabled && backend === 'cli') return '真实生成';
    if (health.realGenerationEnabled && backend === 'api') return 'API 实验';
    if (!health.realGenerationEnabled && backend === 'mock' && health.mockGenerationEnabled) return '安全预览';
    return '自定义';
  })();

  const runtimeModeDesc = ((): string => {
    if (health === null) return '正在连接服务器…';
    if (health.previewAccessEnabled) return '已启用 PIN 访问保护，真实生成暂时关闭';
    if (health.realGenerationEnabled && backend === 'cli') return '真实调用 MiniMax mmx CLI，会消耗 Token Plan 额度';
    if (health.realGenerationEnabled && backend === 'api') return '直接调用 MiniMax API，实验性，可能不稳定';
    if (!health.realGenerationEnabled && backend === 'mock' && health.mockGenerationEnabled) return '本地模拟，不调用 MiniMax，不消耗额度';
    return '当前配置不属于标准运行模式';
  })();

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
          <h2 className={styles.sectionTitle}>运行模式</h2>

          <div className={styles.statusGrid}>
            <div className={styles.statusCard}>
              <div className={styles.statusLabel}>当前模式</div>
              <div className={`${styles.statusValue} ${runtimeMode === '安全预览' ? styles.statusOk : runtimeMode === '真实生成' ? styles.statusWarn : ''}`}>
                {runtimeMode}
              </div>
            </div>
            <div className={styles.statusCard}>
              <div className={styles.statusLabel}>当前后端</div>
              <div className={styles.statusValue}>{backendLabel}</div>
            </div>
            <div className={styles.statusCard}>
              <div className={styles.statusLabel}>真实生成</div>
              <div className={`${styles.statusValue} ${health?.realGenerationEnabled ? styles.statusWarn : styles.statusOk}`}>
                {health?.realGenerationEnabled ? '开启' : '关闭'}
              </div>
            </div>
            <div className={styles.statusCard}>
              <div className={styles.statusLabel}>访问保护</div>
              <div className={`${styles.statusValue} ${health?.previewAccessEnabled ? styles.statusOk : styles.statusSecondary}`}>
                {health?.previewAccessEnabled ? '已开启' : '未开启'}
              </div>
            </div>
          </div>

          {runtimeModeDesc && runtimeMode !== '连接中…' && (
            <div className={styles.hint}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{runtimeModeDesc}</span>
            </div>
          )}

          <div className={styles.modeDocLink}>
            <a href="#/docs/runtime-modes" onClick={e => { e.preventDefault(); window.open('/docs/RUNTIME_MODES.md', '_blank'); }}>
              📖 查看三种运行模式说明
            </a>
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

        {/* Job queue section */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>生成队列</h2>
          <p className={styles.backendDesc}>
            音乐生成任务通过异步队列处理，支持轮询状态和取消任务。
          </p>
          <div className={styles.statusGrid}>
            <div className={styles.statusCard}>
              <div className={styles.statusLabel}>队列状态</div>
              <div className={`${styles.statusValue} ${health?.jobQueueEnabled ? styles.statusOk : styles.statusSecondary}`}>
                {health?.jobQueueEnabled ? '已启用' : '未启用'}
              </div>
            </div>
            <div className={styles.statusCard}>
              <div className={styles.statusLabel}>队列中的任务</div>
              <div className={styles.statusValue}>
                {health?.queuedJobs ?? '—'}
              </div>
            </div>
            <div className={styles.statusCard}>
              <div className={styles.statusLabel}>Worker 状态</div>
              <div className={`${styles.statusValue} ${health?.workerBusy ? styles.statusWarn : styles.statusOk}`}>
                {health?.workerBusy ? '忙碌中' : '空闲'}
              </div>
            </div>
            <div className={styles.statusCard}>
              <div className={styles.statusLabel}>最大并发</div>
              <div className={styles.statusValue}>1</div>
            </div>
          </div>
        </div>

        {/* Phase 4C: Generation Protection section */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>生成保护</h2>
          <p className={styles.backendDesc}>
            防止公网误触真实生成，保护你的 MiniMax 额度。
          </p>
          <div className={styles.statusGrid}>
            <div className={styles.statusCard}>
              <div className={styles.statusLabel}>生成访问保护</div>
              <div className={`${styles.statusValue} ${health?.generationAccessEnabled ? styles.statusOk : styles.statusSecondary}`}>
                {health?.generationAccessEnabled ? '开启' : '关闭'}
              </div>
            </div>
            <div className={styles.statusCard}>
              <div className={styles.statusLabel}>速率限制</div>
              <div className={`${styles.statusValue} ${health?.rateLimitEnabled ? styles.statusOk : styles.statusSecondary}`}>
                {health?.rateLimitEnabled ? '开启' : '关闭'}
              </div>
            </div>
            <div className={styles.statusCard}>
              <div className={styles.statusLabel}>时间窗口</div>
              <div className={styles.statusValue}>
                {health?.rateLimitEnabled ? `${Math.round((health?.rateLimitWindowMs ?? 60000) / 1000)} 秒` : '—'}
              </div>
            </div>
            <div className={styles.statusCard}>
              <div className={styles.statusLabel}>窗口内最大请求</div>
              <div className={styles.statusValue}>
                {health?.rateLimitEnabled ? health?.rateLimitMaxRequests ?? '—' : '—'}
              </div>
            </div>
            <div className={styles.statusCard}>
              <div className={styles.statusLabel}>每日额度</div>
              <div className={`${styles.statusValue} ${health?.dailyQuotaEnabled ? styles.statusOk : styles.statusSecondary}`}>
                {health?.dailyQuotaEnabled ? '开启' : '关闭'}
              </div>
            </div>
            <div className={styles.statusCard}>
              <div className={styles.statusLabel}>今日已用 / 限制</div>
              <div className={styles.statusValue}>
                {health?.dailyQuotaEnabled
                  ? `${health?.dailyGenerationUsed ?? 0} / ${health?.dailyGenerationLimit ?? 10}`
                  : '— / —'}
              </div>
            </div>
            <div className={styles.statusCard}>
              <div className={styles.statusLabel}>剩余额度</div>
              <div className={`${styles.statusValue} ${(health?.remainingDailyGenerations ?? 0) === 0 && health?.dailyQuotaEnabled ? styles.statusWarn : styles.statusOk}`}>
                {health?.dailyQuotaEnabled ? `${health?.remainingDailyGenerations ?? 0} 首` : '—'}
              </div>
            </div>
          </div>

          {/* Generation Access PIN unlock (only show if enabled) */}
          {genAccessEnabled && (
            <div className={styles.genAccessSection}>
              {genAccessUnlocked ? (
                <div className={styles.genAccessUnlocked}>
                  <div className={styles.genAccessStatus}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>已解锁生成权限</span>
                  </div>
                  <button
                    type="button"
                    className={styles.genAccessLogoutBtn}
                    onClick={handleGenAccessLogout}
                  >
                    退出解锁
                  </button>
                </div>
              ) : (
                <div className={styles.genAccessForm}>
                  <div className={styles.genAccessLabel}>生成访问码</div>
                  <div className={styles.genAccessInputRow}>
                    <input
                      type="password"
                      className={styles.input}
                      placeholder="输入访问码"
                      value={genPin}
                      onChange={e => setGenPin(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleGenAccessUnlock(); }}
                    />
                    <button
                      type="button"
                      className={styles.genAccessUnlockBtn}
                      onClick={handleGenAccessUnlock}
                    >
                      解锁真实生成
                    </button>
                  </div>
                  {genPinMsg && <p className={`${styles.genPinMsg} ${genPinMsg.startsWith('✅') ? styles.genPinMsgSuccess : styles.genPinMsgError}`}>{genPinMsg}</p>}
                  <p className={styles.keyHint}>
                    生成访问码由服务器管理员设置，与预览访问码相同
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Warning if real generation is on but gen access is off */}
          {health?.realGenerationEnabled && !health?.generationAccessEnabled && (
            <div className={`${styles.hint} ${styles.hintWarn}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span>真实生成已开启，但生成访问保护未开启。公网部署可能消耗额度。</span>
            </div>
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