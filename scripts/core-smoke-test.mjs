#!/usr/bin/env node
// ─── Core Smoke Test ──────────────────────────────────────────────────────────
// Does NOT read keys, does NOT call network.
// Verifies: files exist, payload builders map correctly, validation works.

import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

// ── 1. File existence check ───────────────────────────────────────────────────

const requiredFiles = [
  'packages/core/src/index.ts',
  'packages/core/src/types.ts',
  'packages/core/src/constants.ts',
  'packages/core/src/errors.ts',
  'packages/core/src/validation.ts',
  'packages/core/src/request-builder.ts',
  'packages/core/src/prompt-builder.ts',
  'packages/core/src/mock.ts',
]

let passed = 0
let failed = 0

function check(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`)
    failed++
  }
}

console.log('\n── File Existence ──')
for (const rel of requiredFiles) {
  const filePath = path.join(rootDir, rel)
  const fs = await import('fs')
  if (fs.existsSync(filePath)) {
    console.log(`  ✓ ${rel}`)
    passed++
  } else {
    console.log(`  ✗ MISSING: ${rel}`)
    failed++
  }
}

// ── Inline type/function checks via eval-free import ──────────────────────────
// We test by building the payload and checking shape (no network, no keys)

console.log('\n── Payload Builder Tests ──')

// We'll use dynamic import to test core modules
const { buildMiniMaxMusicPayload, validateMusicInput, createMockTrack, createMockJob, advanceMockJob } =
  await import(path.join(rootDir, 'packages/core/src/index.js')).catch(() => {
    // If .js doesn't exist yet, try .ts via ts-node or skip
    throw new Error('Could not import core — run "npm run build" first')
  })

// Test instrumental -> is_instrumental
check('instrumental payload has is_instrumental=true', () => {
  const result = buildMiniMaxMusicPayload({
    mode: 'instrumental',
    prompt: '深夜编程氛围音乐',
  })
  if (result.payload.is_instrumental !== true) throw new Error('Expected is_instrumental=true')
  if (!result.payload.prompt.includes('深夜')) throw new Error('Expected prompt preserved')
})

// Test auto -> lyrics_optimizer
check('auto payload has lyrics_optimizer=true', () => {
  const result = buildMiniMaxMusicPayload({
    mode: 'auto',
    prompt: '轻快的早晨',
  })
  if (result.payload.lyrics_optimizer !== true) throw new Error('Expected lyrics_optimizer=true')
})

// Test lyrics -> has lyrics field
check('lyrics payload has lyrics field', () => {
  const result = buildMiniMaxMusicPayload({
    mode: 'lyrics',
    prompt: '温暖的歌',
    lyrics: '[Verse]\n城市的灯光渐渐亮起',
  })
  if (!result.payload.lyrics) throw new Error('Expected lyrics in payload')
  if (!result.payload.lyrics.includes('城市')) throw new Error('Expected lyrics content preserved')
})

// Test cover-url -> audio_url
check('cover-url payload has audio_url', () => {
  const result = buildMiniMaxMusicPayload({
    mode: 'cover-url',
    prompt: '改编成更抒情的版本',
    audioUrl: 'https://example.com/sample.mp3',
  })
  if (!result.payload.audio_url) throw new Error('Expected audio_url in payload')
  if (!result.payload.audio_url.includes('example.com')) throw new Error('Expected audioUrl preserved')
})

// Test cover-file without base64 -> needsUpload=true
check('cover-file without base64 sets needsUpload=true', () => {
  const result = buildMiniMaxMusicPayload({
    mode: 'cover-file',
    prompt: '改编成更抒情的版本',
  })
  if (result.needsUpload !== true) throw new Error('Expected needsUpload=true when no base64')
})

// Test cover-file with base64 -> no needsUpload
check('cover-file with base64 does not set needsUpload', () => {
  const result = buildMiniMaxMusicPayload({
    mode: 'cover-file',
    prompt: '改编成更抒情的版本',
    audioBase64: 'BASE64DATAHERE==',
  })
  if (result.needsUpload !== false) throw new Error('Expected needsUpload=false when base64 present')
})

// Test validation: empty prompt on instrumental -> error
check('validateMusicInput catches empty instrumental prompt', () => {
  const result = validateMusicInput({ mode: 'instrumental', prompt: '' })
  if (result.ok) throw new Error('Expected validation to fail')
  if (!result.errors.some(e => e.code === 'PROMPT_REQUIRED')) throw new Error('Expected PROMPT_REQUIRED error')
})

// Test validation: empty lyrics on lyrics mode -> error
check('validateMusicInput catches empty lyrics', () => {
  const result = validateMusicInput({ mode: 'lyrics', prompt: 'style', lyrics: '' })
  if (result.ok) throw new Error('Expected validation to fail')
  if (!result.errors.some(e => e.code === 'LYRICS_REQUIRED')) throw new Error('Expected LYRICS_REQUIRED error')
})

// Test validation: invalid cover URL
check('validateMusicInput catches invalid cover URL', () => {
  const result = validateMusicInput({
    mode: 'cover-url',
    prompt: '改编成更抒情的版本',
    audioUrl: 'not-a-url',
  })
  if (result.ok) throw new Error('Expected validation to fail')
  if (!result.errors.some(e => e.code === 'INVALID_AUDIO_URL')) throw new Error('Expected INVALID_AUDIO_URL error')
})

// Test mock track creation
check('createMockTrack creates track with correct mode title', () => {
  const track = createMockTrack({ mode: 'instrumental', prompt: '深夜编程' })
  if (!track.id.startsWith('mock_')) throw new Error('Expected mock id prefix')
  if (track.status !== 'success') throw new Error('Expected status=success')
  if (!track.title) throw new Error('Expected title')
  if (!track.durationText) throw new Error('Expected durationText')
})

// Test mock job creation
check('createMockJob creates queued job', () => {
  const job = createMockJob({ mode: 'auto', prompt: '测试歌曲' })
  if (job.status !== 'queued') throw new Error('Expected status=queued')
  if (job.progress !== 0) throw new Error('Expected progress=0')
})

// Test advanceMockJob
check('advanceMockJob progresses to generating', () => {
  const job = createMockJob({ mode: 'instrumental', prompt: 'test' })
  const step20 = advanceMockJob(job, 'generating_20')
  if (step20.status !== 'generating') throw new Error('Expected status=generating')
  if (step20.progress !== 20) throw new Error('Expected progress=20')
})

check('advanceMockJob creates track on success', () => {
  const job = createMockJob({ mode: 'lyrics', prompt: 'test', lyrics: '[Verse]\nhello' })
  const success = advanceMockJob(job, 'success')
  if (success.status !== 'success') throw new Error('Expected status=success')
  if (success.progress !== 100) throw new Error('Expected progress=100')
  if (!success.track) throw new Error('Expected track on success')
})

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`)

if (failed > 0) {
  process.exit(1)
} else {
  console.log('All smoke tests passed.\n')
  process.exit(0)
}