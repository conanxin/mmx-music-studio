import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import styles from './Studio.module.css';
import WaveformPlayer from '../../components/WaveformPlayer';
import { useSettings } from '../../lib/settingsStore';
import { getHealth, createGenerateJob, getJob, cancelJob, listTracks, listJobsFiltered } from '../../lib/serverApi';
import type { TrackLike, GenerateJob } from '../../lib/serverApi';
import { STYLE_TAGS } from '../../mock/data';
import {
  validateMusicInput,
  createMockJob,
  advanceMockJob,
  MOCK_JOB_STEPS,
  type MusicMode as CoreMode,
  type MusicGenerationInput,
  type Job,
} from '../../../packages/core/src/index';

const UI_TO_CORE_MODE: Record<string, CoreMode> = {
  'pure-music': 'instrumental',
  'auto-song': 'auto',
  'lyric-song': 'lyrics',
  'cover-url': 'cover-url' as CoreMode,
  'cover-file': 'cover-file' as CoreMode,
};

const CORE_MODE_LABELS: Record<CoreMode, string> = {
  instrumental: '纯音乐',
  auto: '自动成歌',
  lyrics: '歌词成歌',
  'cover-url': '参考改编',
  'cover-file': '参考改编',
};

const MODES: string[] = ['pure-music', 'auto-song', 'lyric-song', 'cover-url', 'cover-file'];
const VISIBLE_TAGS = STYLE_TAGS.slice(0, 8);
const LANG_OPTIONS = ['中文', '英文', '日文', '韩文'];
const LANG_TO_CODE: Record<string, 'zh' | 'en' | 'ja' | 'ko'> = {
  中文: 'zh', 英文: 'en', 日文: 'ja', 韩文: 'ko',
};

const LYRIC_STRUCTURES = [
  { label: '+ 主歌', tag: '[Verse]' },
  { label: '+ 副歌', tag: '[Chorus]' },
  { label: '+ 桥段', tag: '[Bridge]' },
  { label: '+ 结尾', tag: '[Outro]' },
];

const UI_MODE_LABELS: Record<string, string> = {
  'pure-music': '纯音乐',
  'auto-song': '自动成歌',
  'lyric-song': '歌词成歌',
  'cover-url': '参考改编',
  'cover-file': '参考改编',
};

const PROMPT_EXAMPLES: string[] = [
  '深夜编程、爵士、放松',
  '周一通勤、轻快、电子',
  '电影感氛围、弦乐',
  '夏夜海边、Lo-fi',
  '冥想、自然音',
  '赛博朋克、科技感',
];

const EXAMPLE_LABELS: Record<string, string> = {
  'pure-music': '示例灵感',
  'auto-song': '歌曲主题',
  'lyric-song': '风格参考',
  'cover-url': '风格参考',
  'cover-file': '风格参考',
};

function getBackendLabel(backend?: string): string {
  switch (backend) {
    case 'cli': return 'MMX CLI';
    case 'api': return 'API Adapter';
    case 'mock': return '本地模拟';
    default: return backend ?? 'API Adapter';
  }
}

