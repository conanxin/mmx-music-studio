/**
 * ByokPanel — Phase BYOK-B: Controlled BYOK relay test modes.
 *
 * 安全约束 (DO NOT CHANGE without review):
 * - Password input is never persisted to localStorage / sessionStorage / IndexedDB
 * - Password input is never put in the URL query
 * - Password input is never copied to a clipboard helper
 * - Password input is sent only to /api/generate/byok in a request body.
 *   The queued path may hold it temporarily in server memory for the job.
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
 * - API Key 隐私说明: fake key 示例 + 仅排队期间服务器内存临时保存
 * - Turnstile 提示: 强调是「人机验证」不是「MiniMax 登录」
 * - byok_dry_run_only 结果解释: 安全链路已通过，但当前为 dry-run
 * - 所有文案为保守补充，不改变 API 行为，不改变 live/dry-run gate，
 *   不改变 Turnstile 验证逻辑，不记录 token / apiKey，不增加依赖。
 *
 * Deploy-CF-E: Turnstile widget runtime integration for BYOK；不代表 broad public launch。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ByokPanel.module.css';
import {
  getJob,
  getPublicCapacity,
  getTrackAudioUrl,
  getTrackDownloadUrl,
  saveByokDirectLiveToLibrary,
  type GenerateJob,
  type PublicCapacityInfo,
  type SaveByokDirectLiveToLibraryResult,
} from '../../lib/serverApi';

const BYOK_ENDPOINT = '/api/generate/byok';
const DISABLED_MESSAGE = 'BYOK 暂未开放';
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

// Phase BYOK-H2D: 静态文案常量，集中管理以便 smoke test 断言。
// 这些是 user-facing copy，单独抽出便于阅读与未来微调。
const COPY = {
  headerSubtitle:
    '输入一句音乐描述，使用自己的 MiniMax API Key 生成一首可播放、可下载的音乐。',
  dryRunBadge: '本站不保存 API Key 到磁盘 · 生成任务会排队执行 · 最多 5 个活跃用户',
  apiKeyLabel: 'MiniMax API Key',
  apiKeyHint:
    '需要先填写 MiniMax API Key 才能生成。Key 仅临时用于本次排队任务；不写入磁盘、浏览器存储、作品库、manifest、日志或 Git，任务结束或过期后删除。',
  apiKeyNoSensitivePrompt: 'Prompt 内请勿填入敏感内容（Key、密码、身份证号等）。',
  turnstileLabel: 'Turnstile 验证',
  turnstileHumanOnly:
    'Turnstile 是 Cloudflare 的人机验证（不是 MiniMax 登录）。',
  turnstileRetryHint: '验证失败时，可点击右上角刷新图标重试，或刷新整个页面。',
  turnstileTokenPrivacy: 'Token 不显示、不保存、不复用；每次提交后会自动重置。',
  confirmLabel: '我确认使用自己的 MiniMax Key，并理解费用由自己的账户承担。',
  confirmLabelDryRun: '（Key 仅在排队任务期间临时保存在服务器内存中）',
  submitIdleDryRun: '生成音乐',
  submitIdleLive: '生成音乐',
  resultDryRunExplain:
    '安全链路已通过（Turnstile + Key 形状校验）。当前为 dry-run，' +
    '所以没有调用 MiniMax，也没有生成音乐。',
  resultErrorPrefix: '请求未通过：',
  h2dFooterLine:
    '当前仍是 alpha 版本；生成任务单并发排队执行，Key 不写入磁盘或浏览器存储，任务结束或过期后删除。',
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

type CreationMode = 'instrumental' | 'auto_song' | 'lyrics' | 'reference';

const CREATION_MODES: Array<{
  value: CreationMode;
  label: string;
  hint: string;
}> = [
  { value: 'instrumental', label: '纯音乐', hint: '适合氛围、BGM、配乐' },
  { value: 'auto_song', label: '自动成歌', hint: '用描述生成完整歌曲方向' },
  { value: 'lyrics', label: '歌词成歌', hint: '填写歌词并生成歌曲' },
  { value: 'reference', label: '参考改编', hint: '描述想参考的风格或歌曲质感' },
];

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
  | 'byok_direct_lyrics_required'
  | 'byok_lyrics_required'
  | 'byok_non_json_response'
  | 'byok_direct_live_ok'
  | 'byok_job_queued'
  | 'byok_queue_not_enabled'
  | 'byok_queue_generation_not_ready'
  | 'byok_invalid_input'
  | 'turnstile_required'
  | 'turnstile_invalid'
  | 'turnstile_verification_error'
  | 'public_capacity_full'
  | string;

const STATUS_MESSAGES: Record<string, string> = {
  public_capacity_full: '当前使用人数已满，请稍后再试',
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
  byok_direct_auth_failed: 'MiniMax direct API 认证失败，已隐藏敏感信息',
  byok_direct_rate_limited: 'MiniMax direct API 返回限流',
  byok_direct_timeout: 'MiniMax direct API 响应超时',
  byok_direct_network_error: 'MiniMax direct API 网络错误',
  byok_direct_unexpected: 'MiniMax direct API 返回异常响应',
  byok_direct_lyrics_required: 'Lyrics are required unless instrumental mode is selected',
  byok_lyrics_required: 'Lyrics are required for with_lyrics mode',
  byok_non_json_response: '服务端返回非 JSON 错误',
  byok_direct_live_ok: 'BYOK direct API 测试通过',
  byok_job_queued: '任务已排队',
  byok_queue_not_enabled: 'BYOK 排队生成尚未启用',
  byok_queue_generation_not_ready: 'BYOK 排队生成配置尚未就绪',
  byok_provider_error: 'MiniMax 返回错误，已隐藏敏感信息',
  byok_provider_auth_failed: 'MiniMax 拒绝了该 Key（认证失败）',
  byok_provider_timeout: 'MiniMax 响应超时',
  byok_provider_not_found: 'MiniMax CLI 不可用',
  byok_provider_unsupported_mode: 'MiniMax 不支持该模式',
  byok_invalid_input: '请求参数无效',
  turnstile_required: '需要 Turnstile 验证',
  turnstile_invalid: 'Turnstile 验证失败，请重试',
  turnstile_verification_error: 'Turnstile 验证服务异常',
  network_error: '网络请求失败',
};

interface ByokPanelProps {
  // Optional: parent can pass whether BYOK is currently allowed.
  // Default: treat as disabled (PUBLIC_BYOK_ENABLED=false) for safety.
  publicByokEnabled?: boolean;
  // Public-lite queued BYOK mode. The UI only offers real queued generation
  // when this server-side boolean is true.
  publicByokQueueEnabled?: boolean;
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
  // Phase Public-Lite-P3F status sharing: parent Studio can provide the
  // read-only capacity snapshot so this panel does not create an extra
  // anonymous capacity session on mount.
  publicCapacity?: PublicCapacityInfo | null;
  refreshPublicCapacity?: () => Promise<PublicCapacityInfo>;
  onStatusChange?: (
    status: 'idle' | 'submitting' | 'ok' | 'disabled' | 'error',
  ) => void;
}

interface ByokOkResponse {
  ok: true;
  code: ByokResponseCode;
  message: string;
  stage?: string;
  audioFileName?: string;
  audioUrl?: string;
  downloadUrl?: string;
  sizeBytes?: number;
  generationSource?: 'byok-fake' | 'byok-live';
  taskId?: string;
  model?: string;
  generationIntent?: ByokGenerationIntent | string;
  provider?: string;
  audioResult?: {
    available?: boolean;
    audioUrl?: string;
    downloadUrl?: string;
    source?: string;
    persistence?: string;
    note?: string;
  };
  library?: {
    saved?: boolean;
    status?: string;
    reason?: string;
  };
  job?: GenerateJob;
  queue?: {
    queuedJobs?: number;
    workerBusy?: boolean;
    concurrency?: number;
  };
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
  stage?: string;
  httpStatus?: number;
  responseContentType?: string;
}

type ByokResponse = ByokDryRunResponse | ByokOkResponse | ByokErrorResponse;

function statusMessage(code: ByokResponseCode | undefined): string {
  if (!code) return '生成未开始';
  return STATUS_MESSAGES[code] ?? '生成未开始，请检查输入后重试';
}

function byokLibrarySaveMessage(code?: string, fallback?: string): string {
  if (code === 'public_capacity_full') {
    return '当前使用人数已满，请稍后再试。网站处于 5 人内轻量公开模式。';
  }
  if (code === 'byok_library_persist_disabled') {
    return 'Safe preview mode: Library persistence is disabled until the controlled live window is opened.';
  }
  if (code === 'byok_library_persist_confirmation_required') {
    return 'Save failed: controlled live confirmation is required.';
  }
  if (code === 'byok_library_persist_confirmation_mismatch') {
    return 'Save failed: controlled live confirmation did not match.';
  }
  if (code === 'byok_library_persist_invalid_url') {
    return 'Save failed: the provider audio link is invalid.';
  }
  if (code === 'byok_library_persist_blocked_url') {
    return 'Save failed: the provider audio link was blocked by the server safety checks.';
  }
  if (code === 'byok_library_persist_download_failed') {
    return 'Save failed: the server could not download the audio for Library storage.';
  }
  if (code === 'byok_library_persist_invalid_audio') {
    return 'Save failed: the downloaded file was not accepted as audio.';
  }
  if (code === 'byok_library_persist_too_large') {
    return 'Save failed: the audio file is larger than the server limit.';
  }
  if (code === 'byok_library_persist_manifest_failed') {
    return 'Save failed: the server could not write the Library manifest.';
  }
  return fallback || 'Save failed: the server did not persist this result.';
}

async function readByokResponse(response: Response): Promise<ByokResponse> {
  const contentType = response.headers.get('content-type') ?? '';
  const raw = await response.text();
  const isJson = contentType.toLowerCase().includes('application/json');
  if (!isJson) {
    return {
      ok: false,
      code: 'byok_non_json_response',
      message: `服务端返回非 JSON 错误（HTTP ${response.status}）`,
      hint: '请记录 HTTP status / requestId 后重试；不要重复提交 live 请求。',
      httpStatus: response.status,
      responseContentType: contentType || 'missing',
    };
  }
  try {
    return JSON.parse(raw) as ByokResponse;
  } catch {
    return {
      ok: false,
      code: 'byok_non_json_response',
      message: `服务端 JSON 响应解析失败（HTTP ${response.status}）`,
      hint: '请记录 HTTP status / requestId 后重试；不要重复提交 live 请求。',
      httpStatus: response.status,
      responseContentType: contentType || 'missing',
    };
  }
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

type ByokGenerationIntent = 'instrumental' | 'with_lyrics';
type ByokLibrarySaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function ByokPanel(props: ByokPanelProps): JSX.Element {
  // Default to DISABLED. Only enabled if parent explicitly says so.
  // This matches server's PUBLIC_BYOK_ENABLED=false and
  // PUBLIC_BYOK_QUEUE_ENABLED=false defaults.
  const enabled =
    props.publicByokEnabled === true &&
    props.publicByokQueueEnabled === true;

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
  const [creationMode, setCreationMode] =
    useState<CreationMode>('instrumental');
  const [musicMode, setMusicMode] =
    useState<ByokGenerationIntent>('instrumental');
  const [prompt, setPrompt] = useState<string>('');
  const [lyrics, setLyrics] = useState<string>('');
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<ByokResponse | null>(null);
  const [queuedJob, setQueuedJob] = useState<GenerateJob | null>(null);
  const [librarySaveState, setLibrarySaveState] =
    useState<ByokLibrarySaveState>('idle');
  const [librarySaveResult, setLibrarySaveResult] =
    useState<SaveByokDirectLiveToLibraryResult | null>(null);
  const [librarySaveError, setLibrarySaveError] = useState<string>('');
  const [localPublicCapacity, setLocalPublicCapacity] =
    useState<PublicCapacityInfo | null>(null);
  const publicCapacity = props.publicCapacity ?? localPublicCapacity;

  // Phase BYOK-H3B-FRONTEND-DIRECT-LIVE-CONFIRMATION-FIX: the direct
  // live confirmation phrase. Empty by default. Never persisted to
  // localStorage / sessionStorage / IndexedDB. Never logged to
  // console. Cleared after submit and when the panel is torn down.
  // The phrase itself is operator-supplied during a controlled live
  // window; this field only carries it from the operator's input to
  // the request body during that one window.
  const [directLiveConfirmation, setDirectLiveConfirmation] =
    useState<string>('');
  const queuedJobPollRef = useRef<number | null>(null);

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

  const refreshPublicCapacity = useCallback(async (): Promise<PublicCapacityInfo> => {
    const capacity = props.refreshPublicCapacity
      ? await props.refreshPublicCapacity()
      : await getPublicCapacity();
    if (!props.refreshPublicCapacity) {
      setLocalPublicCapacity(capacity);
    }
    return capacity;
  }, [props.refreshPublicCapacity]);

  useEffect(() => {
    if (props.refreshPublicCapacity) {
      return;
    }
    void refreshPublicCapacity();
  }, [props.refreshPublicCapacity, refreshPublicCapacity]);

  const stopQueuedJobPolling = useCallback(() => {
    if (queuedJobPollRef.current !== null) {
      window.clearInterval(queuedJobPollRef.current);
      queuedJobPollRef.current = null;
    }
  }, []);

  const startQueuedJobPolling = useCallback((jobId: string) => {
    stopQueuedJobPolling();
    queuedJobPollRef.current = window.setInterval(() => {
      void getJob(jobId).then((job) => {
        if (!job) return;
        setQueuedJob(job);
        if (
          job.status === 'succeeded' ||
          job.status === 'failed' ||
          job.status === 'cancelled'
        ) {
          stopQueuedJobPolling();
        }
      });
    }, 2000);
  }, [stopQueuedJobPolling]);

  useEffect(() => stopQueuedJobPolling, [stopQueuedJobPolling]);

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

  const lyricsRequired = musicMode === 'with_lyrics';
  const trimmedLyrics = lyrics.trim();
  const selectedCreationMode = CREATION_MODES.find((item) => item.value === creationMode)
    ?? CREATION_MODES[0];
  const isPublicCapacityFull = publicCapacity?.capacityFull === true;
  const canSubmit =
    enabled &&
    !submitting &&
    apiKey.length >= 20 &&
    prompt.trim().length > 0 &&
    (!lyricsRequired || trimmedLyrics.length > 0) &&
    confirmed &&
    !isPublicCapacityFull &&
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

  function handleCreationModeChange(nextMode: CreationMode): void {
    setCreationMode(nextMode);
    setMusicMode(nextMode === 'lyrics' ? 'with_lyrics' : 'instrumental');
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!canSubmit) {
      if (enabled && !submitting && isPublicCapacityFull) {
        setLastResult({
          ok: false,
          code: 'public_capacity_full',
          message: '当前使用人数已满，请稍后再试。网站处于 5 人内轻量公开模式。',
        });
        props.onStatusChange?.('error');
        return;
      }
      if (enabled && !submitting && lyricsRequired && trimmedLyrics.length === 0) {
        setLastResult({
          ok: false,
          code: 'byok_lyrics_required',
          message: 'Lyrics are required for with_lyrics mode.',
        });
        props.onStatusChange?.('error');
      }
      return;
    }
    const capacity = await refreshPublicCapacity();
    if (capacity.capacityFull === true) {
      setLastResult({
        ok: false,
        code: 'public_capacity_full',
        message: '当前使用人数已满，请稍后再试。网站处于 5 人内轻量公开模式。',
      });
      props.onStatusChange?.('error');
      return;
    }
    setSubmitting(true);
    setLastResult(null);
    setQueuedJob(null);
    stopQueuedJobPolling();
    setLibrarySaveState('idle');
    setLibrarySaveResult(null);
    setLibrarySaveError('');
    props.onStatusChange?.('submitting');
    try {
      const input = {
        prompt,
        model,
        generationIntent: musicMode,
        mode: musicMode === 'with_lyrics' ? 'lyrics' : 'instrumental',
        ...(musicMode === 'with_lyrics' ? { lyrics: trimmedLyrics } : {}),
      };
      const r = await fetch(BYOK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          apiKey,
          // Phase BYOK-B: include prompt + musicMode so the fake / live
          // adapter can produce a deterministic / real response.
          input,
          // Phase Deploy-CF-E: include Turnstile token when configured.
          // The token is single-use; after the request we reset the widget.
          turnstileToken:
            turnstileConfigured && turnstileToken
              ? turnstileToken
              : undefined,
          // Phase BYOK-H3B-FRONTEND-MODE-FOLLOWUP: send explicit mode.
          // Public-lite BYOK uses queued mode: the server stores the key
          // only in an in-memory job secret and runs one job at a time.
          mode: 'queued',
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
      const data = await readByokResponse(r);
      setLastResult(data);
      if (data.ok === true && data.job?.id) {
        setQueuedJob(data.job);
        startQueuedJobPolling(data.job.id);
      }
      if (!r.ok || data.ok === false) {
        props.onStatusChange?.(r.status === 403 ? 'disabled' : 'error');
      } else {
        props.onStatusChange?.('ok');
      }
    } catch (err) {
      setLastResult({
        ok: false,
        code: 'network_error',
        message: (err as Error)?.message || '网络请求失败',
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

  const okResult = lastResult?.ok ? lastResult : null;
  const queuedJobResult = okResult?.code === 'byok_job_queued'
    ? queuedJob ?? okResult.job ?? null
    : null;
  const queuedTrack = queuedJobResult?.track;
  const queuedTrackAudioUrl = queuedTrack
    ? queuedTrack.audioUrl ?? getTrackAudioUrl(queuedTrack.id)
    : undefined;
  const queuedTrackDownloadUrl = queuedTrack
    ? queuedTrack.downloadUrl ?? getTrackDownloadUrl(queuedTrack.id)
    : undefined;
  const directLiveAudioUrl =
    okResult?.audioResult?.audioUrl ?? okResult?.audioUrl;
  const directLiveDownloadUrl =
    okResult?.audioResult?.downloadUrl ?? okResult?.downloadUrl ?? directLiveAudioUrl;
  const isDirectLiveRelayResult = okResult?.code === 'byok_direct_live_ok';
  const savedLibraryTrack =
    librarySaveResult?.ok === true &&
    librarySaveResult.library?.saved === true &&
    librarySaveResult.track
      ? librarySaveResult.track
      : null;
  const directLiveDisplayedAudioUrl = savedLibraryTrack?.audioUrl ?? directLiveAudioUrl;
  const directLiveDisplayedDownloadUrl =
    savedLibraryTrack?.downloadUrl ?? directLiveDownloadUrl;
  const canSaveDirectLiveResult =
    isDirectLiveRelayResult &&
    Boolean(directLiveAudioUrl) &&
    okResult?.library?.saved !== true &&
    librarySaveState !== 'saved';
  const directLiveLibraryState =
    savedLibraryTrack
      ? 'saved'
      : okResult?.library?.status ?? (okResult?.library?.saved ? 'saved' : 'not_saved');

  async function handleSaveToLibrary(): Promise<void> {
    if (!okResult || !directLiveAudioUrl || !okResult.requestId) {
      setLibrarySaveState('error');
      setLibrarySaveError('Save failed: this result is missing a requestId or audio URL.');
      return;
    }

    const capacity = await refreshPublicCapacity();
    if (capacity.capacityFull === true) {
      setLibrarySaveState('error');
      setLibrarySaveError('当前使用人数已满，请稍后再试。网站处于 5 人内轻量公开模式。');
      return;
    }

    setLibrarySaveState('saving');
    setLibrarySaveError('');

    const result = await saveByokDirectLiveToLibrary({
      requestId: okResult.requestId,
      taskId: okResult.taskId,
      audioUrl: directLiveAudioUrl,
      model: okResult.model ?? model,
      generationIntent: okResult.generationIntent ?? musicMode,
      prompt,
      title: prompt.trim() || 'BYOK direct-live result',
      provider: 'minimax',
      confirmation: directLiveConfirmation,
    });

    setLibrarySaveResult(result);
    if (
      result.ok === true &&
      result.library?.saved === true &&
      result.track &&
      (result.code === 'byok_library_persist_ok' ||
        result.code === 'byok_library_persist_existing' ||
        typeof result.code === 'undefined')
    ) {
      setLibrarySaveState('saved');
      return;
    }

    setLibrarySaveState('error');
    setLibrarySaveError(byokLibrarySaveMessage(result.code, result.message));
  }

  return (
    <section className={styles.byokPanel} aria-label="MiniMax API Key 音乐生成">
      <header className={styles.header}>
        <h2 className={styles.title}>使用自己的 MiniMax API Key 生成</h2>
        <p className={styles.subtitle}>{COPY.headerSubtitle}</p>
      </header>

      {isPublicCapacityFull && (
        <div
          className={styles.capacityNotice}
          role="status"
          data-public-capacity="full"
          data-public-lite-mode="five-user"
        >
          当前使用人数已满，请稍后再试。网站处于 5 人内轻量公开模式。
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit} autoComplete="off">
        <fieldset className={styles.modeFieldset} disabled={!enabled || submitting}>
          <legend className={styles.label}>选择模式</legend>
          <div className={styles.modeGrid}>
            {CREATION_MODES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`${styles.modeOption} ${
                  creationMode === item.value ? styles.modeOptionActive : ''
                }`}
                onClick={() => handleCreationModeChange(item.value)}
              >
                <span>{item.label}</span>
                <small>{item.hint}</small>
              </button>
            ))}
          </div>
        </fieldset>

        <label className={styles.label} htmlFor="byok-prompt">
          音乐描述
        </label>
        <textarea
          id="byok-prompt"
          className={styles.textarea}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            creationMode === 'reference'
              ? '例如：参考 90 年代港风流行质感，保留温暖合成器和中速律动'
              : '例如：深夜城市里的温柔电子乐，带一点钢琴和低频律动'
          }
          rows={2}
          maxLength={500}
          required
          disabled={!enabled || submitting}
        />

        {lyricsRequired && (
          <>
            <label className={styles.label} htmlFor="byok-lyrics">
              歌词
            </label>
            <textarea
              id="byok-lyrics"
              className={styles.textarea}
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="[Verse]\n写下你的歌词，或先用一句主题扩展成歌词草稿"
              rows={4}
              maxLength={3000}
              required
              disabled={!enabled || submitting}
            />
          </>
        )}

        <p className={styles.modeHelp}>
          当前选择：{selectedCreationMode.label}。生成完成后可以播放、下载 MP3，并保存到作品库。
        </p>

        <div className={styles.credentialGrid}>
          <div className={styles.fieldStack}>
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
          </div>

          <div className={styles.fieldStack}>
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
          </div>
        </div>        {/* Phase BYOK-H2D: Key 隐私说明 + 敏感 prompt 提醒 */}
        <p className={styles.hint} data-h2d="api-key-hint">
          {COPY.apiKeyHint}
        </p>
        <p className={styles.hint} data-h2d="prompt-no-sensitive">
          {COPY.apiKeyNoSensitivePrompt}
        </p>

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
                  完成人机验证
                  {turnstileEnforced && (
                    <span className={styles.turnstileRequired}>（必填）</span>
                  )}
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
                    正在加载验证组件…
                  </span>
                )}
                {turnstileUiState === 'ready' && (
                  <span className={styles.turnstileHint}>
                    请完成下方人机验证。
                  </span>
                )}
                {turnstileUiState === 'verified' && (
                  <span className={styles.turnstileHintOk}>
                    ✓ 已完成验证
                  </span>
                )}
                {turnstileUiState === 'expired' && (
                  <span className={styles.turnstileHintWarn}>
                    验证已过期，请重新验证
                  </span>
                )}
                {turnstileUiState === 'error' && (
                  <span className={styles.turnstileHintErr}>
                    验证加载失败，请刷新页面重试
                  </span>
                )}
              </>
            ) : (
              <span className={styles.turnstileNotConfigured}>
                人机验证暂不可用，当前为非阻断模式
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
            {submitting ? '正在提交…' : COPY.submitIdleDryRun}
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
              <span className={styles.resultMsg}>
                {lastResult.code === 'byok_job_queued'
                  ? '生成任务已进入队列。当前有任务正在生成时，会自动等待。'
                  : lastResult.message}
              </span>
              {queuedJobResult && (
                <div
                  className={styles.saveToLibraryCard}
                  data-byok-queued-job="status"
                  data-byok-job-status={queuedJobResult.status}
                >
                  <div className={styles.saveHeader}>
                    <div>
                      <strong>
                        {queuedJobResult.status === 'succeeded'
                          ? '生成完成'
                          : queuedJobResult.status === 'running'
                          ? '正在生成'
                          : queuedJobResult.status === 'failed'
                          ? '生成失败'
                          : '任务已排队'}
                      </strong>
                      <p className={styles.saveDescription}>
                        {queuedJobResult.status === 'succeeded'
                          ? '音乐已经生成，可以试听、下载或保存到作品库。'
                          : queuedJobResult.status === 'running'
                          ? '正在生成音乐，通常需要等待一会儿。'
                          : queuedJobResult.status === 'failed'
                          ? '生成没有完成，请查看提示后再试。'
                          : '任务会按顺序执行，请保持页面打开。'}
                      </p>
                    </div>
                    <span className={`${styles.saveStatusBadge} ${styles.saveStatusIdle}`}>
                      {queuedJobResult.status === 'succeeded'
                        ? '已完成'
                        : queuedJobResult.status === 'running'
                        ? '生成中'
                        : queuedJobResult.status === 'failed'
                        ? '失败'
                        : '排队中'}
                    </span>
                  </div>
                  {queuedJobResult.progressMessage && (
                    <small className={styles.resultHint}>
                      {queuedJobResult.progressMessage}
                      {typeof queuedJobResult.progressPercent === 'number' && (
                        <> · {queuedJobResult.progressPercent}%</>
                      )}
                    </small>
                  )}
                  {queuedJobResult.status === 'failed' && queuedJobResult.error?.message && (
                    <small className={styles.saveError}>
                      {queuedJobResult.error.message}
                    </small>
                  )}
                  {queuedTrack && queuedTrackAudioUrl && (
                    <div className={styles.audioPreviewBlock}>
                      <audio
                        className={styles.audioPreview}
                        controls
                        src={queuedTrackAudioUrl}
                      />
                      <div className={styles.saveActions}>
                        <a
                          className={styles.localTrackLink}
                          href={queuedTrackAudioUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          播放
                        </a>
                        {queuedTrackDownloadUrl && (
                          <a
                            className={styles.localTrackLink}
                            href={queuedTrackDownloadUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            下载 MP3
                          </a>
                        )}
                        <a
                          className={styles.localTrackLink}
                          href={`/library?track=${encodeURIComponent(queuedTrack.id)}`}
                        >
                          保存到作品库
                        </a>
                        <button
                          type="button"
                          className={styles.inlineActionButton}
                          onClick={() => {
                            setLastResult(null);
                            setQueuedJob(null);
                            setLibrarySaveState('idle');
                          }}
                        >
                          再生成相似风格
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {isDirectLiveRelayResult && (
                <>
                  <br />
                  <small
                    className={styles.resultMeta}
                    data-byok-direct-live-result="summary"
                  >
                    stage: <code>{okResult?.stage ?? 'direct_live_relay_ok'}</code>
                    {okResult?.requestId && (
                      <> · requestId: <code>{okResult.requestId}</code></>
                    )}
                    {okResult?.model && (
                      <> · model: <code>{okResult.model}</code></>
                    )}
                    {okResult?.generationIntent && (
                      <> · generationIntent: <code>{okResult.generationIntent}</code></>
                    )}
                    {okResult?.taskId && (
                      <> · taskId: <code>{okResult.taskId}</code></>
                    )}
                  </small>
                  {directLiveAudioUrl ? (
                    <div
                      className={styles.audioPreviewBlock}
                      data-byok-direct-live-audio="available"
                    >
                      <audio
                        className={styles.audioPreview}
                        controls
                        src={directLiveDisplayedAudioUrl}
                      />
                      {directLiveDisplayedDownloadUrl && (
                        <a
                          className={styles.resultLink}
                          href={directLiveDisplayedDownloadUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {savedLibraryTrack ? 'Open local track' : 'Open / download audio'}
                        </a>
                      )}
                    </div>
                  ) : (
                    <small
                      className={styles.resultHint}
                      data-byok-direct-live-audio="missing"
                    >
                      Direct-live relay succeeded, but no audio URL was returned.
                    </small>
                  )}
                  <small
                    className={styles.libraryState}
                    data-byok-library-state={directLiveLibraryState}
                  >
                    {savedLibraryTrack || okResult?.library?.saved === true
                      ? 'Saved to Library.'
                      : 'Not saved to Library. This result is currently a temporary provider relay link.'}
                  </small>
                  {directLiveAudioUrl && (
                    <div
                      className={styles.saveToLibraryCard}
                      data-byok-save-to-library="card"
                      data-byok-save-state={librarySaveState}
                    >
                      <div className={styles.saveHeader}>
                        <div>
                          <strong>
                            {librarySaveState === 'saved'
                              ? 'Saved to Library'
                              : 'Save to Library'}
                          </strong>
                          <p className={styles.saveDescription}>
                            {savedLibraryTrack
                              ? 'This result now uses a local Library-backed track.'
                              : 'This result is currently a temporary provider relay link.'}
                          </p>
                        </div>
                        <span
                          className={`${styles.saveStatusBadge} ${
                            librarySaveState === 'saved'
                              ? styles.saveStatusSaved
                              : librarySaveState === 'error'
                              ? styles.saveStatusError
                              : styles.saveStatusIdle
                          }`}
                        >
                          {librarySaveState === 'saved'
                            ? 'Saved'
                            : librarySaveState === 'saving'
                            ? 'Saving'
                            : librarySaveState === 'error'
                            ? 'Save failed'
                            : 'Not saved'}
                        </span>
                      </div>
                      {librarySaveState === 'saved' && savedLibraryTrack ? (
                        <div className={styles.localTrackMeta}>
                          <span>
                            trackId: <code>{savedLibraryTrack.id}</code>
                            {librarySaveResult?.library?.idempotent && (
                              <> · existing/idempotent</>
                            )}
                          </span>
                          <div className={styles.saveActions}>
                            {savedLibraryTrack.audioUrl && (
                              <a
                                className={styles.localTrackLink}
                                href={savedLibraryTrack.audioUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open local track
                              </a>
                            )}
                            <a
                              className={styles.localTrackLink}
                              href={`/library?track=${encodeURIComponent(savedLibraryTrack.id)}`}
                            >
                              Go to Library
                            </a>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={styles.saveButton}
                          onClick={handleSaveToLibrary}
                          disabled={!canSaveDirectLiveResult || librarySaveState === 'saving'}
                        >
                          {librarySaveState === 'saving'
                            ? 'Saving to Library...'
                            : 'Save to Library'}
                        </button>
                      )}
                      {librarySaveState === 'error' && (
                        <small className={styles.saveError}>
                          {librarySaveError || 'Save failed'}
                        </small>
                      )}
                    </div>
                  )}
                </>
              )}
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
              {(lastResult.requestId || lastResult.stage || lastResult.httpStatus) && (
                <>
                  <br />
                  <small className={styles.resultHint}>
                    {lastResult.requestId && (
                      <>requestId: <code>{lastResult.requestId}</code> </>
                    )}
                    {lastResult.stage && (
                      <>stage: <code>{lastResult.stage}</code> </>
                    )}
                    {typeof lastResult.httpStatus === 'number' && (
                      <>HTTP: <code>{lastResult.httpStatus}</code> </>
                    )}
                  </small>
                </>
              )}
            </>
          )}
        </div>
      )}

      <footer className={styles.footer}>
        <small data-h2d="footer-line">{COPY.h2dFooterLine}</small>
      </footer>
    </section>
  );
}
