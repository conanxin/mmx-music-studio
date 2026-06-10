import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import styles from './Library.module.css';
import { MOCK_TASKS, formatDuration, formatRelativeTime, MODE_LABELS } from '../../mock/data';
import { listTracks, deleteTrack } from '../../lib/serverApi';
import type { TrackLike } from '../../lib/serverApi';
import type { GlobalPlayerTrack } from '../../lib/globalPlayerTrack';
import {
  loadTrackAnnotations,
  saveTrackAnnotations,
  setTrackAnnotation as setTrackAnnotationHelper,
  normalizeTags,
  getAllAnnotationTags,
  recordAnnotationHistory,
  getTrackAnnotationHistory,
  loadAnnotationHistory,
  type TrackAnnotationsMap,
  type AnnotationHistoryEntry,
  type AnnotationHistoryAction,
} from '../../lib/trackAnnotations';
import {
  buildLibraryBackup,
  validateLibraryBackup,
  applyLibraryBackup,
  buildCollectionMarkdown,
  buildCollectionJson,
  makeBackupFilename,
  makeCollectionFilename,
  FAVORITES_KEY,
  type CollectionTrackExport,
  type CollectionFilters,
  type LibraryLocalBackupV1,
} from '../../lib/libraryBackup';

type FilterSource = 'all' | 'mmx-cli' | 'minimax-api' | 'mock' | 'favorites';
type SmartCollection = 'all' | 'tagged' | 'with-note' | 'recent' | 'cli-generated' | 'api-generated';
type FilterTab = { key: FilterSource; label: string };

const FILTER_TABS: FilterTab[] = [
  { key: 'all', label: '全部' },
  { key: 'mmx-cli', label: 'MMX CLI' },
  { key: 'minimax-api', label: 'MiniMax API' },
  { key: 'mock', label: '示例' },
  { key: 'favorites', label: '收藏' },
];

const SMART_COLLECTIONS: Array<{ key: SmartCollection; label: string; icon: string }> = [
  { key: 'all', label: '全部', icon: '📋' },
  { key: 'tagged', label: '有标签', icon: '🏷️' },
  { key: 'with-note', label: '有备注', icon: '📝' },
  { key: 'recent', label: '最近生成', icon: '🕐' },
  { key: 'cli-generated', label: 'CLI 生成', icon: '💻' },
  { key: 'api-generated', label: 'API 生成', icon: '🔌' },
];

type TrackItem = {
  id: string;
  title: string;
  mode: string;
  prompt?: string;
  lyrics?: string;
  durationText?: string;
  durationMs?: number;
  audioFormat?: string;
  audioMimeType?: string;
  createdAt: Date;
  audioUrl?: string;
  downloadUrl?: string;
  generationSource?: 'mock' | 'minimax' | 'mmx-cli';
  isMock?: boolean;
};

function serverTrackToItem(t: TrackLike): TrackItem {
  return {
    id: t.id,
    title: t.title,
    mode: t.mode,
    prompt: t.prompt,
    lyrics: t.lyrics,
    durationText: t.durationText,
    durationMs: t.durationMs,
    audioFormat: t.audioFormat,
    audioMimeType: t.audioMimeType,
    createdAt: new Date(t.createdAt || Date.now()),
    audioUrl: t.audioUrl,
    downloadUrl: t.downloadUrl,
    generationSource: t.generationSource,
    isMock: false,
  };
}

function mockTaskToItem(t: typeof MOCK_TASKS[0]): TrackItem {
  return {
    id: t.id,
    title: t.title,
    mode: t.mode,
    durationText: t.duration ? formatDuration(t.duration) : undefined,
    createdAt: t.createdAt,
    isMock: true,
  };
}

function readFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function writeFavorites(favs: Set<string>): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs]));
  } catch {
    // storage quota exceeded or private mode — ignore
  }
}

function sourceLabel(s?: string, isMock?: boolean): string {
  if (isMock) return '示例';
  if (s === 'mmx-cli') return 'MMX CLI';
  if (s === 'minimax') return 'MiniMax API';
  return s || '—';
}

function useCopyToast() {
  const [toast, setToast] = useState<string | null>(null);
  const showCopy = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);
  return { toast, showCopy };
}

export default function Library({
  currentPlayingTrack,
  onSetPlayingTrack,
  onPlayQueue,
  onAddToQueue,
}: {
  currentPlayingTrack: GlobalPlayerTrack | null
  onSetPlayingTrack: (track: GlobalPlayerTrack | null) => void
  onPlayQueue?: (tracks: GlobalPlayerTrack[], startIndex?: number, sourceLabel?: string) => void
  onAddToQueue?: (track: GlobalPlayerTrack) => void
}) {
  // currentPlayingTrack is received from App-level state for future highlight support
  void currentPlayingTrack
  const [searchParams, setSearchParams] = useSearchParams();
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiConnected, setApiConnected] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [detailTrack, setDetailTrack] = useState<TrackItem | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => readFavorites());
  // Phase Product Polish-K: Track annotations (localStorage)
  const [annotations, setAnnotations] = useState(() => loadTrackAnnotations());
  // Phase Product Polish-L: Batch selection + batch tag input
  const [batchMode, setBatchMode] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [batchTagInput, setBatchTagInput] = useState('');
  // Phase Product Polish-M: Batch remove tag input
  const [batchRemoveTagInput, setBatchRemoveTagInput] = useState('');
  // Phase Product Polish-N: batch note editing state
  const [batchNoteInput, setBatchNoteInput] = useState('');
  const [batchNoteMode, setBatchNoteMode] = useState<'overwrite' | 'append'>('overwrite');
  // Phase Product Polish-N: library-wide history panel state
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'tag' | 'note' | 'import'>('all');
  const [historyRefreshTick, setHistoryRefreshTick] = useState(0);
  // Phase Product Polish-N: per-track timeline expand/collapse
  const [trackHistoryExpanded, setTrackHistoryExpanded] = useState(false);
  // Phase Product Polish-L: Backup file input ref
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast, showCopy } = useCopyToast();

  // Phase Product Polish-M: URL → filter state on first load
  // Allowed sources: all | mmx-cli | minimax-api | mock | favorites
  const allowedSources: FilterSource[] = ['all', 'mmx-cli', 'minimax-api', 'mock', 'favorites'];
  const allowedSmart: SmartCollection[] = ['all', 'tagged', 'with-note', 'recent', 'cli-generated', 'api-generated'];
  const initialQ = searchParams.get('q') || '';
  const initialSource = searchParams.get('source') as FilterSource | null;
  const initialCollection = searchParams.get('collection') as SmartCollection | null;
  const initialTag = searchParams.get('tag') || null;
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const [filterSource, setFilterSource] = useState<FilterSource>(
    initialSource && allowedSources.includes(initialSource) ? initialSource : 'all'
  );
  const [smartCollection, setSmartCollection] = useState<SmartCollection>(
    initialCollection && allowedSmart.includes(initialCollection) ? initialCollection : 'all'
  );
  const [tagFilter, setTagFilter] = useState<string | null>(
    initialTag ? initialTag.slice(0, 24) : null
  );

  // Phase Product Polish-M: Reflect filter state in URL via replaceState
  // No token/key/note/prompt/selectedTrackIds in URL — only safe filter params
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const next = new URLSearchParams();
    if (searchQuery.trim()) next.set('q', searchQuery.trim().slice(0, 64));
    if (filterSource !== 'all') next.set('source', filterSource);
    if (smartCollection !== 'all') next.set('collection', smartCollection);
    if (tagFilter) next.set('tag', tagFilter);
    // Preserve ?track=<id> for share links to drawer
    const trackParam = url.searchParams.get('track');
    if (trackParam) next.set('track', trackParam);
    const newQs = next.toString();
    const target = url.pathname + (newQs ? `?${newQs}` : '') + url.hash;
    if (target !== url.pathname + url.search + url.hash) {
      window.history.replaceState(null, '', target);
    }
  }, [searchQuery, filterSource, smartCollection, tagFilter]);

  const loadTracks = async () => {
    setLoading(true);
    try {
      const result = await listTracks();
      if (result.ok && result.tracks.length > 0) {
        setTracks(result.tracks.map(serverTrackToItem));
        setApiConnected(true);
        setShowHint(false);
      } else {
        setTracks(MOCK_TASKS.map(mockTaskToItem));
        setApiConnected(true);
        setShowHint(true);
      }
    } catch {
      setTracks(MOCK_TASKS.map(mockTaskToItem));
      setApiConnected(false);
      setShowHint(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTracks();
  }, []);

  // Auto-open detail drawer when ?track=<id> is in the URL
  useEffect(() => {
    const trackId = searchParams.get('track');
    if (!trackId) return;
    if (tracks.length === 0) return;
    const found = tracks.find(t => t.id === trackId);
    if (found) {
      setDetailTrack(found);
      setSearchParams({}, { replace: true });
    }
  }, [tracks, searchParams, setSearchParams]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      writeFavorites(next);
      return next;
    });
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => showCopy('已复制 ID')).catch(() => showCopy('复制失败'));
  };

  const handleCopyPrompt = (prompt?: string) => {
    if (!prompt) { showCopy('无提示词'); return; }
    navigator.clipboard.writeText(prompt).then(() => showCopy('已复制提示词')).catch(() => showCopy('复制失败'));
  };

  const handleCopyShareLink = (track: TrackItem) => {
    const shareUrl = `${window.location.origin}/library?track=${encodeURIComponent(track.id)}`;
    navigator.clipboard.writeText(shareUrl).then(() => showCopy('分享链接已复制')).catch(() => showCopy('复制失败'));
  };

