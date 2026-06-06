/**
 * MiniMax API Adapter — public surface.
 */

export { callMiniMaxMusicGeneration } from './client.js';
export { normalizeMiniMaxMusicResponse } from './response.js';
export { isProbablyUrl, isProbablyHexAudio, hexToBuffer, downloadAudioToBuffer, getAudioExtension } from './audio.js';
export {
  MiniMaxApiError,
  MiniMaxNetworkError,
  MiniMaxResponseError,
  MiniMaxAudioDownloadError,
  MiniMaxAudioDecodeError,
} from './errors.js';
export type { CallMiniMaxOptions } from './client.js';