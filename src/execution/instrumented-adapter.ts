/**
 * Generic adapter instrumentation.
 *
 * Wraps any adapter so that each method call emits:
 *   1. A repo-level span (one per adapter, lazily created on first call)
 *   2. An agent-level span (one per method invocation)
 *
 * Spans are registered in the provided SpanContext.
 */

import type { SpanContext } from './span-context.js';

export interface AdapterInstrumentationConfig {
  /** Name of the upstream repo this adapter represents */
  repoName: string;
  /** Reference to the shared SpanContext */
  spanContext: SpanContext;
}

/**
 * Wraps an adapter instance to produce repo + agent spans for every method call.
 *
 * Returns a Proxy that intercepts all method calls on the adapter.
 * The repo span is created lazily on the first method invocation and
 * remains open for the lifetime of the adapter. Agent spans are created
 * per invocation and closed when the method settles.
 */
export function instrumentAdapter<T extends object>(
  adapter: T,
  config: AdapterInstrumentationConfig
): T {
  let repoSpanId: string | null = null;

  const ensureRepoSpan = (): string => {
    if (!repoSpanId) {
      repoSpanId = config.spanContext.createSpan({
        parent_span_id: config.spanContext.getCoreSpanId(),
        type: 'repo',
        name: config.repoName,
      });
    }
    return repoSpanId;
  };

  return new Proxy(adapter, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (typeof value !== 'function') {
        return value;
      }

      return function (this: unknown, ...args: unknown[]) {
        const currentRepoSpanId = ensureRepoSpan();
        const methodName = String(prop);

        const agentSpanId = config.spanContext.createSpan({
          parent_span_id: currentRepoSpanId,
          type: 'agent',
          name: `${config.repoName}.${methodName}`,
        });

        try {
          const result = value.apply(target, args);

          // Handle async methods (all adapter methods are async)
          if (result && typeof result === 'object' && typeof (result as Promise<unknown>).then === 'function') {
            return (result as Promise<unknown>).then(
              (resolved) => {
                config.spanContext.completeSpan(agentSpanId);
                return resolved;
              },
              (err) => {
                config.spanContext.failSpan(agentSpanId, (err as Error).message || String(err));
                throw err;
              }
            );
          }

          // Synchronous return
          config.spanContext.completeSpan(agentSpanId);
          return result;
        } catch (err) {
          config.spanContext.failSpan(agentSpanId, (err as Error).message || String(err));
          throw err;
        }
      };
    },
  });
}

/**
 * Completes the repo span for an instrumented adapter.
 * Call this when the adapter is no longer needed or at finalization time.
 */
export function finalizeRepoSpans(spanContext: SpanContext): void {
  const spans = spanContext.getSpans();
  for (const span of spans) {
    if (span.type === 'repo' && span.status === 'running') {
      spanContext.completeSpan(span.span_id);
    }
  }
}