// Phase Product Polish-K: Annotation editor component
function AnnotationEditor({
  trackId,
  annotations,
  onChange,
}: {
  trackId: string;
  annotations: TrackAnnotationsMap;
  onChange: (
    updated: TrackAnnotationsMap,
    meta?: { prev: { tags: string[]; note: string } | null; next: { tags: string[]; note: string } }
  ) => void;
}) {
  const ann = annotations[trackId] ?? { trackId, tags: [], note: '', updatedAt: '' };
  const [tags, setTags] = useState<string[]>(ann.tags);
  const [note, setNote] = useState(ann.note);
  const [tagInput, setTagInput] = useState('');

  const MAX_TAGS = 12;
  const MAX_NOTE = 500;

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (!t || tags.length >= MAX_TAGS) return;
    const next = normalizeTags([...tags, t]);
    setTags(next);
    setTagInput('');
  };

  const handleRemoveTag = (remove: string) => {
    setTags(tags.filter(tag => tag !== remove));
  };

  const handleSave = () => {
    // Phase Product Polish-M: capture prev/next to enable history recording
    const prev = { tags: ann.tags, note: ann.note };
    const updated = setTrackAnnotationHelper(annotations, trackId, tags, note);
    onChange(updated, { prev, next: { tags, note } });
  };

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
        标签与备注
      </div>

      {/* Tags */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {tags.map(tag => (
            <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--color-primary)', color: '#fff', borderRadius: 20, padding: '2px 8px 2px 10px', fontSize: 12 }}>
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}
                aria-label={`删除标签 ${tag}`}
              >×</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
            placeholder={tags.length >= MAX_TAGS ? '已达上限 12 个标签' : '添加标签，例如 Lo-fi、播客、睡前'}
            style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 13, outline: 'none' }}
            disabled={tags.length >= MAX_TAGS}
          />
          <button
            onClick={handleAddTag}
            disabled={!tagInput.trim() || tags.length >= MAX_TAGS}
            style={{ padding: '6px 12px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: tags.length >= MAX_TAGS ? 'not-allowed' : 'pointer', opacity: tags.length >= MAX_TAGS ? 0.5 : 1 }}
          >
            添加
          </button>
        </div>
        {tags.length >= MAX_TAGS && (
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>最多 12 个标签</div>
        )}
      </div>

      {/* Note */}
      <div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value.slice(0, MAX_NOTE))}
          placeholder="记录这首音乐适合什么场景、是否需要重做、可用于哪个项目…"
          rows={3}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
          {note.length} / {MAX_NOTE}
        </div>
      </div>

      <button
        onClick={handleSave}
        style={{ marginTop: 10, padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', width: '100%' }}
      >
        保存标签与备注
      </button>
    </div>
  );
}

  const handleExportTrackInfo = (track: TrackItem) => {
    const source = track.isMock ? '示例' : (track.generationSource === 'mmx-cli' ? 'MMX CLI' : track.generationSource === 'minimax' ? 'MiniMax API' : track.generationSource || '—');
    const createdAt = track.createdAt ? new Date(track.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '—';
    const downloadLine = track.downloadUrl ? `- 下载：${track.downloadUrl}` : '';
    const promptLine = track.prompt ? `\n\n## Prompt\n\n${track.prompt}` : '\n\n## Prompt\n\n未记录 prompt';
    // Phase Product Polish-K: include tags + notes in export
    const ann = annotations[track.id];
    const tagsLine = ann && ann.tags.length > 0 ? `\n\n## Tags\n\n${ann.tags.map(t => `- ${t}`).join('\n')}` : '\n\n## Tags\n\nnone';
    const noteLine = ann && ann.note.trim() ? `\n\n## Notes\n\n${ann.note}` : '\n\n## Notes\n\nnone';
    const md = `# ${track.title || '无标题'}\n\n- 来源：${source}\n- 时长：${track.durationText || '—'}\n- 创建时间：${createdAt}\n- Track ID：${track.id}${downloadLine}${promptLine}${tagsLine}${noteLine}
`;
    navigator.clipboard.writeText(md).then(() => showCopy('作品信息已复制')).catch(() => showCopy('复制失败'));
  };

  // Phase Product Polish-L: Build export payload for one track
  const trackToExport = (track: TrackItem): CollectionTrackExport => {
    const ann = annotations[track.id];
    const source = sourceLabel(track.generationSource, track.isMock);
    const shareUrl = `${window.location.origin}/library?track=${encodeURIComponent(track.id)}`;
    return {
      id: track.id,
      title: track.title,
      prompt: track.prompt,
      lyrics: track.lyrics,
      mode: track.mode,
      source,
      durationMs: track.durationMs,
      createdAt: track.createdAt ? new Date(track.createdAt).toISOString() : '',
      shareUrl,
      tags: ann ? ann.tags : [],
      note: ann ? ann.note : '',
    };
  };

  // Phase Product Polish-L: Smart collection label for export buttons
  const smartCollectionLabel = useMemo(() => {
    if (smartCollection === 'all') return '';
    if (smartCollection === 'tagged') return '有标签';
    if (smartCollection === 'with-note') return '有备注';
    if (smartCollection === 'recent') return '最近生成';
    if (smartCollection === 'cli-generated') return 'CLI 生成';
    if (smartCollection === 'api-generated') return 'API 生成';
    return '';
  }, [smartCollection]);

  const collectionLabel = useMemo(() => {
    if (smartCollectionLabel) return `智能集合：${smartCollectionLabel}`;
    if (tagFilter) return `标签筛选：${tagFilter}`;
    if (searchQuery) return `搜索：${searchQuery}`;
    if (filterSource === 'all') return '全部作品';
    if (filterSource === 'favorites') return '收藏列表';
    if (filterSource === 'mmx-cli') return 'MMX CLI 列表';
    if (filterSource === 'minimax-api') return 'MiniMax API 列表';
    if (filterSource === 'mock') return '示例列表';
    return '当前列表';
  }, [smartCollectionLabel, tagFilter, searchQuery, filterSource]);

  // Phase Product Polish-L: trigger browser download from a string blob
  const triggerDownload = (filename: string, mime: string, content: string) => {
    try {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      showCopy('下载失败');
    }
  };

  // Phase Product Polish-M: Build current collection URL (no token/key/track selection)
  const buildCollectionUrl = (): string => {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    const next = new URLSearchParams();
    if (searchQuery.trim()) next.set('q', searchQuery.trim().slice(0, 64));
    if (filterSource !== 'all') next.set('source', filterSource);
    if (smartCollection !== 'all') next.set('collection', smartCollection);
    if (tagFilter) next.set('tag', tagFilter);
    // Strip ?track=<id> — share link should open the collection, not a drawer
    return url.origin + url.pathname + (next.toString() ? `?${next.toString()}` : '');
  };

  const buildFiltersForExport = (): CollectionFilters => ({
    query: searchQuery.trim() || undefined,
    source: filterSource !== 'all' ? filterSource : undefined,
    smartCollection: smartCollection !== 'all' ? smartCollection : undefined,
    tag: tagFilter || undefined,
  });

  const handleExportCollectionMarkdown = (tracks: TrackItem[], label: string) => {
    if (tracks.length === 0) {
      showCopy('当前集合为空');
      return;
    }
    const md = buildCollectionMarkdown(label, tracks.map(trackToExport), {
      collectionUrl: buildCollectionUrl(),
      filters: buildFiltersForExport(),
    });
    triggerDownload(makeCollectionFilename('md'), 'text/markdown;charset=utf-8', md);
    showCopy(`已导出 ${tracks.length} 首为 Markdown`);
  };

  const handleExportCollectionJson = (tracks: TrackItem[], label: string) => {
    if (tracks.length === 0) {
      showCopy('当前集合为空');
      return;
    }
    const json = buildCollectionJson(label, tracks.map(trackToExport), {
      collectionUrl: buildCollectionUrl(),
      filters: buildFiltersForExport(),
    });
    triggerDownload(makeCollectionFilename('json'), 'application/json;charset=utf-8', json);
    showCopy(`已导出 ${tracks.length} 首为 JSON`);
  };

  // Phase Product Polish-M: Copy current collection link to clipboard
  const handleCopyCollectionLink = () => {
    const link = buildCollectionUrl();
    if (!link) {
      showCopy('复制失败');
      return;
    }
    navigator.clipboard.writeText(link)
      .then(() => showCopy('集合链接已复制'))
      .catch(() => showCopy('复制失败'));
  };

  // Phase Product Polish-L: Batch selection handlers
  const toggleTrackSelected = (id: string) => {
    setSelectedTrackIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedTrackIds(new Set(filteredTracks.map(t => t.id)));
  };

  const clearSelection = () => {
    setSelectedTrackIds(new Set());
  };

  const handleBatchAddTag = () => {
    if (selectedTrackIds.size === 0) {
      showCopy('请先选择作品');
      return;
    }
    const tag = batchTagInput.trim();
    if (!tag) {
      showCopy('请输入标签');
      return;
    }
    let updated = annotations;
    for (const trackId of selectedTrackIds) {
      const ann = updated[trackId] ?? { trackId, tags: [], note: '', updatedAt: '' };
      const merged = normalizeTags([...ann.tags, tag]);
      updated = setTrackAnnotationHelper(updated, trackId, merged, ann.note);
    }
    setAnnotations(updated);
    saveTrackAnnotations(updated);
    setBatchTagInput('');
    // Phase Product Polish-M: record history
    recordAnnotationHistory({
      action: 'batch_tag_added',
      trackIds: Array.from(selectedTrackIds),
      label: `批量添加「${tag}」`,
      tags: [tag],
    });
    setHistoryRefreshTick(t => t + 1);
    showCopy(`已为 ${selectedTrackIds.size} 首作品添加标签`);
  };

  // Phase Product Polish-M: Batch remove tag from selected tracks
  const handleBatchRemoveTag = () => {
    if (selectedTrackIds.size === 0) {
      showCopy('请先选择作品');
      return;
    }
    const tag = batchRemoveTagInput.trim();
    if (!tag) {
      showCopy('请输入要删除的标签');
      return;
    }
    const lower = tag.toLowerCase();
    let updated = annotations;
    let touchedCount = 0;
    for (const trackId of selectedTrackIds) {
      const ann = updated[trackId];
      if (!ann) continue;
      const filtered = ann.tags.filter(t => t.toLowerCase() !== lower);
      if (filtered.length === ann.tags.length) continue; // not present
      updated = setTrackAnnotationHelper(updated, trackId, filtered, ann.note);
      touchedCount += 1;
    }
    if (touchedCount === 0) {
      showCopy('所选作品中没有该标签');
      return;
    }
    setAnnotations(updated);
    saveTrackAnnotations(updated);
    setBatchRemoveTagInput('');
    // Phase Product Polish-M: record history
    recordAnnotationHistory({
      action: 'batch_tag_removed',
      trackIds: Array.from(selectedTrackIds),
      label: `批量删除「${tag}」（${touchedCount}/${selectedTrackIds.size} 首）`,
      tags: [tag],
    });
    setHistoryRefreshTick(t => t + 1);
    showCopy(`已从 ${touchedCount} 首作品移除标签`);
  };

  // Phase Product Polish-N: Batch note edit (overwrite or append)
  const handleBatchNoteEdit = () => {
    if (selectedTrackIds.size === 0) {
      showCopy('请先选择作品');
      return;
    }
    const note = batchNoteInput.trim();
    if (!note) {
      showCopy('请输入备注');
      return;
    }
    let updated = annotations;
    let touchedCount = 0;
    const mode = batchNoteMode;
    for (const trackId of selectedTrackIds) {
      const ann = updated[trackId] ?? { trackId, tags: [], note: '', updatedAt: '' };
      const nextNote = mode === 'append' && ann.note
        ? `${ann.note}

${note}`.slice(0, 500)
        : note.slice(0, 500);
      if (nextNote === ann.note) continue;
      updated = setTrackAnnotationHelper(updated, trackId, ann.tags, nextNote);
      touchedCount += 1;
    }
    if (touchedCount === 0) {
      showCopy('所选作品的备注没有变化');
      return;
    }
    setAnnotations(updated);
    saveTrackAnnotations(updated);
    // record one batch history entry referencing all selected tracks
    recordAnnotationHistory({
      action: 'note_updated',
      trackIds: Array.from(selectedTrackIds),
      label: `批量${mode === 'append' ? '追加' : '更新'}备注（${touchedCount}/${selectedTrackIds.size} 首）`,
      notePreview: note.slice(0, 80),
    });
    setBatchNoteInput('');
    setHistoryRefreshTick(t => t + 1);
    showCopy(`已为 ${touchedCount} 首作品更新备注`);
  };

  const handleExportSelectedMarkdown = () => {
    const tracks = filteredTracks.filter(t => selectedTrackIds.has(t.id));
    handleExportCollectionMarkdown(tracks, `所选作品（${tracks.length} 首）`);
  };

  const handleExportSelectedJson = () => {
    const tracks = filteredTracks.filter(t => selectedTrackIds.has(t.id));
    handleExportCollectionJson(tracks, `所选作品（${tracks.length} 首）`);
  };

  // Phase Product Polish-L: Local backup export
  const handleExportBackup = () => {
    try {
      const payload = buildLibraryBackup();
      const json = JSON.stringify(payload, null, 2);
      triggerDownload(makeBackupFilename(), 'application/json;charset=utf-8', json);
      showCopy(`已导出本地资料（${payload.meta.annotationCount} 条标注）`);
    } catch {
      showCopy('导出失败');
    }
  };

  // Phase Product Polish-L: Local backup import (file input)
  const handleBackupFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = validateLibraryBackup(parsed);
      if (!result.ok) {
        showCopy(`导入失败：${result.error}`);
        return;
      }
      // Mode buttons handle the actual apply; here we just stash the file and prompt via toast.
      // The two separate buttons (合并 / 覆盖) below read the cached file from ref.
      pendingBackupRef.current = result.payload;
      showCopy('备份文件已读取，请选择导入方式');
    } catch {
      showCopy('导入失败：文件格式不正确');
    } finally {
      if (backupFileInputRef.current) backupFileInputRef.current.value = '';
    }
  };

  // Stash the most-recent validated backup payload until user picks a mode
  const pendingBackupRef = useRef<LibraryLocalBackupV1 | null>(null);

  const handleApplyImport = (mode: 'merge' | 'replace') => {
    const payload = pendingBackupRef.current;
    if (!payload) {
      showCopy('请先选择备份文件');
      return;
    }
    const result = applyLibraryBackup(payload, mode);
    pendingBackupRef.current = null;
    // Refresh local state from localStorage
    setAnnotations(loadTrackAnnotations());
    try {
      const rawFavs = localStorage.getItem(FAVORITES_KEY);
      if (rawFavs) setFavorites(new Set(JSON.parse(rawFavs) as string[]));
    } catch { /* ignore */ }
    // Phase Product Polish-M: record the import event in history
    const annCount = Object.keys(payload.data.annotations || {}).length;
    const histCount = Array.isArray(payload.data.annotationHistory)
      ? payload.data.annotationHistory.length
      : 0;
    recordAnnotationHistory({
      action: mode === 'merge' ? 'backup_import_merge' : 'backup_import_replace',
      label: `${mode === 'merge' ? '合并' : '覆盖'}导入本地资料（${annCount} 条标注，${histCount} 条历史）`,
    });
    showCopy(`本地资料已导入（${result.annotationsMerged} 条标注）`);
  };

  // Phase Product Polish-G: Convert TrackItem → GlobalPlayerTrack
