/**
 * SpanContext - Manages the hierarchical execution graph for a Core session.
 *
 * Creates and accumulates execution spans. Provides methods to create
 * child repo-level and agent-level spans with correct parent linkage.
 */

import { randomUUID } from 'crypto';
import type {
  ExecutionSpan,
  ExecutionGraph,
  CoreExecutionResult,
  SpanCreationOptions,
  ExecutionArtifact,
  ExecutionEvidence,
} from './types.js';
import { validateExecutionGraph } from './validator.js';

export class SpanContext {
  private readonly spans: ExecutionSpan[] = [];
  private readonly coreSpanId: string;
  private readonly coreName: string;
  private readonly parentSpanId: string | null;

  constructor(coreName: string, parentSpanId: string | null = null) {
    this.coreName = coreName;
    this.parentSpanId = parentSpanId;
    this.coreSpanId = randomUUID();

    this.spans.push({
      span_id: this.coreSpanId,
      parent_span_id: this.parentSpanId,
      type: 'core',
      name: coreName,
      start_time: new Date().toISOString(),
      status: 'running',
    });
  }

  getCoreSpanId(): string {
    return this.coreSpanId;
  }

  createSpan(options: SpanCreationOptions): string {
    const spanId = randomUUID();
    const span: ExecutionSpan = {
      span_id: spanId,
      parent_span_id: options.parent_span_id,
      type: options.type,
      name: options.name,
      start_time: new Date().toISOString(),
      status: 'running',
    };
    if (options.artifacts?.length) {
      span.artifacts = options.artifacts;
    }
    if (options.evidence?.length) {
      span.evidence = options.evidence;
    }
    this.spans.push(span);
    return spanId;
  }

  completeSpan(spanId: string, artifacts?: ExecutionArtifact[], evidence?: ExecutionEvidence[]): void {
    const span = this.spans.find(s => s.span_id === spanId);
    if (!span) return;
    span.end_time = new Date().toISOString();
    span.status = 'completed';
    if (artifacts?.length) {
      span.artifacts = [...(span.artifacts || []), ...artifacts];
    }
    if (evidence?.length) {
      span.evidence = [...(span.evidence || []), ...evidence];
    }
  }

  failSpan(spanId: string, error: string): void {
    const span = this.spans.find(s => s.span_id === spanId);
    if (!span) return;
    span.end_time = new Date().toISOString();
    span.status = 'failed';
    span.error = error;
  }

  /** Merge spans returned by an invoked repo without modification. */
  mergeSpans(externalSpans: ExecutionSpan[]): void {
    for (const span of externalSpans) {
      this.spans.push(span);
    }
  }

  /** Build the final execution graph and validate it. */
  finalize(): CoreExecutionResult {
    // Complete the core span
    const coreSpan = this.spans.find(s => s.span_id === this.coreSpanId);
    if (coreSpan && coreSpan.status === 'running') {
      coreSpan.end_time = new Date().toISOString();
      coreSpan.status = 'completed';
    }

    const graph: ExecutionGraph = {
      root_span_id: this.coreSpanId,
      spans: [...this.spans],
      metadata: {
        core_name: this.coreName,
        created_at: new Date().toISOString(),
        version: '1.0.0',
      },
    };

    const validation = validateExecutionGraph(graph);

    if (!validation.valid) {
      // Mark core span as failed
      if (coreSpan) {
        coreSpan.status = 'failed';
        coreSpan.error = validation.reasons.join('; ');
      }
      return {
        success: false,
        execution_graph: graph,
        failure_reasons: validation.reasons,
      };
    }

    return {
      success: true,
      execution_graph: graph,
    };
  }

  /** Get a snapshot of all spans (read-only). */
  getSpans(): ReadonlyArray<ExecutionSpan> {
    return this.spans;
  }
}
