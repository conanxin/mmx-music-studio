import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import styles from './Jobs.module.css';
import {
  listJobsFiltered,
  getJob,
  cancelJob,
  deleteJob,
  retryJob,
  getJobStats,
  getTrackAudioUrl,
  getTrackDownloadUrl,
  type GenerateJob,
} from '../../lib/serverApi';

type FilterStatus = 'all' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

interface JobStats {
  total: number;
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  workerBusy: boolean;
  queueLength: number;
}

const STATUS_LABEL: Record<string, string> = {
  queued: '排队中',
  running: '生成中',
  succeeded: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

const SOURCE_LABEL: Record<string, string> = {
  mock: '本地模拟',
  minimax: 'MiniMax API',
  'mmx-cli': 'MMX CLI',
};

const FILTER_TABS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'queued', label: '排队中' },
  { value: 'running', label: '生成中' },
  { value: 'succeeded', label: '已完成' },
  { value: 'failed', label: '失败' },
  { value: 'cancelled', label: '已取消' },
];

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

function formatTime(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function ProgressBar({ progress }: { progress?: number }) {
  const pct = Math.round((progress ?? 0) * 100);
  return (
    <div className={styles.progressBar}>
      <div className={styles.progressFill} style={{ width: `${pct}%` }} />
    </div>
  );
}

function JobCard({ job, onView, onCancel, onDelete, onRetry }: {
  job: GenerateJob;
  onView: (j: GenerateJob) => void;
  onCancel: (j: GenerateJob) => void;
  onDelete: (j: GenerateJob) => void;
  onRetry: (j: GenerateJob) => void;
}) {
  const track = job.track;
  const source = job.generationSource;
  const prompt = job.input?.prompt || track?.prompt || track?.title || '—';

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTop}>
          <span className={styles.jobId} title={job.id}>{shortId(job.id)}</span>
          <span className={`${styles.badge} ${styles[`badge_${job.status}`]}`}>
            {STATUS_LABEL[job.status] ?? job.status}
          </span>
          {source && (
            <span className={styles.sourceTag}>{SOURCE_LABEL[source] ?? source}</span>
          )}
        </div>
        <span className={styles.cardTime}>{formatTime(job.createdAt)}</span>
      </div>

      <div className={styles.cardBody}>
        <p className={styles.prompt}>{prompt}</p>
        {job.status === 'running' && (
          <ProgressBar progress={job.progress} />
        )}
        {job.progressMessage && (
          <p className={styles.progressMsg}>{job.progressMessage}</p>
        )}
        {job.error && (
          <p className={styles.errorMsg}>{job.error.message}</p>
        )}
      </div>

      <div className={styles.cardFooter}>
        <span className={styles.modeLabel}>
          {track ? (track.mode === 'instrumental' ? '纯音乐' : track.mode === 'auto' ? '自动成歌' : track.mode === 'lyrics' ? '歌词成歌' : track.mode) : '—'}
        </span>
        <div className={styles.cardActions}>
          <button className={styles.viewBtn} onClick={() => onView(job)}>详情</button>
          {(job.status === 'queued' || job.status === 'running') && (
            <button className={styles.cancelBtn} onClick={() => onCancel(job)}>取消</button>
          )}
          {(job.status === 'failed' || job.status === 'cancelled') && (
            <button className={styles.retryBtn} onClick={() => onRetry(job)}>重试</button>
          )}
          {(job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') && (
            <button className={styles.deleteBtn} onClick={() => onDelete(job)}>删除</button>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailPanel({ job, onClose, onCancel, onDelete, onRetry }: {
  job: GenerateJob;
  onClose: () => void;
  onCancel: (j: GenerateJob) => void;
  onDelete: (j: GenerateJob) => void;
  onRetry: (j: GenerateJob) => void;
}) {
  const track = job.track;
  const audioUrl = track?.id ? getTrackAudioUrl(track.id) : undefined;
  const downloadUrl = track?.id ? getTrackDownloadUrl(track.id) : undefined;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>任务详情</h3>
        <button className={styles.panelClose} onClick={onClose} aria-label="关闭">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className={styles.panelBody}>
        <div className={styles.infoGrid}>
          <div className={styles.infoRow}>
            <span className={styles.infoKey}>任务 ID</span>
            <span className={styles.infoVal} style={{ fontFamily: 'monospace', fontSize: '11px' }}>{job.id}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoKey}>状态</span>
            <span className={`${styles.badge} ${styles[`badge_${job.status}`]}`}>{STATUS_LABEL[job.status] ?? job.status}</span>
          </div>
          {job.status === 'running' && job.progress !== undefined && (
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>进度</span>
              <span className={styles.infoVal}>{Math.round(job.progress * 100)}%</span>
            </div>
          )}
          {job.progressMessage && (
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>消息</span>
              <span className={styles.infoVal}>{job.progressMessage}</span>
            </div>
          )}
          {track?.title && (
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>作品标题</span>
              <span className={styles.infoVal}>{track.title}</span>
            </div>
          )}
          {track?.mode && (
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>生成模式</span>
              <span className={styles.infoVal}>
                {track.mode === 'instrumental' ? '纯音乐' : track.mode === 'auto' ? '自动成歌' : track.mode === 'lyrics' ? '歌词成歌' : track.mode}
              </span>
            </div>
          )}
          {job.input?.prompt && (
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>描述</span>
              <span className={styles.infoVal} style={{ fontSize: '12px', color: '#9BA1AA' }}>{job.input.prompt}</span>
            </div>
          )}
          {job.generationSource && (
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>来源</span>
              <span className={styles.infoVal}>{SOURCE_LABEL[job.generationSource] ?? job.generationSource}</span>
            </div>
          )}
          {job.error && (
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>错误</span>
              <span className={styles.infoVal} style={{ color: '#FF6B6B', fontSize: '12px' }}>{job.error.message}</span>
            </div>
          )}
          {job.error?.hint && (
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>提示</span>
              <span className={styles.infoVal} style={{ fontSize: '12px', color: '#9BA1AA' }}>{job.error.hint}</span>
            </div>
          )}
          <div className={styles.infoRow}>
            <span className={styles.infoKey}>创建时间</span>
            <span className={styles.infoVal}>{formatTime(job.createdAt)}</span>
          </div>
          {job.startedAt && (
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>开始时间</span>
              <span className={styles.infoVal}>{formatTime(job.startedAt)}</span>
            </div>
          )}
          {job.completedAt && (
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>完成时间</span>
              <span className={styles.infoVal}>{formatTime(job.completedAt)}</span>
            </div>
          )}
          {job.updatedAt && job.status !== 'running' && (
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>更新时间</span>
              <span className={styles.infoVal}>{formatTime(job.updatedAt)}</span>
            </div>
          )}
        </div>

        {track?.durationText && (
          <div className={styles.infoRow}>
            <span className={styles.infoKey}>时长</span>
            <span className={styles.infoVal}>{track.durationText}</span>
          </div>
        )}

        {audioUrl && (
          <div className={styles.audioLinks}>
            <audio controls src={audioUrl} style={{ width: '100%', height: '36px' }} />
            {downloadUrl && (
              <a href={downloadUrl} download className={styles.downloadLink} target="_blank" rel="noreferrer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                下载 MP3
              </a>
            )}
          </div>
        )}
      </div>

      <div className={styles.panelFooter}>
        {(job.status === 'queued' || job.status === 'running') && (
          <button className={styles.cancelBtn} onClick={() => onCancel(job)}>取消任务</button>
        )}
        {(job.status === 'failed' || job.status === 'cancelled') && (
          <button className={styles.retryBtn} onClick={() => onRetry(job)}>重试</button>
        )}
        {(job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') && (
          <button className={styles.deleteBtn} onClick={() => onDelete(job)}>删除记录</button>
        )}
        <p className={styles.deleteHint}>删除任务记录不会删除已生成的音频文件</p>
      </div>
    </div>
  );
}

export default function Jobs() {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [jobs, setJobs] = useState<GenerateJob[]>([]);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedJob, setSelectedJob] = useState<GenerateJob | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsResult, jobsResult] = await Promise.all([
        getJobStats().catch(() => null),
        listJobsFiltered(filter === 'all' ? {} : { status: filter }),
      ]);
      if (statsResult?.ok && statsResult.stats) {
        setStats(statsResult.stats);
      }
      if (jobsResult.ok) {
        setJobs(jobsResult.jobs);
      } else {
        setError('无法加载任务历史');
      }
    } catch {
      setError('无法加载任务历史');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh detail panel if job status changed
  useEffect(() => {
    if (!selectedJob) return;
    getJob(selectedJob.id).then(updated => {
      if (updated) setSelectedJob(updated);
    });
  }, [jobs, selectedJob?.id]);

  const showMsg = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 3000);
  };

  const handleCancel = async (job: GenerateJob) => {
    if (job.status === 'running' && !window.confirm('任务正在运行中，确定要取消吗？')) return;
    const result = await cancelJob(job.id);
    if (result.ok) {
      showMsg('任务已取消');
      loadData();
      if (selectedJob?.id === job.id) setSelectedJob(null);
    } else {
      showMsg(result.error?.message || '取消失败');
    }
  };

  const handleDelete = async (job: GenerateJob) => {
    if (!window.confirm('确定要删除此任务记录吗？音频文件不会被删除。')) return;
    const result = await deleteJob(job.id);
    if (result.ok) {
      showMsg('已删除');
      loadData();
      if (selectedJob?.id === job.id) setSelectedJob(null);
    } else {
      showMsg(result.error?.message || '删除失败');
    }
  };

  const handleRetry = async (job: GenerateJob) => {
    const result = await retryJob(job.id);
    if (result.ok) {
      showMsg('已重新提交生成');
      loadData();
      if (selectedJob?.id === job.id) setSelectedJob(null);
    } else {
      showMsg(result.error?.message || '重试失败');
    }
  };

  const statCards = stats ? [
    { key: 'total', label: '全部', value: stats.total },
    { key: 'queued', label: '排队中', value: stats.queued },
    { key: 'running', label: '运行中', value: stats.running },
    { key: 'succeeded', label: '已完成', value: stats.succeeded },
    { key: 'failed', label: '失败', value: stats.failed },
    { key: 'cancelled', label: '已取消', value: stats.cancelled },
  ] : [];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>任务历史</h1>
          <Link to="/studio" className={styles.studioLink}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            新建生成
          </Link>
        </div>

        {/* Stats */}
        {statCards.length > 0 && (
          <div className={styles.statsGrid}>
            {statCards.map(s => (
              <button
                key={s.key}
                className={`${styles.statCard} ${filter === s.key ? styles.statActive : ''}`}
                onClick={() => setFilter(s.key as FilterStatus)}
              >
                <span className={styles.statValue}>{s.value}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Filter tabs */}
        <div className={styles.filterBar}>
          {FILTER_TABS.map(tab => (
            <button
              key={tab.value}
              className={`${styles.filterTab} ${filter === tab.value ? styles.filterActive : ''}`}
              onClick={() => setFilter(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Action feedback */}
        {actionMsg && <div className={styles.actionMsg}>{actionMsg}</div>}

        {/* Loading */}
        {loading && (
          <div className={styles.loading}>
            <span className={styles.spinner} />
            加载中…
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className={styles.errorBox}>
            <p>{error}</p>
            <button onClick={loadData} className={styles.retryBtn}>重试</button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && jobs.length === 0 && (
          <div className={styles.empty}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <h3>还没有生成任务</h3>
            <p>去创作台生成你的第一首音乐</p>
            <Link to="/studio" className={styles.emptyBtn}>开始创作</Link>
          </div>
        )}

        {/* Job list */}
        {!loading && !error && jobs.length > 0 && (
          <div className={styles.jobList}>
            {jobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                onView={setSelectedJob}
                onCancel={handleCancel}
                onDelete={handleDelete}
                onRetry={handleRetry}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail panel overlay */}
      {selectedJob && (
        <div className={styles.panelOverlay} onClick={() => setSelectedJob(null)}>
          <div onClick={e => e.stopPropagation()}>
            <DetailPanel
              job={selectedJob}
              onClose={() => setSelectedJob(null)}
              onCancel={handleCancel}
              onDelete={handleDelete}
              onRetry={handleRetry}
            />
          </div>
        </div>
      )}
    </div>
  );
}