function itemToGlobal(track: TrackItem): GlobalPlayerTrack {
  return {
    id: track.id,
    title: track.title,
    audioUrl: track.audioUrl ?? '',
    downloadUrl: track.downloadUrl,
    durationText: track.durationText,
    generationSource: track.generationSource,
    mode: track.mode,
  };
}

const handlePlay = (track: TrackItem) => {
  // Phase Product Polish-G + H: delegate to global player; play full filtered list as queue
  if (track.audioUrl) {
    if (onPlayQueue) {
      const queue = filteredTracks.map(itemToGlobal)
      const idx = filteredTracks.findIndex(t => t.id === track.id)
      const label = filterSource === 'all' ? '全部作品'
        : filterSource === 'favorites' ? '收藏列表'
        : filterSource === 'mmx-cli' ? 'MMX CLI 列表'
        : filterSource === 'minimax-api' ? 'MiniMax API 列表'
        : filterSource === 'mock' ? '示例列表'
        : '当前列表'
      onPlayQueue(queue, idx, label)
    } else {
      onSetPlayingTrack(itemToGlobal(track))
    }
  }
};

  const handleDelete = async (track: TrackItem) => {
    if (!apiConnected || track.isMock) return;
    if (!window.confirm(`确定要删除「${track.title}」吗？`)) return;
    setDeletingId(track.id);
    try {
      const result = await deleteTrack(track.id);
      if (result.ok) {
        setTracks(prev => prev.filter(t => t.id !== track.id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  // Phase Product Polish-K: Smart collections + tag filter + annotation search
  const filteredTracks = useMemo(() => {
    return tracks.filter(t => {
      // 1. Source filter (original tabs)
      if (filterSource === 'favorites') {
        if (!favorites.has(t.id)) return false;
      } else if (filterSource === 'mock') {
        if (!t.isMock) return false;
      } else if (filterSource === 'mmx-cli') {
        if (t.generationSource !== 'mmx-cli') return false;
      } else if (filterSource === 'minimax-api') {
        if (t.generationSource !== 'minimax') return false;
      }

      // 2. Smart collection filter
      if (smartCollection === 'tagged') {
        const ann = annotations[t.id];
        if (!ann || ann.tags.length === 0) return false;
      } else if (smartCollection === 'with-note') {
        const ann = annotations[t.id];
        if (!ann || !ann.note.trim()) return false;
      } else if (smartCollection === 'recent') {
        // keep as-is — show all, sorted by recency
      } else if (smartCollection === 'cli-generated') {
        if (t.generationSource !== 'mmx-cli') return false;
      } else if (smartCollection === 'api-generated') {
        if (t.generationSource !== 'minimax') return false;
      }

      // 3. Tag filter
      if (tagFilter) {
        const ann = annotations[t.id];
        if (!ann || !ann.tags.some(tag => tag.toLowerCase() === tagFilter.toLowerCase())) return false;
      }

      // 4. Search filter (including annotation tags + notes)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchPrompt = (t.prompt || '').toLowerCase().includes(q);
        const matchLyrics = (t.lyrics || '').toLowerCase().includes(q);
        const matchSource = sourceLabel(t.generationSource, t.isMock).toLowerCase().includes(q);
        const matchMode = (MODE_LABELS[t.mode as keyof typeof MODE_LABELS] || t.mode).toLowerCase().includes(q);
        // Phase Product Polish-K: also search annotation tags + note
        const ann = annotations[t.id];
        const matchTags = ann ? ann.tags.some(tag => tag.toLowerCase().includes(q)) : false;
        const matchNote = ann ? ann.note.toLowerCase().includes(q) : false;
        if (!matchTitle && !matchPrompt && !matchLyrics && !matchSource && !matchMode && !matchTags && !matchNote) return false;
      }

      // 5. Recent sort — handled in the sort() below
      return true;
    }).sort((a, b) => {
      // Recent: sort descending by createdAt
      if (smartCollection === 'recent') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });
  }, [tracks, filterSource, favorites, smartCollection, tagFilter, searchQuery, annotations]);

  const handleCloseDetail = () => setDetailTrack(null);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>作品库</h1>
          </div>
          <div className={styles.loading}><span className={styles.spinner} />加载中…</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <h1 className={styles.title}>作品库</h1>
            <p className={styles.desc}>
              {filteredTracks.length === tracks.length
                ? `${tracks.length} 首作品`
                : `${filteredTracks.length} / ${tracks.length} 首`}
            </p>
          </div>

          {/* Search */}
          <div className={styles.searchRow}>
            <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className={styles.searchInput}
              placeholder="搜索标题、提示词或来源…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className={styles.searchClear} onClick={() => setSearchQuery('')} aria-label="清除搜索">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>

          {/* Source filter tabs */}
          <div className={styles.filterTabs}>
            {FILTER_TABS.map(f => (
              <button
                key={f.key}
                className={`${styles.filterTab} ${filterSource === f.key ? styles.active : ''}`}
                onClick={() => setFilterSource(f.key)}
              >
                {f.key === 'favorites' && favorites.size > 0 ? (
                  <span className={styles.filterWithBadge}>
                    {f.label}<span className={styles.badge}>{favorites.size}</span>
                  </span>
                ) : f.label}
              </button>
            ))}
          </div>

          {/* Phase Product Polish-K: Smart collections */}
          <div className={styles.smartCollections}>
            <span className={styles.smartLabel}>智能集合</span>
            <div className={styles.smartChips}>
              {SMART_COLLECTIONS.map(sc => {
                const count = sc.key === 'all' ? tracks.length
                  : sc.key === 'tagged' ? Object.values(annotations).filter(a => a.tags.length > 0).length
                  : sc.key === 'with-note' ? Object.values(annotations).filter(a => a.note.trim()).length
                  : sc.key === 'cli-generated' ? tracks.filter(t => t.generationSource === 'mmx-cli').length
                  : sc.key === 'api-generated' ? tracks.filter(t => t.generationSource === 'minimax').length
                  : filteredTracks.length;
                return (
                  <button
                    key={sc.key}
                    className={`${styles.smartChip} ${smartCollection === sc.key ? styles.smartActive : ''}`}
                    onClick={() => { setSmartCollection(sc.key); setTagFilter(null); }}
                  >
                    {sc.icon} {sc.label}
                    {count > 0 && <span className={styles.smartBadge}>{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Phase Product Polish-K: Tag filter chips */}
          {(() => {
            const topTags = getAllAnnotationTags(annotations).slice(0, 12);
            if (topTags.length === 0) return null;
            return (
              <div className={styles.tagFilters}>
                <span className={styles.tagFilterLabel}>标签</span>
                <div className={styles.tagChips}>
                  {topTags.map(({ tag, count }) => (
                    <button
                      key={tag}
                      className={`${styles.tagChip} ${tagFilter === tag ? styles.tagActive : ''}`}
                      onClick={() => setTagFilter(prev => prev === tag ? null : tag)}
                    >
                      {tag}<span className={styles.tagCount}>{count}</span>
                    </button>
                  ))}
                  {tagFilter && (
                    <button className={styles.tagClear} onClick={() => setTagFilter(null)}>
                      清除筛选
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Phase Product Polish-H: Play current filtered list */}
          {filteredTracks.length > 0 && onPlayQueue && (
            <div className={styles.playlistActions}>
              <button
                className={styles.playlistBtn}
                onClick={() => {
                  const label = filterSource === 'all' ? '全部作品'
                    : filterSource === 'favorites' ? '收藏列表'
                    : filterSource === 'mmx-cli' ? 'MMX CLI 列表'
                    : filterSource === 'minimax-api' ? 'MiniMax API 列表'
                    : filterSource === 'mock' ? '示例列表'
                    : '当前列表'
                  const queue = filteredTracks.map(itemToGlobal)
                  onPlayQueue(queue, 0, searchQuery ? `搜索：${searchQuery}` : label)
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                播放当前列表
              </button>
            </div>
          )}

          {/* Phase Product Polish-L: Batch mode toolbar + collection export */}
          <div className={styles.batchToolbar}>
            <button
              className={`${styles.batchToggle} ${batchMode ? styles.batchActive : ''}`}
              onClick={() => {
                setBatchMode(b => !b);
                if (batchMode) clearSelection();
              }}
              aria-pressed={batchMode}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
              </svg>
              {batchMode ? '退出批量管理' : '批量管理'}
            </button>

            {batchMode && (
              <>
                <span className={styles.batchSelected}>已选择 {selectedTrackIds.size} 首</span>
                <button
                  className={styles.batchSelectAll}
                  onClick={selectAllFiltered}
                  disabled={filteredTracks.length === 0}
                >全选当前列表</button>
                <button
                  className={styles.batchClear}
                  onClick={clearSelection}
                  disabled={selectedTrackIds.size === 0}
                >清除选择</button>
                <div className={styles.batchTagRow}>
                  <input
                    className={styles.batchTagInput}
                    placeholder="给所选作品添加标签"
                    value={batchTagInput}
                    onChange={e => setBatchTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleBatchAddTag(); } }}
                  />
                  <button
                    className={styles.batchAddTag}
                    onClick={handleBatchAddTag}
                    disabled={selectedTrackIds.size === 0 || !batchTagInput.trim()}
                  >批量添加标签</button>
                </div>
                {/* Phase Product Polish-M: Batch remove tag */}
                <div className={styles.batchTagRow}>
                  <input
                    className={`${styles.batchTagInput} ${styles.batchRemoveTag}`}
                    placeholder="输入要删除的标签（大小写不敏感）"
                    value={batchRemoveTagInput}
                    onChange={e => setBatchRemoveTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleBatchRemoveTag(); } }}
                  />
                  <button
                    className={`${styles.batchAddTag} ${styles.batchRemoveTagBtn}`}
                    onClick={handleBatchRemoveTag}
                    disabled={selectedTrackIds.size === 0 || !batchRemoveTagInput.trim()}
                  >批量删除标签</button>
                </div>
                {/* Phase Product Polish-N: Batch note editing (overwrite / append) */}
                <div className={`${styles.batchTagRow} ${styles.batchNoteRow}`}>
                  <textarea
                    className={`${styles.batchTagInput} ${styles.batchNoteTextarea}`}
                    placeholder="为所选作品写入备注（覆盖 / 追加）"
                    value={batchNoteInput}
                    onChange={e => setBatchNoteInput(e.target.value.slice(0, 500))}
                    rows={2}
                    maxLength={500}
                    aria-label="批量备注"
                  />
                  <div className={styles.batchNoteControls}>
                    <label className={styles.batchNoteModeLabel}>
                      <input
                        type="radio"
                        name="batchNoteMode"
                        value="overwrite"
                        checked={batchNoteMode === 'overwrite'}
                        onChange={() => setBatchNoteMode('overwrite')}
                      />
                      <span>覆盖备注</span>
                    </label>
                    <label className={styles.batchNoteModeLabel}>
                      <input
                        type="radio"
                        name="batchNoteMode"
                        value="append"
                        checked={batchNoteMode === 'append'}
                        onChange={() => setBatchNoteMode('append')}
                      />
                      <span>追加到备注</span>
                    </label>
                    <button
                      className={`${styles.batchAddTag} ${styles.batchNoteSaveBtn}`}
                      onClick={handleBatchNoteEdit}
                      disabled={selectedTrackIds.size === 0 || !batchNoteInput.trim()}
                    >批量保存备注</button>
                  </div>
                </div>
                <button
                  className={`${styles.collectionExportBtn} ${styles.secondary}`}
                  onClick={handleExportSelectedMarkdown}
                  disabled={selectedTrackIds.size === 0}
                >导出所选 Markdown</button>
                <button
                  className={`${styles.collectionExportBtn} ${styles.secondary}`}
                  onClick={handleExportSelectedJson}
                  disabled={selectedTrackIds.size === 0}
                >导出所选 JSON</button>
              </>
            )}

            {/* Phase Product Polish-M: Copy collection link */}
            <button
              className={`${styles.collectionExportBtn} ${styles.collectionShareBtn}`}
              onClick={handleCopyCollectionLink}
              title="把当前筛选条件变成可分享链接"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
              </svg>
              复制当前集合链接
            </button>

            <button
              className={styles.collectionExportBtn}
              onClick={() => handleExportCollectionMarkdown(filteredTracks, collectionLabel)}
              disabled={filteredTracks.length === 0}
              title={`导出 ${collectionLabel}`}
            >
              {smartCollectionLabel
                ? `导出「${smartCollectionLabel}」Markdown`
                : '导出当前集合 Markdown'}
            </button>
            <button
              className={`${styles.collectionExportBtn} ${styles.secondary}`}
              onClick={() => handleExportCollectionJson(filteredTracks, collectionLabel)}
              disabled={filteredTracks.length === 0}
              title={`导出 ${collectionLabel}`}
            >
              {smartCollectionLabel
                ? `导出「${smartCollectionLabel}」JSON`
                : '导出当前集合 JSON'}
            </button>
          </div>
        </div>

        {/* Phase Product Polish-N: Library-wide annotation history overview */}
        <div className={styles.historyPanel}>
          <button
            className={styles.historyPanelHeader}
            onClick={() => setHistoryPanelOpen(v => !v)}
            aria-expanded={historyPanelOpen}
          >
            <strong>标注历史总览</strong>
            <span className={styles.historyPanelHint}>
              {historyPanelOpen ? '收起' : '展开'}（最近 20 条 · 仅保存在当前浏览器）
            </span>
          </button>
          {historyPanelOpen && (
            <div className={styles.historyPanelBody}>
              <div className={styles.historyFilterRow}>
                {([
                  ['all', '全部'],
                  ['tag', '标签变更'],
                  ['note', '备注变更'],
                  ['import', '导入'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    className={`${styles.historyFilterChip} ${historyFilter === key ? styles.historyFilterChipActive : ''}`}
                    onClick={() => setHistoryFilter(key)}
                    aria-pressed={historyFilter === key}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <LibraryHistoryPanel filter={historyFilter} refreshTick={historyRefreshTick} />
              <p className={styles.historyPanelFooter}>
                历史仅保存在当前浏览器，用于回看本地标注操作。
              </p>
            </div>
          )}
        </div>

        {/* Phase Product Polish-L: Local backup panel */}
        <div className={styles.backupPanel}>
          <div className={styles.backupHeader}>
            <strong className={styles.backupTitle}>本地资料备份</strong>
            <span className={styles.backupHint}>这些资料只保存在当前浏览器。导出备份可用于换浏览器或避免本地数据丢失。</span>
          </div>
          <div className={styles.backupRow}>
            <button
              className={styles.backupBtn}
              onClick={handleExportBackup}
            >导出本地资料</button>
            <button
              className={`${styles.backupBtn} ${styles.secondary}`}
              onClick={() => backupFileInputRef.current?.click()}
            >导入本地资料</button>
            <input
              ref={backupFileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleBackupFileChosen}
              className={styles.backupFileInput}
              aria-label="选择备份文件"
            />
            <button
              className={`${styles.backupBtn} ${styles.secondary}`}
              onClick={() => handleApplyImport('merge')}
            >合并导入</button>
            <button
              className={`${styles.backupBtn} ${styles.secondary}`}
              onClick={() => handleApplyImport('replace')}
            >覆盖导入</button>
          </div>
        </div>

        {/* Hint */}
        {showHint && (
          <div className={styles.apiHint}>
            {!apiConnected ? '未连接本地服务，当前显示示例作品' : '还没有真实作品，去创作台生成第一首音乐'}
          </div>
        )}

        {/* Grid */}
        <div className={styles.grid}>
          {filteredTracks.map(track => {
            const isSelected = selectedTrackIds.has(track.id);
            return (
            <div
              key={track.id}
              className={`${styles.card} ${batchMode ? styles.cardSelect : ''} ${isSelected ? styles.cardSelected : ''}`}
            >
              {/* Phase Product Polish-L: batch mode checkbox */}
              {batchMode && (
                <label
                  className={styles.checkbox}
                  onClick={e => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleTrackSelected(track.id)}
                    aria-label={`选择 ${track.title}`}
                  />
                </label>
              )}
              <div className={styles.cardHeader}>
                <div className={styles.cardInfo}>
                  <h3 className={styles.cardTitle}>{track.title}</h3>
                  <div className={styles.cardMeta}>
                    <span className={styles.cardMode}>
                      {MODE_LABELS[track.mode as keyof typeof MODE_LABELS] || track.mode}
                    </span>
                    <span className={`${styles.sourceTag} ${track.generationSource === 'mmx-cli' ? styles.cliTag : track.generationSource === 'minimax' ? styles.minimaxTag : styles.mockTag}`}>
                      {sourceLabel(track.generationSource, track.isMock)}
                    </span>
                  </div>
                  {/* Phase Product Polish-K: Annotation tags on card */}
                  {(() => {
                    const ann = annotations[track.id];
                    if (!ann || (ann.tags.length === 0 && !ann.note.trim())) return null;
                    return (
                      <div className={styles.cardAnnotations}>
                        {ann.tags.slice(0, 3).map(tag => (
                          <span key={tag} className={styles.cardTagChip}>{tag}</span>
                        ))}
                        {ann.tags.length > 3 && <span className={styles.cardTagMore}>+{ann.tags.length - 3}</span>}
                        {ann.note.trim() && <span className={styles.cardNoteIcon} title="有备注">📝</span>}
                      </div>
                    );
                  })()}
                </div>
                {/* Favorite button */}
                <button
                  className={`${styles.favoriteBtn} ${favorites.has(track.id) ? styles.favorited : ''}`}
                  onClick={() => toggleFavorite(track.id)}
                  aria-label={favorites.has(track.id) ? '取消收藏' : '收藏'}
                >
                  {favorites.has(track.id) ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  )}
                </button>
              </div>

              {/* Mini waveform */}
              <div className={styles.miniWave}>
                {Array.from({ length: 24 }, (_, i) => {
                  const h = [40,60,80,100,80,60,90,70,100,80,60,90,50,80,100,70,90,60,80,100,60,80,90,70][i];
                  return <div key={i} className={styles.miniBar} style={{ height: `${h}%` }} />;
                })}
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.duration}>{track.durationText}</span>
                <div className={styles.cardActions}>
                  {track.audioUrl ? (
                    <button className={styles.playBtn} onClick={() => handlePlay(track)} aria-label="试听">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      试听
                    </button>
                  ) : (
                    <span className={`${styles.playBtn} ${styles.disabled}`} aria-label="试听">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      试听
                    </span>
                  )}
                  <button className={styles.detailBtn} onClick={() => setDetailTrack(track)} aria-label="详情">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    详情
                  </button>
                  {!track.isMock && (
                    <button className={`${styles.deleteBtn} ${deletingId === track.id ? styles.deleting : ''}`}
                      onClick={() => handleDelete(track)} disabled={deletingId === track.id} aria-label="删除">
                      {deletingId === track.id ? '删除中…' : '删除'}
                    </button>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {/* Empty state */}
        {filteredTracks.length === 0 && !loading && (
          <div className={styles.empty}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            {searchQuery ? (
              <>
                <h3>没有匹配「{searchQuery}」的作品</h3>
                <p>试试其他关键词，或清除搜索</p>
                <button className={styles.emptyBtn} onClick={() => setSearchQuery('')}>清除搜索</button>
              </>
            ) : filterSource === 'favorites' ? (
              <>
                <h3>还没有收藏</h3>
                <p>点击作品卡片上的星标收藏你喜欢的音乐</p>
              </>
            ) : (
              <>
                <h3>还没有这个来源的作品</h3>
                <p>换个筛选条件，或去创作台生成新的音乐</p>
                <Link to="/studio" className={styles.emptyBtn}>开始创作</Link>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Detail Drawer ── */}
      {detailTrack && (
        <>
          <div className={styles.drawerOverlay} onClick={handleCloseDetail} />
          <div className={styles.drawer}>
            <div className={styles.drawerHeader}>
              <h2 className={styles.drawerTitle}>作品详情</h2>
              <button className={styles.drawerClose} onClick={handleCloseDetail} aria-label="关闭">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className={styles.drawerBody}>
              <h3 className={styles.detailTitle}>{detailTrack.title}</h3>

              <div className={styles.detailMeta}>
                <span className={`${styles.sourceTag} ${detailTrack.generationSource === 'mmx-cli' ? styles.cliTag : detailTrack.generationSource === 'minimax' ? styles.minimaxTag : styles.mockTag}`}>
                  {sourceLabel(detailTrack.generationSource, detailTrack.isMock)}
                </span>
                <span className={styles.detailMode}>
                  {MODE_LABELS[detailTrack.mode as keyof typeof MODE_LABELS] || detailTrack.mode}
                </span>
              </div>

              {/* Phase Product Polish-K: Annotation editor */}
              <AnnotationEditor
                trackId={detailTrack.id}
                annotations={annotations}
                onChange={(updated, meta) => {
                  setAnnotations(updated);
                  saveTrackAnnotations(updated);
                  // Phase Product Polish-M: record history for the diff
                  if (meta) {
                    const prevTags = new Set(meta.prev?.tags || []);
                    const nextTags = new Set(meta.next.tags);
                    const added: string[] = [];
                    const removed: string[] = [];
                    nextTags.forEach(t => { if (!prevTags.has(t)) added.push(t); });
                    prevTags.forEach(t => { if (!nextTags.has(t)) removed.push(t); });
                    if (added.length > 0) {
                      recordAnnotationHistory({
                        action: 'tag_added',
                        trackId: detailTrack.id,
                        label: `添加标签「${added.join('、')}」`,
                        tags: added,
                      });
                    }
                    if (removed.length > 0) {
                      recordAnnotationHistory({
                        action: 'tag_removed',
                        trackId: detailTrack.id,
                        label: `删除标签「${removed.join('、')}」`,
                        tags: removed,
                      });
                    }
                    if (meta.prev?.note !== meta.next.note) {
                      recordAnnotationHistory({
                        action: 'note_updated',
                        trackId: detailTrack.id,
                        label: '更新备注',
                        notePreview: meta.next.note.slice(0, 80),
                      });
                    }
                  }
                  showCopy('作品备注已保存');
                  setHistoryRefreshTick(t => t + 1);
                }}
              />

              {/* Phase Product Polish-N: Annotation timeline (per-track, expand/collapse) */}
              <div className={styles.historySection}>
                <div className={styles.historyHeader}>
                  <div className={styles.historyTitle}>标注时间线</div>
                  <button
                    className={styles.historyToggle}
                    onClick={() => setTrackHistoryExpanded(v => !v)}
                    aria-pressed={trackHistoryExpanded}
                  >
                    {trackHistoryExpanded ? '收起' : '查看全部'}
                  </button>
                </div>
                <TrackHistoryTimeline
                  trackId={detailTrack.id}
                  expanded={trackHistoryExpanded}
                />
              </div>

              <div className={styles.detailGrid}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>创建时间</span>
                  <span className={styles.detailValue}>{formatRelativeTime(detailTrack.createdAt)}</span>
                </div>
                {detailTrack.durationText && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>时长</span>
                    <span className={styles.detailValue}>{detailTrack.durationText}</span>
                  </div>
                )}
                {detailTrack.durationMs && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>时长（毫秒）</span>
                    <span className={styles.detailValue}>{detailTrack.durationMs.toLocaleString()} ms</span>
                  </div>
                )}
                {detailTrack.audioFormat && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>音频格式</span>
                    <span className={styles.detailValue}>{detailTrack.audioFormat.toUpperCase()}</span>
                  </div>
                )}
                {detailTrack.audioMimeType && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>MIME</span>
                    <span className={styles.detailValue}>{detailTrack.audioMimeType}</span>
                  </div>
                )}
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Track ID</span>
                  <div className={styles.detailIdRow}>
                    <span className={styles.detailId}>{detailTrack.id}</span>
                    <button className={styles.copyBtn} onClick={() => handleCopyId(detailTrack.id)} aria-label="复制 ID">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                      </svg>
                      复制
                    </button>
                  </div>
                </div>
              </div>

              {(detailTrack.prompt || detailTrack.lyrics) && (
                <div className={styles.detailSection}>
                  {detailTrack.prompt && (
                    <>
                      <div className={styles.detailSectionLabel}>
                        <span>提示词</span>
                        <button className={styles.copyBtn} onClick={() => handleCopyPrompt(detailTrack.prompt)} aria-label="复制提示词">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                          </svg>
                          复制
                        </button>
                      </div>
                      <p className={styles.detailPrompt}>{detailTrack.prompt}</p>
                    </>
                  )}
                  {detailTrack.lyrics && (
                    <>
                      <div className={styles.detailSectionLabel}>歌词</div>
                      <p className={styles.detailPrompt}>{detailTrack.lyrics}</p>
                    </>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className={styles.detailActions}>
                {detailTrack.audioUrl ? (
                  <button className={styles.actionBtn} onClick={() => handlePlay(detailTrack)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    播放
                  </button>
                ) : (
                  <span className={`${styles.actionBtn} ${styles.disabled}`}>无可播放音频</span>
                )}
                {/* Phase Product Polish-H: Add to queue */}
                {detailTrack.audioUrl && onAddToQueue && (
                  <button
                    className={`${styles.actionBtn} ${styles.secondary}`}
                    onClick={() => {
                      onAddToQueue(itemToGlobal(detailTrack))
                      showCopy('已加入播放队列')
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    加入队列
                  </button>
                )}
                {detailTrack.downloadUrl ? (
                  <a href={detailTrack.downloadUrl} download className={`${styles.actionBtn} ${styles.secondary}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    下载
                  </a>
                ) : (
                  <span className={`${styles.actionBtn} ${styles.secondary} ${styles.disabled}`}>无可下载</span>
                )}
                {detailTrack.prompt && (
                  <button className={`${styles.actionBtn} ${styles.secondary}`} onClick={() => handleCopyPrompt(detailTrack.prompt)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                    复制提示词
                  </button>
                )}
                <button className={`${styles.actionBtn} ${styles.secondary}`} onClick={() => handleCopyShareLink(detailTrack)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                  </svg>
                  分享
                </button>
                <button className={`${styles.actionBtn} ${styles.secondary}`} onClick={() => handleExportTrackInfo(detailTrack)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                  </svg>
                  导出
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}

// Phase Product Polish-N: Action badge label map (browser-local history only)
const HISTORY_ACTION_BADGE: Record<AnnotationHistoryAction, { label: string; tone: string }> = {
  tag_added: { label: '添加标签', tone: 'tag' },
  tag_removed: { label: '删除标签', tone: 'tag' },
  batch_tag_added: { label: '批量添加标签', tone: 'batch' },
  batch_tag_removed: { label: '批量删除标签', tone: 'batch' },
  note_updated: { label: '更新备注', tone: 'note' },
  backup_import_merge: { label: '合并导入', tone: 'import' },
  backup_import_replace: { label: '覆盖导入', tone: 'import' },
};

function actionBadgeClass(tone: string): string {
  switch (tone) {
    case 'tag': return styles.badgeTag;
    case 'batch': return styles.badgeBatch;
    case 'note': return styles.badgeNote;
    case 'import': return styles.badgeImport;
    default: return styles.badgeDefault;
  }
}

// Phase Product Polish-N: Per-track history timeline (collapse: 5, expand: all)
function TrackHistoryTimeline({
  trackId,
  expanded,
}: {
  trackId: string;
  expanded: boolean;
}) {
  const [entries, setEntries] = useState<AnnotationHistoryEntry[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setEntries(getTrackAnnotationHistory(trackId, expanded ? 300 : 5));
  }, [trackId, expanded, version]);

  // Re-read on localStorage changes (other tabs / other panels in same tab)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'mmx-studio:annotation-history:v1') setVersion(v => v + 1);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (entries.length === 0) {
    return <div className={styles.historyEmpty}>暂无标注历史</div>;
  }

  return (
    <ul className={styles.historyList}>
      {entries.map(e => {
        const badge = HISTORY_ACTION_BADGE[e.action] || { label: e.label, tone: 'default' };
        return (
          <li key={e.id} className={styles.historyItem}>
            <div className={styles.historyItemHeader}>
              <span className={`${styles.actionBadge} ${actionBadgeClass(badge.tone)}`}>
                {badge.label}
              </span>
              {e.tags && e.tags.length > 0 && (
                <span className={styles.historyTags}>
                  {e.tags.map(t => `#${t}`).join(' ')}
                </span>
              )}
            </div>
            {e.notePreview && (
              <div className={styles.historyNote}>「{e.notePreview}」</div>
            )}
            <div className={styles.historyTime}>{formatHistoryTime(e.createdAt)}</div>
          </li>
        );
      })}
    </ul>
  );
}

// Phase Product Polish-N: Library-wide annotation history (recent 20, filter chips)
function LibraryHistoryPanel({
  filter,
  refreshTick,
}: {
  filter: 'all' | 'tag' | 'note' | 'import';
  refreshTick: number;
}) {
  const [entries, setEntries] = useState<AnnotationHistoryEntry[]>([]);

  useEffect(() => {
    const all = loadAnnotationHistory();
    const filtered = all.filter(e => {
      if (filter === 'all') return true;
      if (filter === 'tag') return e.action.startsWith('tag_') || e.action.startsWith('batch_tag_');
      if (filter === 'note') return e.action === 'note_updated';
      if (filter === 'import') return e.action === 'backup_import_merge' || e.action === 'backup_import_replace';
      return true;
    });
    setEntries(filtered.slice(0, 20));
  }, [filter, refreshTick]);

  if (entries.length === 0) {
    return <div className={styles.historyEmpty}>暂无符合条件的标注历史</div>;
  }

  return (
    <ul className={styles.historyList}>
      {entries.map(e => {
        const badge = HISTORY_ACTION_BADGE[e.action] || { label: e.label, tone: 'default' };
        const count = e.trackIds?.length ?? (e.trackId ? 1 : 0);
        return (
          <li key={e.id} className={styles.historyItem}>
            <div className={styles.historyItemHeader}>
              <span className={`${styles.actionBadge} ${actionBadgeClass(badge.tone)}`}>
                {badge.label}
              </span>
              {count > 0 && (
                <span className={styles.historyTrackCount}>
                  {count === 1 ? '1 首' : `${count} 首`}
                </span>
              )}
              {e.tags && e.tags.length > 0 && (
                <span className={styles.historyTags}>
                  {e.tags.map(t => `#${t}`).join(' ')}
                </span>
              )}
            </div>
            {e.notePreview && (
              <div className={styles.historyNote}>「{e.notePreview}」</div>
            )}
            <div className={styles.historyTime}>{formatHistoryTime(e.createdAt)}</div>
          </li>
        );
      })}
    </ul>
  );
}

function formatHistoryTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60_000) return '刚刚';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
    return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
