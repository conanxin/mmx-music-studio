/**
 * Thin re-export wrapper so the server can import core logic.
 * tsx resolves .ts files directly — no build step needed.
 */

export type { MusicGenerationInput } from '../packages/core/src/types.js';
export { validateMusicInput } from '../packages/core/src/validation.js';
export { buildMiniMaxMusicPayload } from '../packages/core/src/request-builder.js';