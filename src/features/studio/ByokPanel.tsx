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
 * Phase BYOK-H2D (UX/copy polish only, no logic change):
 * - Dry-run 状态徽章: 提示用户当前为 dry-run，不会生成音乐
 * - API Key 隐私说明: fake key 示例 + 不写入本地存储 / 服务器持久化
 * - Turnstile 提示: 强调是「人机验证」不是「MiniMax 登录」
 * - byok_dry_run_only 结果解释: 安全链路已通过，但当前为 dry-run
 * - 所有文案为保守补充，不改变 API 行为，不改变 live/dry-run gate，
 *   不改变 Turnstile 验证逻辑，不记录 token / apiKey，不增加依赖。
 *
 * Deploy-CF-E: Turnstile widget runtime integration for BYOK；不代表 broad public launch。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ByokPanel.module.css';

const BYOK_ENDPOINT = '/api/generate/byok';
const DISABLED_MESSAGE = 'BYOK 暂未开放';
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

// Phase BYOK-H2D: 静态文案常量，集中管理以便 smoke test 断言。
// 这些是 user-facing copy，单独抽出便于阅读与未来微调。
const COPY = {
  headerSubtitle:
    'Phase BYOK-H3B-FRONTEND-MODE-FOLLOWUP: 当受控 live 窗口就绪时，前端会自动发送 ' +
    'mode=direct-live，让服务端路由到真实 MiniMax 提供商。' +
    '当 live 窗口未就绪时，前端发送 mode=fake，走 dry-run 安全链路。' +
    'Key 仅在本次请求中发送到本站服务端，不写入浏览器本地存储或服务器持久化。' +
    '正式 BYOK 启用后，费用由你自己的 MiniMax 账户承担。',
  dryRunBadge: 'dry-run 阶段 · 不会生成音乐 · 不会调用 MiniMax',
  apiKeyLabel: 'MiniMax API Key',
  apiKeyHint:
    'H2D 测试时可填 fake key（例如 sk-FAKE-...）。正式 BYOK 启用后填入你自己的真实 Key。' +
    'Key 只发往 /api/generate/byok 一次，不写入 localStorage / sessionStorage / IndexedDB / URL。',
  apiKeyNoSensitivePrompt: 'Prompt 内请勿填入敏感内容（Key、密码、身份证号等）。',
  turnstileLabel: 'Turnstile 验证',
  turnstileHumanOnly:
    'Turnstile 是 Cloudflare 的人机验证（不是 MiniMax 登录）。',
  turnstileRetryHint: '验证失败时，可点击右上角刷新图标重试，或刷新整个页面。',
  turnstileTokenPrivacy: 'Token 不显示、不保存、不复用；每次提交后会自动重置。',
  confirmLabel: '我确认使用自己的 MiniMax Key，并理解费用由自己的账户承担。',
  confirmLabelDryRun: '（当前为 dry-run，不会产生真实费用）',
  submitIdleDryRun: '使用我的 Key 试调一次（默认 fake / dry-run）',
  submitIdleLive: '使用我的 Key 进行受控 live 测试（仅本窗口一次）',
  resultDryRunExplain:
    '安全链路已通过（Turnstile + Key 形状校验）。当前为 dry-run，' +
    '所以没有调用 MiniMax，也没有生成音乐。',
  resultErrorPrefix: '请求未通过：',
  h2dFooterLine:
    'Phase BYOK-H2D · dry-run UX/copy polish · 未启用 BYOK live · 未发起 broad public launch',
  // Phase BYOK-H3B-FRONTEND-DIRECT-LIVE-CONFIRMATION-FIX: the live
  // confirmation phrase is operator-supplied. The frontend does NOT
  // embed the phrase, never persists it, never logs it, and never
  // auto-fills it. The field is rendered only when live mode is ready.
  directLiveConfirmationLabel: '受控 live 确认短语（仅受控窗口期）',
  directLiveConfirmationHint:
    '此字段仅在服务端 live 窗口就绪时显示；' +
    '确认短语由 operator 在受控窗口期内另行提供（例如通过 DevTools 注入），' +
    '前端不会内置、不会自动填入、不会写入 localStorage / sessionStorage。',
  directLiveConfirmationPlaceholder: '受控窗口期由 operator 提供',
} as const;

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
  // Phase BYOK-H3B-FRONTEND-MODE-FOLLOWUP: live gate health fields.
  // When all are true/positive, the frontend sends mode='direct-live'.
  byokLiveEnabled?: boolean;
  byokLiveConfirmationConfigured?: boolean;
  byokLiveAttemptsRemaining?: number;
  byokLiveAudioRemaining?: number;
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
  /**
   * Phase H1-Hotfix-D: Cloudflare `action` metadata.
   *
   * Client-set constant string. The server validates the same constant
   * via expectedAction='byok-generate'. Without this, Siteverify returns
   * action=null and the server rejects an otherwise-valid token as
   * turnstile_invalid.
   *
   * MUST be a string literal at the call site — never derived from user
   * input (props/state/form/URL). See deploy-cf-e smoke test #30.
   */
  action?: string;
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

  // Phase BYOK-H3B-FRONTEND-MODE-FOLLOWUP: live-ready check.
  // When all live gate health fields are true/positive, the frontend
  // sends mode='direct-live' so the server routes to the live provider.
  // Otherwise it sends mode='fake' (default safe path).
  const isByokLiveReady =
    props.publicByokEnabled === true &&
    props.byokLiveEnabled === true &&
    props.byokLiveConfirmationConfigured === true &&
    typeof props.byokLiveAttemptsRemaining === 'number' &&
    props.byokLiveAttemptsRemaining > 0 &&
    typeof props.byokLiveAudioRemaining === 'number' &&
    props.byokLiveAudioRemaining > 0;

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

  // Phase BYOK-H3B-FRONTEND-DIRECT-LIVE-CONFIRMATION-FIX: the direct
  // live confirmation phrase. Empty by default. Never persisted to
  // localStorage / sessionStorage / IndexedDB. Never logged to
  // console. Cleared after submit and when the panel is torn down.
  // The phrase itself is operator-supplied during a controlled live
  // window; this field only carries it from the operator's input to
  // the request body during that one window.
  const [directLiveConfirmation, setDirectLiveConfirmation] =
    useState<string>('');

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
          // Phase H1-Hotfix-D: Cloudflare requires `action` to be a client-set
          // constant string. The server validates the same constant via
          // expectedAction='byok-generate'. Without this, Siteverify returns
          // action=null and the server rejects an otherwise-valid token as
          // turnstile_invalid. MUST stay a string literal, not user input.
          action: 'byok-generate',
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
          // Phase BYOK-H3B-FRONTEND-MODE-FOLLOWUP: send explicit mode.
          // When live-ready, send 'direct-live' so the server routes to
          // the live provider. Otherwise send 'fake' (default safe path).
          mode: isByokLiveReady ? 'direct-live' : 'fake',
          // Phase BYOK-H3B-FRONTEND-DIRECT-LIVE-CONFIRMATION-FIX:
          // include the operator-supplied direct-live confirmation
          // phrase ONLY when (a) the request mode is 'direct-live' and
          // (b) the operator has actually typed something into the
          // field. Empty / non-direct-live → field is omitted from
          // the JSON body so the server sees an undefined confirmation
          // and rejects with the standard 403, NOT a partial-credential
          // leak in the body. The phrase itself is never logged and
          // never persisted.
          ...(isByokLiveReady &&
          directLiveConfirmation.length > 0
            ? { directLiveConfirmation }
            : {}),
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
      // Phase BYOK-H3B-FRONTEND-DIRECT-LIVE-CONFIRMATION-FIX: clear
      // the operator-supplied direct-live phrase after the request
      // returns so it doesn't sit in component state across
      // re-renders. The phrase was operator-supplied for this one
      // window; we do not preserve it for any subsequent submit.
      setDirectLiveConfirmation('');
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
        <p className={styles.subtitle}>{COPY.headerSubtitle}</p>
        {/* Phase BYOK-H3B-FRONTEND-MODE-FOLLOWUP: dynamic status badge.
            When live-ready, show live window badge.
            When not live-ready, show dry-run badge. */}
        <p
          className={isByokLiveReady ? styles.liveWindowBadge : styles.dryRunBadge}
          role="status"
          data-h2d={isByokLiveReady ? 'live-window-badge' : 'dry-run-badge'}
        >
          {isByokLiveReady
            ? '受控 live 窗口已就绪 · 仅一次提交 · 费用由你的 MiniMax 账户承担'
            : COPY.dryRunBadge}
        </p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit} autoComplete="off">
        <label className={styles.label} htmlFor="byok-api-key">
          {COPY.apiKeyLabel}
        </label>
        <input
          id="byok-api-key"
          className={styles.input}
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-FAKE-... 或 eyJhbGciOi..."
          autoComplete="off"
          spellCheck={false}
          minLength={20}
          maxLength={256}
          required
          disabled={!enabled || submitting}
        />
        {/* Phase BYOK-H2D: Key 隐私说明 + 敏感 prompt 提醒 */}
        <p className={styles.hint} data-h2d="api-key-hint">
          {COPY.apiKeyHint}
        </p>
        <p className={styles.hint} data-h2d="prompt-no-sensitive">
          {COPY.apiKeyNoSensitivePrompt}
        </p>

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

        {/* Phase BYOK-H3B-FRONTEND-DIRECT-LIVE-CONFIRMATION-FIX:
            Operator confirmation input. Rendered ONLY when the server
            reports live-ready health fields. The field is empty by
            default. The phrase is never auto-filled, never persisted,
            never logged, and is cleared after submit. The field
            itself does NOT include a defaultValue that matches any
            real phrase; placeholder text describes the operator
            contract, not the phrase value. */}
        {isByokLiveReady && (
          <>
            <label
              className={styles.label}
              htmlFor="byok-direct-live-confirmation"
            >
              {COPY.directLiveConfirmationLabel}
            </label>
            <input
              id="byok-direct-live-confirmation"
              className={styles.input}
              type="password"
              value={directLiveConfirmation}
              onChange={(e) => setDirectLiveConfirmation(e.target.value)}
              placeholder={COPY.directLiveConfirmationPlaceholder}
              autoComplete="off"
              spellCheck={false}
              maxLength={128}
              disabled={!enabled || submitting}
              data-h2d="byok-direct-live-confirmation"
            />
            <p
              className={styles.hint}
              data-h2d="byok-direct-live-confirmation-hint"
            >
              {COPY.directLiveConfirmationHint}
            </p>
          </>
        )}

        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={!enabled || submitting}
            required
          />
          <span>
            {COPY.confirmLabel}
            <span className={styles.confirmDryRunNote}>
              {COPY.confirmLabelDryRun}
            </span>
          </span>
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
                  {COPY.turnstileLabel}
                  {turnstileEnforced && (
                    <span className={styles.turnstileRequired}>（必填）</span>
                  )}
                </span>
                {/* Phase BYOK-H2D: 强调是「人机验证」非「MiniMax 登录」 */}
                <span className={styles.hint} data-h2d="turnstile-human-only">
                  {COPY.turnstileHumanOnly}
                </span>
                {/* Phase BYOK-H2D: 重试 / token 隐私提示 */}
                <span className={styles.hint} data-h2d="turnstile-retry-hint">
                  {COPY.turnstileRetryHint}
                </span>
                <span className={styles.hint} data-h2d="turnstile-token-privacy">
                  {COPY.turnstileTokenPrivacy}
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
            {submitting ? '提交中…' : (isByokLiveReady ? COPY.submitIdleLive : COPY.submitIdleDryRun)}
          </button>
        )}
      </form>

      {lastResult && (
        <div
          className={`${styles.result} ${
            lastResult.ok ? styles.resultOk : styles.resultErr
          }`}
          role="status"
          data-h2d="result-block"
          data-result-code={lastResult.code ?? ''}
        >
          {lastResult.ok ? (
            <>
              <strong>{statusMessage(lastResult.code)}</strong>
              <br />
              <code>{lastResult.code}</code>
              <br />
              <span className={styles.resultMsg}>{lastResult.message}</span>
              {/* Phase BYOK-H2D: dry-run 成功结果解释，明确「不是错误」「不会生成音乐」 */}
              {lastResult.code === 'byok_dry_run_only' && (
                <>
                  <br />
                  <small
                    className={styles.resultHint}
                    data-h2d="dry-run-explain"
                  >
                    {COPY.resultDryRunExplain}
                  </small>
                </>
              )}
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
        <br />
        {/* Phase BYOK-H2D: 显式声明当前为 UX/copy polish，未启用 BYOK live */}
        <small data-h2d="footer-line">{COPY.h2dFooterLine}</small>
      </footer>
    </section>
  );
}
