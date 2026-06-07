import { useState, useEffect, type ReactNode } from 'react';
import styles from './PreviewAccessGate.module.css';

interface AccessStatus {
  ok: boolean;
  enabled: boolean;
  unlocked: boolean;
}

interface Props {
  children: ReactNode;
}

/** Gate that checks preview access and shows PIN screen if locked. */
export default function PreviewAccessGate({ children }: Props) {
  const [status, setStatus] = useState<AccessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAccessStatus();
  }, []);

  async function fetchAccessStatus() {
    try {
      const res = await fetch('/api/preview-access/status', { credentials: 'include' });
      if (res.ok) {
        const data: AccessStatus = await res.json();
        setStatus(data);
      } else {
        // Health endpoint should always work; treat as locked if error
        setStatus({ ok: false, enabled: true, unlocked: false });
      }
    } catch {
      setStatus({ ok: false, enabled: true, unlocked: false });
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/preview-access/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ ok: true, enabled: true, unlocked: true });
        setPin('');
      } else {
        setError(data?.error?.message || data?.message || '访问码不正确');
      }
    } catch {
      setError('无法连接服务器，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !status) {
    return (
      <div className={styles.gate}>
        <div className={styles.card}>
          <div className={styles.title} style={{ color: '#9ba1aa' }}>检查访问状态…</div>
        </div>
      </div>
    );
  }

  // Access control disabled — show app directly
  if (!status.enabled) {
    return <>{children}</>;
  }

  // Access control enabled but already unlocked — show app
  if (status.unlocked) {
    return <>{children}</>;
  }

  // Locked — show PIN gate
  return (
    <div className={styles.gate}>
      <div className={styles.card}>
        <div className={styles.icon}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        <div>
          <p className={styles.title}>MiniMax 音乐创作台</p>
        </div>

        <p className={styles.subtitle}>这是安全预览版<br />请输入访问码</p>

        <form className={styles.form} onSubmit={handleUnlock}>
          <input
            type="password"
            className={styles.input}
            placeholder="访问码"
            value={pin}
            onChange={e => setPin(e.target.value)}
            autoComplete="off"
            autoFocus
            maxLength={32}
          />
          {error && <p className={styles.error}>{error}</p>}
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={!pin.trim() || submitting}
          >
            {submitting ? '验证中…' : '进入预览'}
          </button>
        </form>

        <p className={styles.hint}>访问码由部署者提供</p>
      </div>
    </div>
  );
}
