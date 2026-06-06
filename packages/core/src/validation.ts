// ─── Input Validation ──────────────────────────────────────────────────────────

import type { MusicGenerationInput, ValidationResult } from './types.js'
import {
  TEXT_PROMPT_MAX,
  INSTRUMENTAL_PROMPT_MIN,
  LYRICS_MIN,
  LYRICS_MAX,
  COVER_PROMPT_MIN,
  COVER_PROMPT_MAX,
  COVER_LYRICS_MIN,
  COVER_LYRICS_MAX,
  COVER_AUDIO_MAX_BYTES,
  SUPPORTED_AUDIO_MIME_TYPES,
} from './constants.js'

export function validateMusicInput(input: MusicGenerationInput): ValidationResult {
  const errors: ValidationResult['errors'] = []
  const warnings: ValidationResult['warnings'] = []

  switch (input.mode) {
    case 'instrumental': {
      if (!input.prompt || input.prompt.trim().length === 0) {
        errors.push({
          field: 'prompt',
          message: '音乐描述不能为空',
          code: 'PROMPT_REQUIRED',
        })
      } else if (input.prompt.trim().length < INSTRUMENTAL_PROMPT_MIN) {
        errors.push({
          field: 'prompt',
          message: '音乐描述不能为空',
          code: 'PROMPT_TOO_SHORT',
        })
      } else if (input.prompt.trim().length > TEXT_PROMPT_MAX) {
        errors.push({
          field: 'prompt',
          message: `音乐描述不能超过 ${TEXT_PROMPT_MAX} 个字符`,
          code: 'PROMPT_TOO_LONG',
        })
      }
      if (input.model && !['music-2.6', 'music-2.6-free'].includes(input.model)) {
        errors.push({
          field: 'model',
          message: '纯音乐模式只支持 music-2.6 或 music-2.6-free 模型',
          code: 'INVALID_MODEL',
        })
      }
      break
    }

    case 'auto': {
      if (!input.prompt || input.prompt.trim().length === 0) {
        errors.push({
          field: 'prompt',
          message: '音乐描述不能为空',
          code: 'PROMPT_REQUIRED',
        })
      } else if (input.prompt.trim().length > TEXT_PROMPT_MAX) {
        errors.push({
          field: 'prompt',
          message: `音乐描述不能超过 ${TEXT_PROMPT_MAX} 个字符`,
          code: 'PROMPT_TOO_LONG',
        })
      }
      if (input.model && !['music-2.6', 'music-2.6-free'].includes(input.model)) {
        errors.push({
          field: 'model',
          message: '自动成歌模式只支持 music-2.6 或 music-2.6-free 模型',
          code: 'INVALID_MODEL',
        })
      }
      break
    }

    case 'lyrics': {
      if (input.prompt && input.prompt.trim().length > TEXT_PROMPT_MAX) {
        errors.push({
          field: 'prompt',
          message: `音乐描述不能超过 ${TEXT_PROMPT_MAX} 个字符`,
          code: 'PROMPT_TOO_LONG',
        })
      }
      if (!input.lyrics || input.lyrics.trim().length === 0) {
        errors.push({
          field: 'lyrics',
          message: '歌词不能为空',
          code: 'LYRICS_REQUIRED',
        })
      } else if (input.lyrics.trim().length < LYRICS_MIN) {
        errors.push({
          field: 'lyrics',
          message: '歌词不能为空',
          code: 'LYRICS_TOO_SHORT',
        })
      } else if (input.lyrics.trim().length > LYRICS_MAX) {
        errors.push({
          field: 'lyrics',
          message: `歌词不能超过 ${LYRICS_MAX} 个字符`,
          code: 'LYRICS_TOO_LONG',
        })
      }
      if (input.model && !['music-2.6', 'music-2.6-free'].includes(input.model)) {
        errors.push({
          field: 'model',
          message: '歌词成歌模式只支持 music-2.6 或 music-2.6-free 模型',
          code: 'INVALID_MODEL',
        })
      }
      break
    }

    case 'cover-url': {
      if (!input.prompt || input.prompt.trim().length === 0) {
        errors.push({
          field: 'prompt',
          message: '音乐描述不能为空（参考改编需要描述目标风格）',
          code: 'PROMPT_REQUIRED',
        })
      } else if (input.prompt.trim().length < COVER_PROMPT_MIN) {
        errors.push({
          field: 'prompt',
          message: `音乐描述至少需要 ${COVER_PROMPT_MIN} 个字符`,
          code: 'PROMPT_TOO_SHORT',
        })
      } else if (input.prompt.trim().length > COVER_PROMPT_MAX) {
        errors.push({
          field: 'prompt',
          message: `音乐描述不能超过 ${COVER_PROMPT_MAX} 个字符`,
          code: 'PROMPT_TOO_LONG',
        })
      }
      if (!input.audioUrl || input.audioUrl.trim().length === 0) {
        errors.push({
          field: 'audioUrl',
          message: '参考音频 URL 不能为空',
          code: 'AUDIO_URL_REQUIRED',
        })
      } else if (
        !input.audioUrl.trim().startsWith('http://') &&
        !input.audioUrl.trim().startsWith('https://')
      ) {
        errors.push({
          field: 'audioUrl',
          message: '参考音频 URL 必须以 http:// 或 https:// 开头',
          code: 'INVALID_AUDIO_URL',
        })
      }
      if (input.lyrics) {
        const len = input.lyrics.trim().length
        if (len < COVER_LYRICS_MIN) {
          errors.push({
            field: 'lyrics',
            message: `参考改编歌词至少需要 ${COVER_LYRICS_MIN} 个字符`,
            code: 'LYRICS_TOO_SHORT',
          })
        } else if (len > COVER_LYRICS_MAX) {
          errors.push({
            field: 'lyrics',
            message: `参考改编歌词不能超过 ${COVER_LYRICS_MAX} 个字符`,
            code: 'LYRICS_TOO_LONG',
          })
        }
      }
      if (input.model && !['music-cover', 'music-cover-free'].includes(input.model)) {
        errors.push({
          field: 'model',
          message: '参考改编模式只支持 music-cover 或 music-cover-free 模型',
          code: 'INVALID_MODEL',
        })
      }
      break
    }

    case 'cover-file': {
      if (!input.prompt || input.prompt.trim().length === 0) {
        errors.push({
          field: 'prompt',
          message: '音乐描述不能为空（参考改编需要描述目标风格）',
          code: 'PROMPT_REQUIRED',
        })
      } else if (input.prompt.trim().length < COVER_PROMPT_MIN) {
        errors.push({
          field: 'prompt',
          message: `音乐描述至少需要 ${COVER_PROMPT_MIN} 个字符`,
          code: 'PROMPT_TOO_SHORT',
        })
      } else if (input.prompt.trim().length > COVER_PROMPT_MAX) {
        errors.push({
          field: 'prompt',
          message: `音乐描述不能超过 ${COVER_PROMPT_MAX} 个字符`,
          code: 'PROMPT_TOO_LONG',
        })
      }
      if (input.fileSizeBytes !== undefined && input.fileSizeBytes > COVER_AUDIO_MAX_BYTES) {
        errors.push({
          field: 'fileSizeBytes',
          message: '参考音频最大 50MB',
          code: 'FILE_TOO_LARGE',
        })
      }
      if (input.mimeType) {
        if (!SUPPORTED_AUDIO_MIME_TYPES.includes(input.mimeType as typeof SUPPORTED_AUDIO_MIME_TYPES[number])) {
          errors.push({
            field: 'mimeType',
            message: `不支持的音频格式，支持：MP3、WAV、FLAC、AAC`,
            code: 'UNSUPPORTED_MIME_TYPE',
          })
        }
      }
      if (!input.audioBase64 || input.audioBase64.trim().length === 0) {
        warnings.push({
          field: 'audioBase64',
          message: '当前阶段为 UI 原型，真实 API adapter 需要上传后转 base64',
          code: 'MISSING_BASE64',
        })
      }
      if (input.lyrics) {
        const len = input.lyrics.trim().length
        if (len < COVER_LYRICS_MIN) {
          errors.push({
            field: 'lyrics',
            message: `参考改编歌词至少需要 ${COVER_LYRICS_MIN} 个字符`,
            code: 'LYRICS_TOO_SHORT',
          })
        } else if (len > COVER_LYRICS_MAX) {
          errors.push({
            field: 'lyrics',
            message: `参考改编歌词不能超过 ${COVER_LYRICS_MAX} 个字符`,
            code: 'LYRICS_TOO_LONG',
          })
        }
      }
      if (input.model && !['music-cover', 'music-cover-free'].includes(input.model)) {
        errors.push({
          field: 'model',
          message: '参考改编模式只支持 music-cover 或 music-cover-free 模型',
          code: 'INVALID_MODEL',
        })
      }
      break
    }
  }

  if (input.region && !['cn', 'global'].includes(input.region)) {
    errors.push({
      field: 'region',
      message: '区域只能是 cn 或 global',
      code: 'INVALID_REGION',
    })
  }
  if (input.outputFormat && !['url', 'hex'].includes(input.outputFormat)) {
    errors.push({
      field: 'outputFormat',
      message: '输出格式只能是 url 或 hex',
      code: 'INVALID_OUTPUT_FORMAT',
    })
  }

  return { ok: errors.length === 0, errors, warnings }
}