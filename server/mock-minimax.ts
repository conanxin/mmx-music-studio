/**
 * Mock MiniMax Adapter — for local dev and smoke tests only.
 *
 * Generates a short playable WAV audio buffer without calling any network.
 * Does NOT consume MiniMax credits. Does NOT read API keys.
 *
 * Used when REAL_GENERATION_ENABLED=false.
 */

import { randomUUID } from 'node:crypto';

// ── WAV buffer generator ──────────────────────────────────────────────────────

/**
 * Generate a simple WAV file buffer with a sine wave + fade in/out.
 * Duration: 1.5–3s, 44100Hz, mono, 16-bit PCM.
 */
function createWavBuffer(durationS = 2): { buffer: Buffer; durationMs: number; sizeBytes: number } {
  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.floor(sampleRate * durationS);
  const durationMs = Math.round((numSamples / sampleRate) * 1000);

  // Build raw PCM samples (little-endian 16-bit signed)
  const dataBytes = numSamples * numChannels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataBytes); // 44-byte header + data

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4); // file size - 8
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // byte rate
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 30); // block align
  buffer.writeUInt16LE(bitsPerSample, 32);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);

  // Generate sine wave with fade in/out
  const frequency = 440 + Math.floor(Math.random() * 220); // A4–A6
  const amplitude = 16000;
  const fadeSamples = Math.floor(sampleRate * 0.15); // 150ms fade

  for (let i = 0; i < numSamples; i++) {
    // Sine wave
    const t = (i / sampleRate) * frequency * 2 * Math.PI;
    let sample = Math.round(amplitude * Math.sin(t));

    // Fade in
    if (i < fadeSamples) {
      sample = Math.round(sample * i / fadeSamples);
    }
    // Fade out
    const fadeOutStart = numSamples - fadeSamples;
    if (i > fadeOutStart) {
      sample = Math.round(sample * (numSamples - i) / fadeSamples);
    }

    buffer.writeInt16LE(sample, 44 + i * 2);
  }

  return { buffer, durationMs, sizeBytes: buffer.length };
}

// ── Mock MiniMax generate ─────────────────────────────────────────────────────

export interface MockGenerateResult {
  traceId: string;
  audioBuffer: Buffer;
  extraInfo: {
    durationMs: number;
    sampleRate: number;
    channels: number;
    bitrate: number;
    sizeBytes: number;
  };
}

export interface MockGenerateInput {
  mode: string;
  prompt?: string;
  lyrics?: string;
  audioUrl?: string;
  audioBase64?: string;
  model?: string;
  outputFormat?: string;
}

/**
 * Mock MiniMax music generation.
 * Returns a short WAV buffer without network access or API keys.
 */
export async function mockMiniMaxGenerate(input: MockGenerateInput): Promise<MockGenerateResult> {
  // Simulate async API call (50–150ms)
  await new Promise(resolve => setTimeout(resolve, 50 + Math.floor(Math.random() * 100)));

  const durationS = 1.5 + Math.random() * 1.5; // 1.5–3s
  const { buffer, durationMs, sizeBytes } = createWavBuffer(durationS);

  return {
    traceId: `mock_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    audioBuffer: buffer,
    extraInfo: {
      durationMs,
      sampleRate: 44100,
      channels: 1,
      bitrate: 44100 * 16, // approximate
      sizeBytes,
    },
  };
}
