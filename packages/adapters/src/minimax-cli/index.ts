/**
 * MMX CLI Adapter
 *
 * Usage:
 *   import { generateWithMmxCli, diagnoseMmxCli } from './minimax-cli/client.js';
 */

export { generateWithMmxCli, diagnoseMmxCli } from './client.js';
export type {
  MmxCliGenerationOptions,
  MmxCliGenerationResult,
  MmxCliDiagnostics,
  MmxCliRegion,
} from './types.js';
export {
  MmxCliError,
  MmxCliNotFoundError,
  MmxCliTimeoutError,
  MmxCliAuthError,
  MmxCliUnsupportedModeError,
  MmxCliGenerationError,
  redactCliOutput,
} from './errors.js';