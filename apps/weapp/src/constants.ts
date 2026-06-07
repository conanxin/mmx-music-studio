// constants.ts — Safe shared constants for WeChat Mini Program
// No real keys, tokens, or secrets here

import { MusicMode } from './types';

// Safe storage keys (non-sensitive)
export const API_BASE_KEY = 'mmx_api_base';
export const LAST_MODE_KEY = 'mmx_last_mode';
export const USER_PREF_KEY = 'mmx_user_pref';

export const BACKEND_LABELS: Record<string, string> = {
  mock: 'Server Mock',
  cli: 'MMX CLI',
  api: 'MiniMax API',
};

export const PROGRESS_MESSAGES = [
  '正在连接后端...',
  '正在提交任务...',
  '正在生成音乐...',
  '即将完成...',
];

export const MODE_TABS: { key: MusicMode; label: string }[] = [
  { key: 'instrumental', label: '纯音乐' },
  { key: 'auto', label: '自动成歌' },
  { key: 'lyrics', label: '歌词成歌' },
  { key: 'cover', label: '参考改编' },
];

export const STYLE_TAGS = [
  '安静', '明亮', '梦幻', '电影感',
  '电子', '钢琴', '吉他', 'Lo-fi',
];

export const DEFAULT_PROMPT_PLACEHOLDER: Record<MusicMode, string> = {
  instrumental: '描述你想要生成的纯音乐，例如：深夜编程、咖啡馆爵士、晨间冥想...',
  auto: '描述你想要创作的歌曲主题和风格...',
  lyrics: '在这里粘贴你的歌词...',
  cover: '上传参考音频并描述想要的改编方向...',
};