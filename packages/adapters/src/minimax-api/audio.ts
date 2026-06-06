/**
 * Audio utilities — download, decode, extension detection.
 * Platform-agnostic (uses global fetch and ArrayBuffer).
 */

export function isProbablyUrl(value: string): boolean {
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('//')
  );
}

export function isProbablyHexAudio(value: string): boolean {
  if (value.length < 32) return false;
  return /^[0-9a-fA-F\s]+$/.test(value) && !value.includes('://');
}

export function hexToBuffer(hex: string): Buffer {
  const clean = hex.replace(/\s+/g, '');
  return Buffer.from(clean, 'hex');
}

const MAX_AUDIO_BYTES = 80 * 1024 * 1024; // 80 MB

/**
 * Download audio from URL to Buffer.
 * Does NOT log the URL (may contain signing tokens).
 * Rejects if Content-Length > 80 MB.
 */
export async function downloadAudioToBuffer(
  url: string,
  signal?: AbortSignal,
): Promise<Buffer> {
  if (!isProbablyUrl(url)) {
    throw new Error('无效的音频 URL');
  }

  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`音频下载失败: HTTP ${response.status}`);
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    const bytes = Number(contentLength);
    if (bytes > MAX_AUDIO_BYTES) {
      throw new Error(
        `音频文件过大 (${(bytes / 1024 / 1024).toFixed(1)} MB)，最大支持 80 MB`,
      );
    }
  }

  const arrayBuffer = await response.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);

  if (buf.length > MAX_AUDIO_BYTES) {
    throw new Error(`音频文件过大，最大支持 80 MB`);
  }

  return buf;
}

export function getAudioExtension(format: 'mp3' | 'wav'): string {
  return format === 'wav' ? '.wav' : '.mp3';
}