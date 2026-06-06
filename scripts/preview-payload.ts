#!/usr/bin/env npx tsx
/**
 * preview-payload.ts — Dry-run payload inspector
 * Does NOT call MiniMax API. Does NOT read keys.
 * Outputs sanitized payload for 4 built-in scenarios.
 */
import { buildMiniMaxMusicPayload } from '../packages/core/src/request-builder.js'
import { createAuthorizationHeaders } from '../packages/core/src/request-builder.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { writeFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

type Scenario = {
  label: string
  input: Parameters<typeof buildMiniMaxMusicPayload>[0]
}

const scenarios: Scenario[] = [
  {
    label: 'instrumental (minimal)',
    input: {
      mode: 'instrumental',
      prompt: 'warm electronic ambient, calm, focused, no vocals',
    },
  },
  {
    label: 'auto (with lyrics_optimizer)',
    input: {
      mode: 'auto',
      prompt: 'Chinese pop ballad, piano, strings, emotional',
    },
  },
  {
    label: 'lyrics (provided lyrics)',
    input: {
      mode: 'lyrics',
      prompt: 'Mandarin indie pop, warm guitar, female vocal',
      lyrics: '[Verse]\n星光落在肩上\n[Chorus]\n因为我们就是光',
    },
  },
  {
    label: 'cover-url (reference audio)',
    input: {
      mode: 'cover-url',
      prompt: 'lo-fi jazz, smooth late night lounge, saxophone',
      audioUrl: 'https://example.com/audio.mp3',
    },
  },
]

const results = scenarios.map((scenario) => {
  const { endpoint, payload, normalizedInput, needsUpload } =
    buildMiniMaxMusicPayload(scenario.input)

  return {
    scenario: scenario.label,
    endpoint,
    payload,
    normalizedInput: {
      mode: normalizedInput.mode,
      prompt: normalizedInput.prompt,
      lyrics: normalizedInput.lyrics ?? null,
      audioUrl: normalizedInput.audioUrl ?? null,
      model: normalizedInput.model,
      outputFormat: normalizedInput.outputFormat,
      audioSettings: normalizedInput.audioSettings,
      region: normalizedInput.region,
      promptLength: normalizedInput.prompt.length,
    },
    needsUpload,
  }
})

// Sanity check: verify no key fields leak
for (const r of results) {
  const payloadStr = JSON.stringify(r.payload)
  if (
    payloadStr.includes('Bearer') ||
    payloadStr.includes('sk-') ||
    payloadStr.includes('apiKey') ||
    payloadStr.includes('api_key') ||
    payloadStr.includes('authorization') ||
    payloadStr.includes('eyJ')
  ) {
    throw new Error(
      `SECURITY: Key or Bearer token leaked in payload for scenario: ${r.scenario}`
    )
  }
}

const outputPath = join(__dirname, '..', 'tmp', 'payload-preview.json')
writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8')

console.log(`\n✅ Payload preview written to: ${outputPath}\n`)
for (const r of results) {
  console.log(`─── ${r.scenario} ────────────────────────────────`)
  console.log(`  endpoint : ${r.endpoint}`)
  console.log(`  payload  :`, r.payload)
  console.log()
}
console.log('✅ All scenarios sanitized — no key, Bearer, or secret detected.\n')