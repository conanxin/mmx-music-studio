// ─── Request Builder ───────────────────────────────────────────────────────────

import type {
  MusicGenerationInput,
  MiniMaxRegion,
  MiniMaxMusicModel,
  AudioSettings,
  BuildMusicPayloadResult,
  MiniMaxMusicGenerationPayload,
  NormalizedMusicInput,
  MiniMaxTextMusicModel,
  MiniMaxCoverModel,
} from './types.js'
import { MusicValidationError, MissingApiKeyError } from './errors.js'
import {
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_REGION,
  DEFAULT_TEXT_MUSIC_MODEL,
  DEFAULT_COVER_MODEL,
  DEFAULT_OUTPUT_FORMAT,
  MINI_MAX_ENDPOINTS,
} from './constants.js'
import { validateMusicInput } from './validation.js'

// ── Normalize ─────────────────────────────────────────────────────────────────

export function normalizeMusicInput<T extends MusicGenerationInput>(input: T): NormalizedMusicInput {
  const isTextMode = input.mode === 'instrumental' || input.mode === 'auto' || input.mode === 'lyrics'

  const region: MiniMaxRegion = input.region ?? DEFAULT_REGION
  const outputFormat = input.outputFormat ?? DEFAULT_OUTPUT_FORMAT
  const audioSettings: AudioSettings = {
    ...DEFAULT_AUDIO_SETTINGS,
    ...input.audioSettings,
  }

  let model: MiniMaxMusicModel
  if (isTextMode) {
    model = (input.model as MiniMaxTextMusicModel) ?? DEFAULT_TEXT_MUSIC_MODEL
  } else {
    model = (input.model as MiniMaxCoverModel) ?? DEFAULT_COVER_MODEL
  }

  return {
    ...input,
    region,
    model,
    outputFormat,
    audioSettings,
  } as NormalizedMusicInput
}

// ── Endpoint ──────────────────────────────────────────────────────────────────

export function getMiniMaxMusicEndpoint(region: MiniMaxRegion): string {
  return MINI_MAX_ENDPOINTS[region] ?? MINI_MAX_ENDPOINTS['cn']
}

// ── Payload Builder ───────────────────────────────────────────────────────────

export function buildMiniMaxMusicPayload(input: MusicGenerationInput): BuildMusicPayloadResult {
  // 1. Normalize
  const normalizedInput = normalizeMusicInput(input)

  // 2. Validate
  const result = validateMusicInput(input)
  if (!result.ok) {
    const msg = result.errors.map((e) => e.message).join('；')
    throw new MusicValidationError(msg, result.errors, result.warnings)
  }

  const endpoint = getMiniMaxMusicEndpoint(normalizedInput.region)

  const audioSettingPayload: MiniMaxMusicGenerationPayload['audio_setting'] = {
    sample_rate: normalizedInput.audioSettings.sample_rate,
    bitrate: normalizedInput.audioSettings.bitrate,
    format: normalizedInput.audioSettings.format,
  }

  const payload: MiniMaxMusicGenerationPayload = {
    model: normalizedInput.model,
    output_format: normalizedInput.outputFormat,
    audio_setting: audioSettingPayload,
  }

  switch (normalizedInput.mode) {
    case 'instrumental':
      payload.prompt = normalizedInput.prompt.trim()
      payload.is_instrumental = true
      break

    case 'auto':
      payload.prompt = normalizedInput.prompt.trim()
      payload.lyrics_optimizer = true
      break

    case 'lyrics':
      if (normalizedInput.prompt.trim()) {
        payload.prompt = normalizedInput.prompt.trim()
      }
      payload.lyrics = normalizedInput.lyrics.trim()
      break

    case 'cover-url':
      payload.prompt = normalizedInput.prompt.trim()
      payload.audio_url = normalizedInput.audioUrl.trim()
      if (normalizedInput.lyrics) {
        payload.lyrics = normalizedInput.lyrics.trim()
      }
      break

    case 'cover-file':
      payload.prompt = normalizedInput.prompt.trim()
      if (normalizedInput.audioBase64) {
        payload.audio_base64 = normalizedInput.audioBase64.trim()
      }
      if (normalizedInput.lyrics) {
        payload.lyrics = normalizedInput.lyrics.trim()
      }
      break
  }

  // For cover-file without base64, signal that upload is needed at adapter level
  const needsUpload =
    normalizedInput.mode === 'cover-file' && !normalizedInput.audioBase64

  return { endpoint, payload, normalizedInput, needsUpload }
}

// ── Authorization Headers ─────────────────────────────────────────────────────

export function createAuthorizationHeaders(apiKey: string): Record<string, string> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new MissingApiKeyError('API Key 不能为空')
  }
  return { Authorization: `Bearer ${apiKey.trim()}` }
}