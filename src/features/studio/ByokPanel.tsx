/**
 * ByokPanel — Phase BYOK-A: Public BYOK generation readiness
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
 *
 * No browser-side calls to MiniMax. No key is ever echoed back to the DOM
 * after submission (only a length bucket).
 */
import { useState } from 'react';
import styles from './ByokPanel.module.css';

const BYOK_ENDPOINT = '/api/generate/byok';
const DISABLED_MESSAGE = 'BYOK 暂未开放';

interface ByokPanelProps {
  // Optional: parent can pass whether BYOK is currently allowed.
  // Default: treat as disabled (PUBLIC_BYOK_ENABLED=false) for safety.
  publicByokEnabled?: boolean;
  onStatusChange?: (status: 'idle' | 'submitting' | 'ok' | 'disabled' | 'error') => void;
}

interface ByokDryRunResponse {
  ok: true;
  dryRun: true;
  code: 'byok_dry_run_only';
  message: string;
  receivedKeyLengthBucket: 'tiny' | 'short' | 'normal' | 'long' | 'absurd';
  requestId: string;
}

interface ByokErrorResponse {
  ok: false;
  code?: string;
  message?: string;
  hint?: string;
}

export default function ByokPanel(props: ByokPanelProps): JSX.Element {
  // Default to DISABLED. Only enabled if parent explicitly says so.
  // This matches server's PUBLIC_BYOK_ENABLED=false default.
  const enabled = props.publicByokEnabled === true;

  const [apiKey, setApiKey] = useState<string>('');
  const [model, setModel] = useState<'music-2.6-free' | 'music-2.6'>('music-2.6-free');
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<ByokDryRunResponse | ByokErrorResponse | null>(null);

  const canSubmit = enabled && !submitting && apiKey.length >= 20 && confirmed;

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
          model,
          // Phase BYOK-A: only the apiKey + minimal model is sent.
          // No prompt / lyrics here — BYOK-A is dry-run readiness only.
        }),
      });
      const data = (await r.json()) as ByokDryRunResponse | ByokErrorResponse;
      if (!r.ok || data.ok === false) {
        setLastResult(data);
        props.onStatusChange?.(r.status === 403 ? 'disabled' : 'error');
      } else {
        setLastResult(data);
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
      // SECURITY: clear local key reference immediately after submit
      // so it doesn't linger in component state if the parent re-renders.
      // We keep it only if the user wants to retry.
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
          onChange={(e) => setModel(e.target.value as 'music-2.6-free' | 'music-2.6')}
          disabled={!enabled || submitting}
        >
          <option value="music-2.6-free">music-2.6-free</option>
          <option value="music-2.6">music-2.6</option>
        </select>

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
            {submitting ? '提交中…' : '使用我的 Key 试调一次（dry-run）'}
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
              <strong>dry-run 成功</strong>（{lastResult.code}）
              <br />
              <span className={styles.resultMsg}>{lastResult.message}</span>
              <br />
              <small>
                receivedKeyLengthBucket:{' '}
                <code>{lastResult.receivedKeyLengthBucket}</code> · requestId:{' '}
                <code>{lastResult.requestId}</code>
              </small>
            </>
          ) : (
            <>
              <strong>请求未通过</strong>
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
            </>
          )}
        </div>
      )}

      <footer className={styles.footer}>
        <small>
          Phase BYOK-A · 服务端 relay 草稿 · 不替换现有生成路径 · Key 不写入 localStorage /
          IndexedDB / URL query
        </small>
      </footer>
    </section>
  );
}
