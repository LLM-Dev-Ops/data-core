/** Execution span infrastructure for agentics-execution-engine integration */

export type {
  ExecutionSpan,
  ExecutionGraph,
  CoreExecutionResult,
  ExecutionArtifact,
  ExecutionEvidence,
  SpanCreationOptions,
} from './types.js';

export { SpanContext } from './span-context.js';
export { instrumentAdapter, finalizeRepoSpans } from './instrumented-adapter.js';
export { validateExecutionGraph } from './validator.js';
export type { ValidationResult } from './validator.js';
