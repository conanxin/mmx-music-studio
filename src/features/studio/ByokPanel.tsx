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
 */
import { useState } from 'react';
import styles from './ByokPanel.module.css';

const BYOK_ENDPOINT = '/api/generate/byok';
const DISABLED_MESSAGE = 'BYOK 暂未开放';

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
  | 'byok_invalid_input'
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
  byok_provider_error: 'MiniMax 返回错误，已隐藏敏感信息',
  byok_provider_auth_failed: 'MiniMax 拒绝了该 Key（认证失败）',
  byok_provider_timeout: 'MiniMax 响应超时',
  byok_provider_not_found: 'MiniMax CLI 不可用',
  byok_provider_unsupported_mode: 'MiniMax 不支持该模式',
  byok_invalid_input: '请求参数无效',
};

interface ByokPanelProps {
  // Optional: parent can pass whether BYOK is currently allowed.
  // Default: treat as disabled (PUBLIC_BYOK_ENABLED=false) for safety.
  publicByokEnabled?: boolean;
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

  const canSubmit =
    enabled &&
    !submitting &&
    apiKey.length >= 20 &&
    prompt.length > 0 &&
    confirmed;

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
          Phase BYOK-B · fake/live 模式由服务端控制 · 不替换现有生成路径 · Key 不写入 localStorage /
          IndexedDB / URL query
        </small>
      </footer>
    </section>
  );
}