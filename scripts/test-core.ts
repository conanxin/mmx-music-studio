// Test core validation and payload building
import { validateMusicInput } from '../packages/core/src/validation.js';
import { buildMiniMaxMusicPayload } from '../packages/core/src/request-builder.js';

const input = { mode: 'instrumental', prompt: '深夜编程风格的安静背景音乐' };
console.log('=== Validation ===');
console.log(JSON.stringify(validateMusicInput(input)));
console.log('\n=== Payload Keys ===');
console.log(Object.keys(buildMiniMaxMusicPayload(input)));
