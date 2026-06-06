/**
 * MMX CLI Adapter — server-side integration.
 */
export { generateWithMmxCli, diagnoseMmxCli, redactCliOutput, runMmx } from './client.js';
export { MmxCliError, MmxCliNotFoundError, MmxCliTimeoutError, MmxCliAuthError, MmxCliUnsupportedModeError, MmxCliGenerationError } from './errors.js';
export type { MmxCliGenerationOptions, MmxCliGenerationResult, MmxCliDiagnostics } from './types.js';