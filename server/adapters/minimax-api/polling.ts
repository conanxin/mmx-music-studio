/**
 * server/adapters/minimax-api/polling.ts
 *
 * Async task polling design types and helpers.
 *
 * STATUS: DEFENSIVE DESIGN ONLY — no real polling requests are made.
 *
 * Rationale:
 * - Official MiniMax music_generation documentation does NOT confirm a polling endpoint.
 * - The primary documented response path is synchronous data.audio (URL/hex).
 * - If MiniMax ever returns task_id, this module provides type safety and a clear UX path.
 * - Until an official status endpoint is confirmed, NO real polling calls are made.
 *
 * No network calls. No key logging.
 */

export type MiniMaxAsyncTaskStatus =
  | 'accepted' // Task created, not yet processing
  | 'queued'       // Task queued for processing
  | 'processing'   // Task is being processed
  | 'succeeded' // Task completed successfully
  | 'failed'       // Task failed
  | 'timeout'      // Task exceeded time limit
  | 'unknown';     // Unrecognized status

export interface MiniMaxAsyncTaskReference {
  taskId: string;
  rawStatus?: string;
  provider: 'minimax';
  /** Always false — polling endpoint not confirmed from official docs */
  pollingEndpointConfigured: false;
}

export interface NormalizedAsyncTask {
  taskId: string;
  normalizedStatus: MiniMaxAsyncTaskStatus;
  rawStatus: string | undefined;
  reference: MiniMaxAsyncTaskReference;
}

const STATUS_MAP: Record<string, MiniMaxAsyncTaskStatus> = {
  accepted:   'accepted',
  pending:    'queued',
  queued:     'queued',
  running:    'processing',
  processing: 'processing',
  succeeded:  'succeeded',
  success:    'succeeded',
  completed:  'succeeded',
  failed:     'failed',
  error:      'failed',
  timeout:    'timeout',
};

/**
 * Normalize a raw MiniMax task status string to a known enum value.
 * Falls back to 'unknown' for any unrecognized status.
 */
export function normalizeMiniMaxTaskStatus(raw: unknown): MiniMaxAsyncTaskStatus {
  if (typeof raw !== 'string') return 'unknown';
  return STATUS_MAP[raw.toLowerCase()] ?? 'unknown';
}

/**
 * Parse an async task reference from a raw API response object.
 * Returns null if the response does not contain task_id.
 */
export function parseAsyncTaskReference(raw: unknown): NormalizedAsyncTask | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const obj = raw as Record<string, unknown>;
  const data = (obj.data || obj) as Record<string, unknown>;

  const rawTaskId =
    (typeof obj.task_id === 'string' ? obj.task_id : undefined) ||
    (typeof (obj as Record<string, unknown>).taskId === 'string' ? (obj as Record<string, unknown>).taskId as string : undefined) ||
    (typeof data.task_id === 'string' ? data.task_id : undefined) ||
    (typeof data.taskId === 'string' ? data.taskId as string : undefined);

  if (!rawTaskId) return null;

  const rawStatus = typeof obj.status === 'string' ? obj.status : undefined;
  const normalizedStatus = normalizeMiniMaxTaskStatus(rawStatus);

  return {
    taskId: rawTaskId,
    normalizedStatus,
    rawStatus,
    reference: {
      taskId: rawTaskId,
      rawStatus,
      provider: 'minimax',
      pollingEndpointConfigured: false,
    },
  };
}

/**
 * Human-readable label for a PlaybackMode enum value.
 * Exported for use in error messages and logs (no secrets).
 */
export function asyncTaskStatusLabel(status: MiniMaxAsyncTaskStatus): string {
  const labels: Record<MiniMaxAsyncTaskStatus, string> = {
    accepted:   '已接收',
    queued:     '排队中',
    processing: '生成中',
    succeeded:  '已完成',
    failed:     '失败',
    timeout:    '超时',
    unknown:    '未知状态',
  };
  return labels[status];
}