function deriveRuntimeModeLabel(health?: {
  previewAccessEnabled?: boolean;
  realGenerationEnabled?: boolean;
  mockGenerationEnabled?: boolean;
  backend?: string;
  byokEnabled?: boolean;
} | null): string {
  if (!health) return '连接中…';
  if (health.previewAccessEnabled) return '访问保护';
  if (health.backend === 'cli' && health.realGenerationEnabled) return 'MMX CLI 模式';
  if (health.byokEnabled && health.backend === 'api') return 'BYOK API 模式';
  if (health.backend === 'api' && health.realGenerationEnabled) return 'API 实验模式';
  if (!health.realGenerationEnabled && health.backend === 'mock' && health.mockGenerationEnabled) return '本地预览';
  return '自定义模式';
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type UIMode = 'pure-music' | 'auto-song' | 'lyric-song' | 'cover-url' | 'cover-file';

function resolveMode(): UIMode {
  const hash = window.location.hash.replace('#', '');
  const map: Record<string, UIMode> = {
    instrumental: 'pure-music',
    auto: 'auto-song',
    lyrics: 'lyric-song',
    'cover-url': 'cover-url',
    'cover-file': 'cover-file',
  };
  return map[hash] ?? 'pure-music';
}

function buildCoreInput(
  mode: UIMode,
  prompt: string,
  lyrics: string,
  stylePrompt: string,
  coverUrl: string,
  language: string,
  audioBase64?: string,
  audioFileName?: string,
  audioFileSize?: number,
  audioMimeType?: string,
): MusicGenerationInput {
  const coreMode = UI_TO_CORE_MODE[mode];
  const lang = LANG_TO_CODE[language] ?? 'zh';

  if (coreMode === 'instrumental') {
    return { mode: 'instrumental', prompt };
  }
  if (coreMode === 'auto') {
    return { mode: 'auto', prompt, language: lang };
  }
  if (coreMode === 'lyrics') {
    return { mode: 'lyrics', prompt, lyrics };
  }
  if (coreMode === 'cover-url') {
    return { mode: 'cover-url', prompt: stylePrompt || prompt, audioUrl: coverUrl };
  }
  if (coreMode === 'cover-file') {
    const input: MusicGenerationInput = {
      mode: 'cover-file',
      prompt: stylePrompt || prompt,
      audioBase64: audioBase64 || '',
      fileName: audioFileName,
      fileSizeBytes: audioFileSize,
      mimeType: audioMimeType,
    };
    if (audioBase64) input.audioBase64 = audioBase64;
    return input;
  }
  return { mode: 'instrumental', prompt };
}

// Convert durationText "2:31" → seconds
function durationTextToSeconds(text?: string): number {
  if (!text) return 0;
  const parts = text.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

// Map server TrackLike → UI display Track
interface DisplayTrack {
  id: string;
  title: string;
  mode: string;
  durationText?: string;
  audioUrl?: string;
  downloadUrl?: string;
}

function serverTrackToDisplay(t: TrackLike): DisplayTrack {
  return {
    id: t.id,
    title: t.title,
    mode: t.mode,
    durationText: t.durationText,
    audioUrl: t.audioUrl,
    downloadUrl: t.downloadUrl,
  };
}

export default function Studio() {
  const { settings } = useSettings();

  const [activeMode, setActiveMode] = useState<UIMode>(resolveMode);
  const [prompt, setPrompt] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [stylePrompt, setStylePrompt] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [language, setLanguage] = useState('中文');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Cover-file state
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverFileBase64, setCoverFileBase64] = useState('');
  const [coverFileSize, setCoverFileSize] = useState<number>(0);
  const [coverFileName, setCoverFileName] = useState('');
  const [coverFileMime, setCoverFileMime] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [generationSource, setGenerationSource] = useState<'mock' | 'minimax' | 'mmx-cli' | null>(null);
  const [currentTrack, setCurrentTrack] = useState<DisplayTrack | null>(null);
  const [recentTracks, setRecentTracks] = useState<DisplayTrack[]>([]);

  // Job queue state
  const [currentJob, setCurrentJob] = useState<GenerateJob | null>(null);
  const [jobElapsed, setJobElapsed] = useState(0);
  const jobTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobStartRef = useRef<number>(0);
  const [isCancelling, setIsCancelling] = useState(false);

  // Phase 5B-D-A: Submit guard — prevents duplicate clicks
  const lastGenerateClickAt = useRef<number>(0);
  const DEBOUNCE_MS = 10_000;

  // Health info state (extended)
  const [healthInfo, setHealthInfo] = useState<{
    backend?: string;
    realGenerationEnabled?: boolean;
    mockGenerationEnabled?: boolean;
    previewAccessEnabled?: boolean;
    // Phase 5A: BYOK
    byokEnabled?: boolean;
    // Phase 5B-C: Real API Attempt Guard
    realApiAttemptLimitEnabled?: boolean;
    realApiDailyAttemptLimit?: number;
    remainingRealApiAttempts?: number;
    // Phase 5D-A: Daily quota display
    dailyQuotaEnabled?: boolean;
    dailyGenerationUsed?: number;
    remainingDailyGenerations?: number;
  } | null>(null);

  // Phase 5A: BYOK — runtimeModeHint is derived from health, not stored in state
  function getRuntimeModeHint(): string | null {
    if (!healthInfo) return null;
    const isByokApi = healthInfo.byokEnabled && healthInfo.backend === 'api';
    if (isByokApi && !settings.apiKey) return '请先在设置页填写你的 MiniMax Token Plan Key，否则无法生成';
    if (isByokApi && settings.apiKey) return '将使用你的 Token Plan Key，生成会消耗你的额度';
    if (isByokApi && healthInfo.realApiAttemptLimitEnabled && healthInfo.remainingRealApiAttempts === 0) {
      return '本地真实 API 测试次数已用完（项目保护限制，不代表 MiniMax 官方额度）';
    }
    if (healthInfo.backend === 'cli') return 'MMX CLI 模式使用服务器登录状态，不读取页面 Key';
    if (healthInfo.backend === 'api' && !healthInfo.byokEnabled) return 'MiniMax API Adapter 实验中，建议使用 MMX CLI';
    if (healthInfo.backend === 'mock') return '当前为本地模拟，不消耗额度';
    return null;
  }

  function stopJobTimer() {
    if (jobTimerRef.current) {
      clearInterval(jobTimerRef.current);
      jobTimerRef.current = null;
    }
  }

  function jobElapsedMessage(elapsed: number): string {
    if (elapsed >= 120) return '生成时间较长，请继续等待或取消…';
    if (elapsed >= 60)  return 'MiniMax 正在生成音乐，通常需要 30–90 秒…';
    if (elapsed >= 30)  return '仍在生成中，请不要重复点击…';
    if (elapsed >= 10)  return '正在调用 MMX CLI，请稍候…';
    return currentJob?.progressMessage ?? '已加入生成队列…';
  }

  function startJobPolling(job: GenerateJob) {
    stopJobTimer();
    setCurrentJob(job);
    setJobElapsed(0);
    setIsGenerating(true);
    jobStartRef.current = Date.now();

    jobTimerRef.current = setInterval(async () => {
      const elapsed = Math.floor((Date.now() - jobStartRef.current) / 1000);
      setJobElapsed(elapsed);

      if (elapsed >= 120) {
        // Don't stop, just update message
      }

      // Poll server for job status
      const fresh = await getJob(job.id);
      if (!fresh) return; // still polling

      setCurrentJob(fresh);

      if (fresh.status === 'succeeded') {
        stopJobTimer();
        if (fresh.track) {
          const display = serverTrackToDisplay(fresh.track);
          setCurrentTrack(display);
          setRecentTracks(prev => [display, ...prev].slice(0, 3));
          setGenerationSource(fresh.track.generationSource as 'mock' | 'minimax' | 'mmx-cli' ?? null);
        }
        setIsGenerating(false);
        setCurrentJob(null);
        return;
      }

      if (fresh.status === 'failed') {
        stopJobTimer();
        const msg = fresh.error?.message ?? '生成失败，请稍后重试';
        setGenError(msg);
        setIsGenerating(false);
        setCurrentJob(null);
        return;
      }

      if (fresh.status === 'cancelled') {
        stopJobTimer();
        setGenError('已取消生成');
        setIsGenerating(false);
        setCurrentJob(null);
        return;
      }

      // queued / running — keep polling
    }, 2000);
  }

  useEffect(() => {
    getHealth().then(h => {
      setHealthInfo({
        backend: h.backend,
        realGenerationEnabled: h.realGenerationEnabled,
        mockGenerationEnabled: h.mockGenerationEnabled,
        previewAccessEnabled: h.previewAccessEnabled,
        byokEnabled: h.byokEnabled,
        realApiAttemptLimitEnabled: h.realApiAttemptLimitEnabled,
        realApiDailyAttemptLimit: h.realApiDailyAttemptLimit,
        remainingRealApiAttempts: h.remainingRealApiAttempts,
        dailyQuotaEnabled: h.dailyQuotaEnabled,
        dailyGenerationUsed: h.dailyGenerationUsed,
        remainingDailyGenerations: h.remainingDailyGenerations,
      });
    });
  }, []);

  // Hydrate latest playable track into player on mount (cold start)
  useEffect(() => {
    const hydrateLatestTrack = async () => {
      // Don't overwrite if a generation is in progress
      const health = await getHealth().catch(() => null);
      if (health?.realGenerationEnabled && health?.remainingDailyGenerations !== undefined) {
        // Generation is active — let polling handle player handoff
        // Only hydrate if no active generation (queued/running)
      }

      // Try listTracks first — prefer the newest track with audioUrl
      try {
        const result = await listTracks();
        const playableTracks = result.tracks.filter(
          (t: TrackLike) => t.audioUrl || t.downloadUrl
        );
        if (playableTracks.length > 0) {
          const latest = playableTracks[0]; // already sorted newest-first by API
          const display = {
            id: latest.id,
            title: latest.title || '最近生成的音乐',
            mode: latest.mode || 'auto',
            durationText: latest.durationText,
            audioUrl: latest.audioUrl || `/api/tracks/${latest.id}/audio`,
            downloadUrl: latest.downloadUrl || `/api/tracks/${latest.id}/download`,
          };
          setCurrentTrack(display);
          return;
        }
      } catch (_) {
        // Fall through to jobs fallback
      }

      // Fallback: find latest succeeded job with a track
      try {
        const jobsResult = await listJobsFiltered({ limit: 5, sort: 'newest' });
        const succeededWithTrack = jobsResult.jobs.filter(
          (j: GenerateJob) => j.status === 'succeeded' && j.track?.audioUrl
        );
        if (succeededWithTrack.length > 0) {
          const job = succeededWithTrack[0];
          const track = job.track!;
          const display = {
            id: track.id,
            title: track.title || '最近生成的音乐',
            mode: track.mode || 'auto',
            durationText: track.durationText,
            audioUrl: track.audioUrl || `/api/tracks/${track.id}/audio`,
            downloadUrl: track.downloadUrl || `/api/tracks/${track.id}/download`,
          };
          setCurrentTrack(display);
        }
      } catch (_) {
        // No playable track found — player stays empty
      }
    };

    hydrateLatestTrack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const m = resolveMode();
    if (m !== activeMode) setActiveMode(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleModeChange = (mode: UIMode) => {
    setActiveMode(mode);
    setGenError(null);

    const map: Record<UIMode, string> = {
      'pure-music': 'instrumental',
      'auto-song': 'auto',
      'lyric-song': 'lyrics',
      'cover-url': 'cover-url',
      'cover-file': 'cover-file',
    };
    window.history.replaceState(null, '', `#${map[mode]}`);
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setGenError('参考音频最大 50MB');
      return;
    }
    setCoverFile(file);
    setCoverFileName(file.name);
    setCoverFileSize(file.size);
    setCoverFileMime(file.type);
    setGenError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      // Strip data URL prefix
      const base64 = result.replace(/^data:[^;]+;base64,/, '');
      setCoverFileBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    setGenError(null);

    // Phase 5B-D-A: Submit guard — immediate lock
    const now = Date.now();
    if (now - lastGenerateClickAt.current < DEBOUNCE_MS) {
      setGenError('生成任务已提交，请不要重复点击。');
      return;
    }
    lastGenerateClickAt.current = now;

    // Phase 5B-D-A: Block if active job is still running
    if (currentJob && (currentJob.status === 'queued' || currentJob.status === 'running')) {
      setGenError('已有生成任务正在进行，请等待完成或取消后再试。');
      return;
    }

    // Phase 5B-D-A: Block if BYOK API mode but no key provided
    if (healthInfo?.byokEnabled && healthInfo?.backend === 'api' && !settings.apiKey) {
      setGenError('请先在设置中填写你的 MiniMax Token Plan Key，BYOK 模式需要用户提供自己的 Key。');
      return;
    }

    // Phase 5B-D-A: Block if real API quota exhausted
    if (
      healthInfo?.backend === 'api' &&
      healthInfo?.realGenerationEnabled &&
      healthInfo?.realApiAttemptLimitEnabled &&
      (healthInfo?.remainingRealApiAttempts ?? 1) <= 0
    ) {
      setGenError('本地真实 API 测试次数已用完（项目保护限制，不代表 MiniMax 官方额度）。请明天再试，或切换到 MMX CLI 模式。');
      return;
    }

    // Phase 5B-D-A: Block if daily generation quota exhausted (CLI bypasses this)
    // Only applies when dailyQuotaEnabled === true (respects server-side flag)
    if (
      healthInfo?.dailyQuotaEnabled === true &&
      healthInfo?.backend !== 'cli' &&
      healthInfo?.remainingDailyGenerations !== undefined &&
      healthInfo.remainingDailyGenerations <= 0
    ) {
      setGenError('本地每日生成保护次数已用完（项目保护限制，不代表 MiniMax 官方额度）。请明天再试。');
      return;
    }

    const input = buildCoreInput(
      activeMode,
      prompt,
      lyrics,
      stylePrompt,
      coverUrl,
      language,
      coverFileBase64 || undefined,
      coverFileName || undefined,
      coverFileSize || undefined,
      coverFileMime || undefined,
    );

    // Validate with core
    const validation = validateMusicInput(input);
    if (!validation.ok) {
      setGenError(validation.errors.map(e => e.message).join('；'));
      return;
    }
    if (validation.warnings.length > 0) {
      // warnings are informational only — continue to generation
    }

    // Check server availability
    let useApi = false;
    try {
      const health = await getHealth();
      setHealthInfo(health);
      if (health.ok && health.realGenerationEnabled) {
        useApi = true;
      } else if (health.ok && !health.realGenerationEnabled) {
        // safe mock mode, still route through server for job tracking
        useApi = true;
      } else {
        useApi = false;
      }
    } catch {
      useApi = false;
    }

    if (useApi) {
      // API path: submit job and start polling
      const result = await createGenerateJob(input, {
        keyMode: settings.keyMode,
        region: settings.region,
        apiKey: settings.apiKey,
      });

      if (!result.ok || !result.job) {
        const err = result.error;
        if (err?.type === 'generation_access_required') {
          setGenError('请先在设置页输入生成访问码，解锁后即可生成音乐');
        } else if (err?.type === 'rate_limit_exceeded') {
          setGenError('生成请求过于频繁，请稍后再试');
        } else if (err?.type === 'daily_quota_exceeded') {
          setGenError('今日生成额度已用完，请明天再试');
        } else if (err?.type === 'real_api_attempt_limit_exceeded') {
          setGenError('今日真实 API 测试次数已用完，请明天再试');
        } else if (err?.type === 'missing_api_key') {
          setGenError('请先在设置中填写 Key，或选择服务器环境变量模式');
        } else if (err?.type === 'minimax_api') {
          setGenError('MiniMax 返回错误，请检查 Key、区域、额度或内容限制');
        } else {
          setGenError(err?.message ?? '提交生成任务失败，请稍后重试');
        }
        return;
      }

      const job = result.job;

      // Instant success (sync mock / already completed)
      if (job.status === 'succeeded' && job.track) {
        const display = serverTrackToDisplay(job.track);
        setCurrentTrack(display);
        setRecentTracks(prev => [display, ...prev].slice(0, 3));
        setGenerationSource(job.track.generationSource as 'mock' | 'minimax' | 'mmx-cli' ?? null);
        return;
      }

      // Start polling for queued / running jobs
      startJobPolling(job);
      return;
    }

    // Fallback: client-side mock job (no server)
    let job: Job = createMockJob(input);
    let stepIndex = 0;

    const tick = () => {
      stepIndex++;
      if (stepIndex < MOCK_JOB_STEPS.length) {
        job = advanceMockJob(job, MOCK_JOB_STEPS[stepIndex]);
        if (job.status === 'success' && job.track) {
          const display: DisplayTrack = {
            id: job.track.id,
            title: job.track.title,
            mode: job.track.mode,
            durationText: job.track.durationText || '2:31',
          };
          setCurrentTrack(display);
          setRecentTracks(prev => [display, ...prev].slice(0, 3));
        } else {
          setTimeout(tick, 500);
        }
      }
    };
    setIsGenerating(true);
    setTimeout(tick, 500);
  };

  // ── Cancel job ──────────────────────────────────────────────────────────────

  const handleCancel = async () => {
    if (!currentJob) return;
    setIsCancelling(true);
    await cancelJob(currentJob.id);
    // The polling loop will pick up 'cancelled' status
  };

  const handleLyricInsert = (tag: string) => {
    setLyrics(prev => {
      const sep = prev ? '\n\n' : '';
      return prev + sep + tag + '\n';
    });
  };

  const getPlaceholder = () => {
    switch (activeMode) {
      case 'pure-music': return '描述你想要的音乐，如：深夜编程、专注、爵士';
      case 'auto-song': return '输入主题和风格，AI 会自动写词并生成歌曲';
      case 'lyric-song': return '在此输入你的歌词...';
      case 'cover-url': return '描述目标风格，如：Lo-fi jazz，夜晚、萨克斯';
      case 'cover-file': return '上传或描述目标风格，如：Lo-fi jazz，夜晚';
    }
  };

  const getButtonLabel = () => {
    switch (activeMode) {
      case 'pure-music': return '生成纯音乐';
      case 'auto-song': return '生成歌曲';
      case 'lyric-song': return '按歌词生成';
      case 'cover-url': return '生成改编';
      case 'cover-file': return '生成改编';
    }
  };

  const getModeHint = () => {
    switch (activeMode) {
      case 'pure-music': return '无歌词 · 无人声 · 适合 BGM / 配乐';
      case 'auto-song': return '自动写歌词 · 自动生成旋律与人声';
      case 'lyric-song': return '输入歌词 · AI 配曲生成完整歌曲';
      case 'cover-url': return '参考音频改编 · 保持原曲结构，换风格演绎';
      case 'cover-file': return '上传音频文件进行风格改编';
    }
  };

  const getInputLabel = () => {
    switch (activeMode) {
      case 'pure-music': return '音乐描述';
      case 'auto-song': return '歌曲主题';
      case 'lyric-song': return '音乐风格';
      case 'cover-url': return '目标风格';
      case 'cover-file': return '目标风格';
    }
  };

  const getMainInputValue = () => {
    if (activeMode === 'cover-url' || activeMode === 'cover-file') return stylePrompt;
    if (activeMode === 'lyric-song') return '';
    return prompt;
  };

  const handleMainInputChange = (val: string) => {
    if (activeMode === 'cover-url' || activeMode === 'cover-file') setStylePrompt(val);
    else setPrompt(val);
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* ── LEFT: Form ── */}
        <div className={styles.formCol}>

          <div className={styles.header}>
            <h1 className={styles.pageTitle}>今天想创作什么音乐？</h1>
          </div>

          {/* Mode tabs */}
          <div className={styles.modeTabs}>
            {MODES.map(mode => (
              <button
                key={mode}
                className={`${styles.modeTab} ${activeMode === mode ? styles.active : ''}`}
                onClick={() => handleModeChange(mode as UIMode)}
              >
                {UI_MODE_LABELS[mode]}
              </button>
            ))}
          </div>

          {/* Main input label */}
          <label className={styles.inputLabel}>{getInputLabel()}</label>

          {/* Main text input */}
          <textarea
            className={styles.textarea}
            placeholder={getPlaceholder()}
            value={getMainInputValue()}
            onChange={e => handleMainInputChange(e.target.value)}
            rows={3}
          />

          {/* Prompt example chips */}
          <div className={styles.exampleRow}>
            <span className={styles.exampleLabel}>{EXAMPLE_LABELS[activeMode] || '示例灵感'}</span>
            <div className={styles.exampleChips}>
              {PROMPT_EXAMPLES.map(ex => (
                <button
                  key={ex}
                  className={styles.exampleChip}
                  onClick={() => {
                    const current = getMainInputValue();
                    const next = current ? `${current} · ${ex}` : ex;
                    handleMainInputChange(next);
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* auto-song: language selector */}
          {activeMode === 'auto-song' && (
            <div className={styles.langRow}>
              <span className={styles.subLabel}>语言</span>
              <div className={styles.langTabs}>
                {LANG_OPTIONS.map(lang => (
                  <button
                    key={lang}
                    className={`${styles.langTab} ${language === lang ? styles.active : ''}`}
                    onClick={() => setLanguage(lang)}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* lyric-song: lyrics textarea */}
          {activeMode === 'lyric-song' && (
            <>
              <label className={styles.inputLabel}>歌词</label>
              <textarea
                className={styles.textarea}
                placeholder={`[Verse]\n星光落在肩上\n风吹过旧操场\n\n[Chorus]\n不怕黑暗\n因为我们就是光`}
                value={lyrics}
                onChange={e => setLyrics(e.target.value)}
                rows={6}
              />
              <div className={styles.lyricStructRow}>
                {LYRIC_STRUCTURES.map(s => (
                  <button
                    key={s.tag}
                    className={styles.lyricStructBtn}
                    onClick={() => handleLyricInsert(s.tag)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* cover-url: reference audio URL */}
          {activeMode === 'cover-url' && (
            <>
              <label className={styles.inputLabel}>参考音频 URL</label>
              <input
                className={styles.urlInput}
                placeholder="粘贴音频 URL，如 https://..."
                value={coverUrl}
                onChange={e => setCoverUrl(e.target.value)}
              />
              <p className={styles.uploadHint}>参考音频建议 6 秒–6 分钟，最大 50MB</p>
            </>
          )}

          {/* cover-file: file upload */}
          {activeMode === 'cover-file' && (
            <>
              <label className={styles.inputLabel}>上传参考音频</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/mp3,audio/mpeg,audio/wav,audio/flac,audio/aac"
                className={styles.fileInput}
                onChange={handleFileChange}
              />
              <div
                className={styles.uploadArea}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') fileInputRef.current?.click(); }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span>{coverFile ? coverFileName : '点击上传参考音频文件'}</span>
                {coverFile && (
                  <span className={styles.fileSize}>
                    {(coverFile.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                )}
              </div>
              <p className={styles.uploadHint}>支持 MP3、WAV、FLAC、AAC，最大 50MB</p>
            </>
          )}

          {/* Style tags */}
          <div className={styles.tagsSection}>
            <div className={styles.tagList}>
              {VISIBLE_TAGS.map(tag => (
                <button
                  key={tag}
                  className={`${styles.tag} ${selectedTags.includes(tag) ? styles.selected : ''}`}
                  onClick={() => handleTagToggle(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced toggle */}
          <button
            className={styles.advancedBtn}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '收起高级设置' : '高级设置'}
          </button>

          {showAdvanced && (
            <div className={styles.advancedNote}>
              模型：music-2.6 · 输出：MP3 · 音质：44.1kHz / 256kbps
            </div>
          )}

          {/* Phase 5A: BYOK runtime mode hint */}
          {getRuntimeModeHint() && (
            <div className={styles.apiHint}>{getRuntimeModeHint()}</div>
          )}

          {/* Validation / error */}
          {genError && (
            <div className={styles.errorBox}>{genError}</div>
          )}

          {/* Phase API-Debug-C: Submit disabled reason diagnostic */}
          {healthInfo?.backend === 'api' && healthInfo?.realGenerationEnabled && (
            <div className={styles.realApiWarning}>
              提交状态：{
                healthInfo.byokEnabled && !settings.apiKey ? (
                  <>❌ 请先在设置中输入 BYOK Key</>
                ) : isGenerating || (currentJob && (currentJob.status === 'queued' || currentJob.status === 'running')) ? (
                  <>🔄 正在生成中，请勿重复提交</>
                ) : (healthInfo.backend === 'api' && healthInfo.realApiAttemptLimitEnabled && (healthInfo.remainingRealApiAttempts ?? 1) <= 0) ? (
                  <>❌ 真实 API 测试次数已用完</>
                ) : (healthInfo.dailyQuotaEnabled === true && healthInfo.remainingDailyGenerations !== undefined && healthInfo.remainingDailyGenerations <= 0) ? (
                  <>❌ 本地每日生成保护次数已用完</>
                ) : (
                  <>✅ 可点击（下一步将消耗 1 次真实 API attempt）</>
                )
              }
            </div>
          )}

          {/* Generate button — Phase 5B-D-A: full submit guard */}
          <button
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={
              // Already generating / polling
              isGenerating ||
              // Active job still running
              (currentJob && (currentJob.status === 'queued' || currentJob.status === 'running')) ||
              // BYOK API mode but no key
              (healthInfo?.byokEnabled && healthInfo?.backend === 'api' && !settings.apiKey) ||
              // Real API attempt quota exhausted — only applies to API backend (CLI has no such guard)
              (healthInfo?.backend === 'api' &&
                healthInfo?.realApiAttemptLimitEnabled &&
                (healthInfo?.remainingRealApiAttempts ?? 1) <= 0) ||
              // Daily generation quota exhausted — only applies when dailyQuotaEnabled === true
              (healthInfo?.dailyQuotaEnabled === true &&
                healthInfo?.backend !== 'cli' &&
                healthInfo?.remainingDailyGenerations !== undefined &&
                healthInfo.remainingDailyGenerations <= 0)
            }
          >
            {currentJob && (currentJob.status === 'queued' || currentJob.status === 'running') ? (
              <>
                <span className={styles.spinner} />
                生成中…
              </>
            ) : isGenerating ? (
              <>
                <span className={styles.spinner} />
                生成中…
              </>
            ) : isCancelling ? (
              <>
                <span className={styles.spinner} />
                正在取消…
              </>
            ) : getButtonLabel()}
          </button>

          {/* Progress UI: job polling */}
          {isGenerating && currentJob && (
            <div className={styles.progressCard}>
              <div className={styles.jobStatusBadge} data-status={currentJob.status}>
                {currentJob.status === 'queued' ? '排队中' :
                 currentJob.status === 'running' ? '生成中' : currentJob.status}
              </div>
              <div className={styles.progressMessage}>
                {jobElapsedMessage(jobElapsed)}
              </div>
              {jobElapsed > 0 && (
                <div className={styles.progressElapsed}>
                  已等待 {formatElapsed(jobElapsed)}
                </div>
              )}
              {(currentJob.status === 'queued' || currentJob.status === 'running') && (
                <button
                  className={styles.cancelBtn}
                  onClick={handleCancel}
                  disabled={isCancelling}
                >
                  {isCancelling ? '取消中…' : '取消生成'}
                </button>
              )}
            </div>
          )}

          {/* Mode hint */}
          <p className={styles.modeHint}>{getModeHint()}</p>

          {/* Mobile: player below form */}
          <div className={styles.mobilePlayer}>
            {currentTrack ? (
              <div className={styles.playerCard}>
                <WaveformPlayer
                  duration={durationTextToSeconds(currentTrack.durationText)}
                  durationText={currentTrack.durationText}
                  audioUrl={currentTrack.audioUrl}
                  modeLabel={UI_MODE_LABELS[currentTrack.mode] || CORE_MODE_LABELS[currentTrack.mode as CoreMode]}
                />
                <div className={styles.playerMeta}>
                  <span className={styles.trackTitle}>{currentTrack.title}</span>
                  <span className={styles.trackTime}>{currentTrack.durationText}</span>
                  {generationSource && (
                    <span className={`${styles.sourceTag} ${generationSource === 'mock' ? styles.mockTag : generationSource === 'mmx-cli' ? styles.cliTag : styles.minimaxTag}`}>
                      {generationSource === 'mock' ? '本地模拟' : generationSource === 'mmx-cli' ? 'MMX CLI' : 'MiniMax 生成'}
                    </span>
                  )}
                </div>
                <div className={styles.playerActions}>
                  {currentTrack.downloadUrl ? (
                    <a
                      href={currentTrack.downloadUrl}
                      download
                      className={styles.actionBtn}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      下载
                    </a>
                  ) : (
                    <span className={`${styles.actionBtn} ${styles.disabled}`}>下载</span>
                  )}
                  <button
                    className={`${styles.actionBtn} ${styles.secondary}`}
                    onClick={() => { setCurrentTrack(null); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="23 4 23 10 17 10"/>
                      <polyline points="1 20 1 14 7 14"/>
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                    </svg>
                    清除
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.emptyPlayer}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9 8l6 4-6 4V8z"/>
                </svg>
                <span>生成音乐后即可试听</span>
              </div>
            )}
          </div>

          {/* Mobile: recent works */}
          <div className={styles.mobileRecent}>
            {recentTracks.length > 0 && (
              <div className={styles.recentCard}>
                <div className={styles.recentHeader}>最近作品</div>
                {recentTracks.map(track => (
                  <div key={track.id} className={styles.recentItem}>
                    <div className={styles.recentLeft}>
                      <span className={styles.recentTitle}>{track.title}</span>
                      <span className={styles.recentMeta}>{track.durationText} · {UI_MODE_LABELS[track.mode] || track.mode}</span>
                    </div>
                    <button className={styles.recentPlay} aria-label="播放">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </button>
                  </div>
                ))}
                <Link to="/library" className={styles.viewAll}>查看全部 →</Link>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Desktop output ── */}
        <div className={styles.outputCol}>
          {/* Status bar */}
          <div className={styles.statusBar}>
            <span className={styles.statusDot} />
            <span className={styles.runtimeMode}>
              {deriveRuntimeModeLabel(healthInfo)}
            </span>
            {healthInfo?.backend === 'api' && healthInfo?.realGenerationEnabled && (
              <span className={styles.statusWarn}>⚠️ 会消耗额度</span>
            )}
            {healthInfo?.backend === 'api' && healthInfo?.realApiAttemptLimitEnabled && healthInfo?.remainingRealApiAttempts !== undefined && (
              <span className={styles.statusWarn}>
                真实测试剩余 {healthInfo.remainingRealApiAttempts} 次
              </span>
            )}
            <span className={styles.statusSep}>·</span>
            <span>{getBackendLabel(healthInfo?.backend)}</span>
            <span className={styles.statusSep}>·</span>
            <span>{settings.region === 'cn' ? '中国区' : 'Global'}</span>
          </div>

          {/* Player */}
          <div className={styles.playerCard}>
            {currentTrack ? (
              <>
                <WaveformPlayer
                  duration={durationTextToSeconds(currentTrack.durationText)}
                  durationText={currentTrack.durationText}
                  audioUrl={currentTrack.audioUrl}
                  modeLabel={UI_MODE_LABELS[currentTrack.mode] || CORE_MODE_LABELS[currentTrack.mode as CoreMode]}
                />
                <div className={styles.playerMeta}>
                  <span className={styles.trackTitle}>{currentTrack.title}</span>
                  <span className={styles.trackTime}>{currentTrack.durationText}</span>
                  {generationSource && (
                    <span className={`${styles.sourceTag} ${generationSource === 'mock' ? styles.mockTag : generationSource === 'mmx-cli' ? styles.cliTag : styles.minimaxTag}`}>
                      {generationSource === 'mock' ? '本地模拟' : generationSource === 'mmx-cli' ? 'MMX CLI' : 'MiniMax 生成'}
                    </span>
                  )}
                </div>
                <div className={styles.playerActions}>
                  {currentTrack.downloadUrl ? (
                    <a
                      href={currentTrack.downloadUrl}
                      download
                      className={styles.actionBtn}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      下载 MP3
                    </a>
                  ) : (
                    <span className={`${styles.actionBtn} ${styles.disabled}`}>下载 MP3</span>
                  )}
                  <button
                    className={`${styles.actionBtn} ${styles.secondary}`}
                    onClick={() => { setCurrentTrack(null); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="23 4 23 10 17 10"/>
                      <polyline points="1 20 1 14 7 14"/>
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                    </svg>
                    清除
                  </button>
                  <Link to="/jobs" className={`${styles.actionBtn} ${styles.secondary}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 6v6l4 2"/>
                    </svg>
                    任务历史
                  </Link>
                </div>
              </>
            ) : (
              <div className={styles.emptyPlayer}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9 8l6 4-6 4V8z"/>
                </svg>
                <span>生成音乐后即可试听</span>
              </div>
            )}
          </div>

          {/* Recent */}
          {recentTracks.length > 0 && (
            <div className={styles.recentCard}>
              <div className={styles.recentHeader}>最近作品</div>
              {recentTracks.map(track => (
                <div key={track.id} className={styles.recentItem}>
                  <div className={styles.recentLeft}>
                    <span className={styles.recentTitle}>{track.title}</span>
                    <span className={styles.recentMeta}>{track.durationText} · {UI_MODE_LABELS[track.mode] || track.mode}</span>
                  </div>
                  <button className={styles.recentPlay} aria-label="播放">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </button>
                </div>
              ))}
              <Link to="/library" className={styles.viewAll}>查看全部 →</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}