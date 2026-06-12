/**
 * ByokPanel — Phase BYOK-B: Controlled BYOK relay test modes.
 *
 * 安全约束 (DO NOT CHANGE without review):
 * - Password input is never persisted to localStorage / sessionStorage / IndexedDB
 * - Password input is never put in the URL query
 * - Password input is never copied to a clipboard helper
 * - Password input is sent only to /api/generate/byok in a one-shot request body
 * - When PUBLIC_BYOK_ENABLED is false (default), the panel renders in
 *   "BYOK 暂未开放" disabled state.
 * - The endpoint default response is `byok_dry_run_only` (no real generation).
 * - The UI never calls the existing /api/generate.
 * - The UI surfaces server-side status codes but never displays the apiKey
 *   or any Authorization / Bearer / X-Api-Key header.
 *
 * Phase BYOK-B added response codes:
 * - byok_dry_run_only        → "BYOK 安全链路已就绪，但当前仍为 dry-run"
 * - byok_fake_relay_ok       → "BYOK relay 测试通过（fake 模式）"
 * - byok_live_relay_ok       → "BYOK relay 测试通过（live 模式）"
 * - byok_live_not_enabled    → "真实 BYOK 生成尚未启用"
 * - byok_live_confirmation_required → "真实 BYOK 生成需要显式确认"
 * - byok_provider_error*     → "MiniMax 返回错误，已隐藏敏感信息"
 * - byok_generation_disabled → "BYOK 暂未开放"
 *
 * Phase BYOK-D added:
 * - byok_live_provider_path_disabled → "BYOK live 路径已禁用（CLI key fallback bug）"
 * - byok_direct_api_not_verified     → "BYOK direct API relay 尚未完成验证"
 *
 * Phase BYOK-F added:
 * - byok_direct_live_not_enabled        → "BYOK direct live 尚未启用"
 * - byok_direct_live_confirmation_required → "BYOK direct live 需要显式确认"
 * - byok_direct_provider_error          → "MiniMax direct API 返回错误，已隐藏敏感信息"
 * - byok_direct_live_ok                 → "BYOK direct API 测试通过"
 *
 * Phase Deploy-CF-D added:
 * - turnstile_required                  → "需要 Turnstile 验证"
 * - turnstile_invalid                   → "Turnstile 验证失败，请重试"
 * - turnstile_verification_error        → "Turnstile 验证服务异常"
 *
 * Phase Deploy-CF-E added:
 * - Frontend Turnstile widget runtime integration.
 * - Dynamic load of https://challenges.cloudflare.com/turnstile/v0/api.js
 * - window.turnstile.render(...) in a per-instance widget container
 * - Success / expired / error callbacks that drive turnstileToken state
 * - After-submit reset of widget + token to avoid single-use token reuse
 * - Guard: when turnstileSiteKey is set AND turnstileByokRequired=true, the
 *   submit button is blocked until a fresh token is present.
 * - Token is NEVER written to localStorage / sessionStorage / IndexedDB /
 *   URL query / console.log / UI text. Raw token is never displayed.
 *
 * Deploy-CF-E: Turnstile widget runtime integration for BYOK；不代表 broad public launch。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ByokPanel.module.css';

const BYOK_ENDPOINT = '/api/generate/byok';
const DISABLED_MESSAGE = 'BYOK 暂未开放';
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

// All server-side response codes the UI is allowed to surface.
// Keep this list in sync with server/index.ts handleByokGenerate.
type ByokResponseCode =
  | 'byok_generation_disabled'
  | 'byok_dry_run_only'
  | 'byok_fake_relay_ok'
  | 'byok_live_relay_ok'
  | 'byok_live_not_enabled'
  | 'byok_live_confirmation_required'
  | 'byok_provider_error'
  | 'byok_provider_auth_failed'
  | 'byok_provider_timeout'
  | 'byok_provider_not_found'
  | 'byok_provider_unsupported_mode'
  | 'byok_live_provider_path_disabled'
  | 'byok_direct_api_not_verified'
  | 'byok_direct_live_not_enabled'
  | 'byok_direct_live_confirmation_required'
  | 'byok_direct_provider_error'
  | 'byok_direct_live_ok'
  | 'byok_invalid_input'
  | 'turnstile_required'
  | 'turnstile_invalid'
  | 'turnstile_verification_error'
  | string;

const STATUS_MESSAGES: Record<string, string> = {
  byok_generation_disabled: 'BYOK 暂未开放',
  byok_dry_run_only: 'BYOK 安全链路已就绪，但当前仍为 dry-run',
  byok_fake_relay_ok: 'BYOK relay 测试通过（fake 模式）',
  byok_live_relay_ok: 'BYOK relay 测试通过（live 模式）',
  byok_live_not_enabled: '真实 BYOK 生成尚未启用',
  byok_live_confirmation_required: '真实 BYOK 生成需要显式确认',
  byok_live_provider_path_disabled: 'BYOK live 路径已禁用（CLI key fallback bug）',
  byok_direct_api_not_verified: 'BYOK direct API relay 尚未完成验证',
  byok_direct_live_not_enabled: 'BYOK direct live 尚未启用',
  byok_direct_live_confirmation_required: 'BYOK direct live 需要显式确认',
  byok_direct_provider_error: 'MiniMax direct API 返回错误，已隐藏敏感信息',
  byok_direct_live_ok: 'BYOK direct API 测试通过',
  byok_provider_error: 'MiniMax 返回错误，已隐藏敏感信息',
  byok_provider_auth_failed: 'MiniMax 拒绝了该 Key（认证失败）',
  byok_provider_timeout: 'MiniMax 响应超时',
  byok_provider_not_found: 'MiniMax CLI 不可用',
  byok_provider_unsupported_mode: 'MiniMax 不支持该模式',
  byok_invalid_input: '请求参数无效',
  turnstile_required: '需要 Turnstile 验证',
  turnstile_invalid: 'Turnstile 验证失败，请重试',
  turnstile_verification_error: 'Turnstile 验证服务异常',
};

interface ByokPanelProps {
  // Optional: parent can pass whether BYOK is currently allowed.
  // Default: treat as disabled (PUBLIC_BYOK_ENABLED=false) for safety.
  publicByokEnabled?: boolean;
  // Phase Deploy-CF-D / Deploy-CF-E: Turnstile site key (safe to expose to frontend).
  // If not provided, UI shows "Turnstile 尚未配置" placeholder.
  turnstileSiteKey?: string;
  // Phase Deploy-CF-E: when true AND a site key is configured, the submit
  // button is blocked until a fresh Turnstile token is present.
  turnstileByokRequired?: boolean;
  onStatusChange?: (
    status: 'idle' | 'submitting' | 'ok' | 'disabled' | 'error',
  ) => void;
}

interface ByokOkResponse {
  ok: true;
  code: ByokResponseCode;
  message: string;
  audioFileName?: string;
  sizeBytes?: number;
  generationSource?: 'byok-fake' | 'byok-live';
  requestId?: string;
}

interface ByokDryRunResponse extends ByokOkResponse {
  dryRun: true;
  receivedKeyLengthBucket: 'tiny' | 'short' | 'normal' | 'long' | 'absurd';
}

interface ByokErrorResponse {
  ok: false;
  code?: ByokResponseCode;
  message?: string;
  hint?: string;
  requestId?: string;
}

type ByokResponse = ByokDryRunResponse | ByokOkResponse | ByokErrorResponse;

function statusMessage(code: ByokResponseCode | undefined): string {
  if (!code) return '请求未通过';
  return STATUS_MESSAGES[code] ?? `请求未通过（${code}）`;
}

// ── Turnstile widget runtime ──────────────────────────────────────────────────
// Cloudflare Turnstile script loader: idempotent, only inserts the <script> tag
// once per page lifetime, and resolves a Promise once window.turnstile is ready.
// This avoids the <script>-already-loaded race and the duplicate-injection
// warning browser dev tools would otherwise show.

type TurnstileRenderOptions = {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'flexible' | 'compact';
};

type TurnstileWidget = {
  render: (el: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

type TurnstileGlobal = {
  render: TurnstileWidget['render'];
  reset?: TurnstileWidget['reset'];
  remove?: TurnstileWidget['remove'];
};

declare global {
  interface Window {
    turnstile?: TurnstileGlobal;
  }
}

let turnstileScriptLoadPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('window not available'));
  }
  if (window.turnstile) {
    return Promise.resolve();
  }
  if (turnstileScriptLoadPromise) {
    return turnstileScriptLoadPromise;
  }
  turnstileScriptLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      `script[src="${TURNSTILE_SCRIPT_SRC}"]`,
    );
    const onReady = () => resolve();
    const onError = () =>
      reject(new Error('failed to load Turnstile script'));
    if (existing) {
      // Script tag already inserted; wait for window.turnstile.
      if (window.turnstile) return resolve();
      const start = Date.now();
      const poll = window.setInterval(() => {
        if (window.turnstile) {
          window.clearInterval(poll);
          resolve();
        } else if (Date.now() - start > 15_000) {
          window.clearInterval(poll);
          reject(new Error('Turnstile script load timeout'));
        }
      }, 100);
      return;
    }
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = onReady;
    script.onerror = onError;
    document.head.appendChild(script);
  });
  return turnstileScriptLoadPromise;
}

// ── Component ────────────────────────────────────────────────────────────────

type TurnstileUiState =
  | 'not_configured'
  | 'loading'
  | 'ready'
  | 'verified'
  | 'expired'
  | 'error';

export default function ByokPanel(props: ByokPanelProps): JSX.Element {
  // Default to DISABLED. Only enabled if parent explicitly says so.
  // This matches server's PUBLIC_BYOK_ENABLED=false default.
  const enabled = props.publicByokEnabled === true;

  const [apiKey, setApiKey] = useState<string>('');
  const [model, setModel] = useState<'music-2.6-free' | 'music-2.6'>(
    'music-2.6-free',
  );
  const [musicMode, setMusicMode] = useState<'auto' | 'instrumental' | 'lyrics'>(
    'auto',
  );
  const [prompt, setPrompt] = useState<string>('');
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<ByokResponse | null>(null);

  // Phase Deploy-CF-E: Turnstile widget runtime state.
  // Token lives ONLY in React state and a ref — never persisted.
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [turnstileUiState, setTurnstileUiState] =
    useState<TurnstileUiState>('not_configured');
  const widgetContainerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  // Avoid double-initialisation under React 18 StrictMode dev double-render.
  const widgetInitInFlightRef = useRef<boolean>(false);

  // Phase H1-Hotfix-A: defensive normalization — accept any non-empty string,
  // including Cloudflare test keys (1x...), invisible keys (0x...), etc.
  const normalizedTurnstileSiteKey = props.turnstileSiteKey?.trim() ?? '';
  const turnstileConfigured = normalizedTurnstileSiteKey.length > 0;
  const turnstileEnforced =
    turnstileConfigured && props.turnstileByokRequired === true;

  // ── Mount / unmount: load Turnstile script + render widget ────────────────
  useEffect(() => {
    // If the BYOK panel is disabled OR no site key is configured, do not load
    // the Turnstile script at all. The UI shows a "not configured" placeholder.
    if (!enabled || !turnstileConfigured) {
      setTurnstileUiState('not_configured');
      return;
    }

    let cancelled = false;
    setTurnstileUiState('loading');

    loadTurnstileScript()
      .then(() => {
        if (cancelled) return;
        if (
          widgetInitInFlightRef.current ||
          !widgetContainerRef.current ||
          !window.turnstile
        ) {
          return;
        }
        widgetInitInFlightRef.current = true;
        const id = window.turnstile.render(widgetContainerRef.current, {
          // Phase H1-Hotfix-A: use the normalized (trimmed) key so the widget
          // receives a clean string even if the server response has stray
          // whitespace.
          sitekey: normalizedTurnstileSiteKey,
          callback: (token: string) => {
            setTurnstileToken(token);
            setTurnstileUiState('verified');
          },
          'expired-callback': () => {
            setTurnstileToken('');
            setTurnstileUiState('expired');
          },
          'error-callback': () => {
            setTurnstileToken('');
            setTurnstileUiState('error');
          },
          theme: 'auto',
          size: 'flexible',
        });
        widgetIdRef.current = id;
        setTurnstileUiState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setTurnstileUiState('error');
        setTurnstileToken('');
      });

    return () => {
      cancelled = true;
      // Best-effort cleanup of the widget instance.
      const id = widgetIdRef.current;
      if (id && window.turnstile?.remove) {
        try {
          window.turnstile.remove(id);
        } catch {
          /* noop */
        }
      }
      widgetIdRef.current = null;
      widgetInitInFlightRef.current = false;
      setTurnstileToken('');
    };
  }, [enabled, turnstileConfigured, normalizedTurnstileSiteKey]);

  // Clear token when the panel is disabled so stale tokens don't linger.
  useEffect(() => {
    if (!enabled) {
      setTurnstileToken('');
      const id = widgetIdRef.current;
      if (id && window.turnstile?.reset) {
        try {
          window.turnstile.reset(id);
        } catch {
          /* noop */
        }
      }
    }
  }, [enabled]);

  const canSubmit =
    enabled &&
    !submitting &&
    apiKey.length >= 20 &&
    prompt.length > 0 &&
    confirmed &&
    // If Turnstile is enforced, the user must have a fresh verified token.
    (!turnstileEnforced || (turnstileUiState === 'verified' && turnstileToken.length > 0));

  // Helper to reset the widget + clear the token. Used after every submit so
  // a single-use token is never reused (Cloudflare tokens are one-shot).
  const resetTurnstileWidget = useCallback(() => {
    setTurnstileToken('');
    const id = widgetIdRef.current;
    if (id && window.turnstile?.reset) {
      try {
        window.turnstile.reset(id);
      } catch {
        /* noop */
      }
    }
    setTurnstileUiState('ready');
  }, []);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setLastResult(null);
    props.onStatusChange?.('submitting');
    try {
      const r = await fetch(BYOK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          apiKey,
          // Phase BYOK-B: include prompt + musicMode so the fake / live
          // adapter can produce a deterministic / real response.
          input: {
            prompt,
            model,
            mode: musicMode,
          },
          // Phase Deploy-CF-E: include Turnstile token when configured.
          // The token is single-use; after the request we reset the widget.
          turnstileToken:
            turnstileConfigured && turnstileToken
              ? turnstileToken
              : undefined,
          // The body never carries the explicit 'mode' — the route always
          // defaults to 'fake' for safety. A real 'live' request requires
          // a separate operator-only channel that this UI does not expose.
        }),
      });
      const data = (await r.json()) as ByokResponse;
      setLastResult(data);
      if (!r.ok || data.ok === false) {
        props.onStatusChange?.(r.status === 403 ? 'disabled' : 'error');
      } else {
        props.onStatusChange?.('ok');
      }
    } catch (err) {
      setLastResult({
        ok: false,
        code: 'network_error',
        message: (err as Error)?.message || 'network error',
      });
      props.onStatusChange?.('error');
    } finally {
      setSubmitting(false);
      // SECURITY: clear local key reference immediately after submit so
      // it doesn't linger in component state if the parent re-renders.
      setApiKey('');
      // SECURITY: reset the Turnstile widget + clear the token so a single-use
      // token cannot be replayed. The user must re-verify before next submit.
      if (turnstileConfigured) {
        resetTurnstileWidget();
      }
    }
  }

  return (
    <section className={styles.byokPanel} aria-label="BYOK 自带 Key 模式">
      <header className={styles.header}>
        <h2 className={styles.title}>使用自己的 MiniMax Key</h2>
        <p className={styles.subtitle}>
          Key 只会发送到本站服务端用于本次请求，不会保存在浏览器或服务器。费用与额度由你的 MiniMax 账户承担。
        </p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit} autoComplete="off">
        <label className={styles.label} htmlFor="byok-api-key">
          MiniMax API Key
        </label>
        <input
          id="byok-api-key"
          className={styles.input}
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="eyJhbGciOi..."
          autoComplete="off"
          spellCheck={false}
          minLength={20}
          maxLength={256}
          required
          disabled={!enabled || submitting}
        />

        <label className={styles.label} htmlFor="byok-model">
          模型
        </label>
        <select
          id="byok-model"
          className={styles.select}
          value={model}
          onChange={(e) =>
            setModel(e.target.value as 'music-2.6-free' | 'music-2.6')
          }
          disabled={!enabled || submitting}
        >
          <option value="music-2.6-free">music-2.6-free</option>
          <option value="music-2.6">music-2.6</option>
        </select>

        <label className={styles.label} htmlFor="byok-music-mode">
          模式
        </label>
        <select
          id="byok-music-mode"
          className={styles.select}
          value={musicMode}
          onChange={(e) =>
            setMusicMode(e.target.value as 'auto' | 'instrumental' | 'lyrics')
          }
          disabled={!enabled || submitting}
        >
          <option value="auto">auto（自动选择）</option>
          <option value="instrumental">instrumental（纯音乐）</option>
          <option value="lyrics">lyrics（带歌词）</option>
        </select>

        <label className={styles.label} htmlFor="byok-prompt">
          Prompt
        </label>
        <textarea
          id="byok-prompt"
          className={styles.textarea}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="例如：深夜编程，lo-fi 钢琴，节奏缓慢"
          rows={2}
          maxLength={500}
          required
          disabled={!enabled || submitting}
        />

        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={!enabled || submitting}
            required
          />
          <span>我确认使用自己的 MiniMax Key，并理解费用由自己的账户承担。</span>
        </label>

        {/* Phase Deploy-CF-E: Real Turnstile widget runtime integration.
            - When site key is configured: load the CF script once, render the
              widget into widgetContainerRef, wire success/expired/error
              callbacks to update turnstileToken + turnstileUiState.
            - When site key is NOT configured: show a "not configured" hint.
            - Raw token is NEVER displayed. Token never persisted. */}
        {enabled && (
          <div className={styles.turnstileBlock} role="status">
            {turnstileConfigured ? (
              <>
                <span className={styles.turnstileLabel}>
                  Turnstile 验证
                  {turnstileEnforced && (
                    <span className={styles.turnstileRequired}>（必填）</span>
                  )}
                </span>
                <div
                  ref={widgetContainerRef}
                  className={`${styles.turnstileWidget} ${
                    turnstileUiState === 'verified'
                      ? styles.turnstileWidgetVerified
                      : turnstileUiState === 'expired'
                      ? styles.turnstileWidgetExpired
                      : turnstileUiState === 'error'
                      ? styles.turnstileWidgetError
                      : ''
                  }`}
                  data-turnstile-state={turnstileUiState}
                />
                {turnstileUiState === 'loading' && (
                  <span className={styles.turnstileHint}>
                    正在加载 Turnstile…
                  </span>
                )}
                {turnstileUiState === 'ready' && (
                  <span className={styles.turnstileHint}>
                    请完成下方人机验证。
                  </span>
                )}
                {turnstileUiState === 'verified' && (
                  <span className={styles.turnstileHintOk}>
                    ✓ Turnstile 已验证
                  </span>
                )}
                {turnstileUiState === 'expired' && (
                  <span className={styles.turnstileHintWarn}>
                    ⚠ 验证已过期，请重新验证
                  </span>
                )}
                {turnstileUiState === 'error' && (
                  <span className={styles.turnstileHintErr}>
                    ✗ 验证加载失败，请刷新页面重试
                  </span>
                )}
              </>
            ) : (
              <span className={styles.turnstileNotConfigured}>
                Turnstile 尚未配置 — 当前为非阻断模式
              </span>
            )}
          </div>
        )}

        {!enabled ? (
          <div className={styles.disabledBanner} role="status">
            {DISABLED_MESSAGE}
          </div>
        ) : (
          <button
            type="submit"
            className={styles.submit}
            disabled={!canSubmit}
          >
            {submitting ? '提交中…' : '使用我的 Key 试调一次（默认 fake）'}
          </button>
        )}
      </form>

      {lastResult && (
        <div
          className={`${styles.result} ${
            lastResult.ok ? styles.resultOk : styles.resultErr
          }`}
          role="status"
        >
          {lastResult.ok ? (
            <>
              <strong>{statusMessage(lastResult.code)}</strong>
              <br />
              <code>{lastResult.code}</code>
              <br />
              <span className={styles.resultMsg}>{lastResult.message}</span>
              {lastResult.audioFileName && (
                <>
                  <br />
                  <small>
                    audioFileName: <code>{lastResult.audioFileName}</code>
                    {typeof lastResult.sizeBytes === 'number' && (
                      <> · sizeBytes: <code>{lastResult.sizeBytes}</code></>
                    )}
                    {lastResult.generationSource && (
                      <> · source: <code>{lastResult.generationSource}</code></>
                    )}
                  </small>
                </>
              )}
              {lastResult.requestId && (
                <>
                  <br />
                  <small>
                    requestId: <code>{lastResult.requestId}</code>
                  </small>
                </>
              )}
            </>
          ) : (
            <>
              <strong>{statusMessage(lastResult.code)}</strong>
              {lastResult.code && (
                <>
                  <br />
                  <code>{lastResult.code}</code>
                </>
              )}
              {lastResult.message && (
                <>
                  <br />
                  <span className={styles.resultMsg}>{lastResult.message}</span>
                </>
              )}
              {lastResult.hint && (
                <>
                  <br />
                  <small className={styles.resultHint}>{lastResult.hint}</small>
                </>
              )}
            </>
          )}
        </div>
      )}

      <footer className={styles.footer}>
        <small>
          Phase Deploy-CF-E · Turnstile widget runtime 已就位 · 服务端 Siteverify 仍为最终判断 · Token 不写入 localStorage / sessionStorage / IndexedDB / URL query · 不代表 broad public BYOK launch
        </small>
      </footer>
    </section>
  );
}
