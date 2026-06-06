// Quick validation test using absolute path
import { validateMusicInput } from '/home/ubuntu/projects/mmx-music-studio/packages/core/src/validation.js';
import { buildMiniMaxMusicPayload } from '/home/ubuntu/projects/mmx-music-studio/packages/core/src/request-builder.js';

const input = { mode: 'instrumental', prompt: '深夜编程风格的安静背景音乐' };
console.log('Validation:', JSON.stringify(validateMusicInput(input)));
console.log('Payload:', JSON.stringify(buildMiniMaxMusicPayload(input), null, 2));
