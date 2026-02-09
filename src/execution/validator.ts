/**
 * Execution graph validator.
 *
 * Enforces the hierarchy invariant:
 *   Core → Repo → Agent
 *
 * A graph is invalid if:
 * - No repo-level child spans exist under the core span
 * - Any repo span has zero agent-level child spans
 * - Any span has a parent_span_id that doesn't exist in the graph
 */

import type { ExecutionGraph, ExecutionSpan } from './types.js';

export interface ValidationResult {
  valid: boolean;
  reasons: string[];
}

export function validateExecutionGraph(graph: ExecutionGraph): ValidationResult {
  const reasons: string[] = [];
  const spanMap = new Map<string, ExecutionSpan>();

  for (const span of graph.spans) {
    spanMap.set(span.span_id, span);
  }

  // Find the core span
  const coreSpan = spanMap.get(graph.root_span_id);
  if (!coreSpan) {
    reasons.push(`Root span ${graph.root_span_id} not found in spans`);
    return { valid: false, reasons };
  }

  if (coreSpan.type !== 'core') {
    reasons.push(`Root span type is "${coreSpan.type}", expected "core"`);
  }

  // Verify parent_span_id references are valid
  for (const span of graph.spans) {
    if (span.parent_span_id !== null && !spanMap.has(span.parent_span_id)) {
      reasons.push(`Span "${span.name}" (${span.span_id}) references non-existent parent ${span.parent_span_id}`);
    }
  }

  // Find repo-level spans (children of the core span)
  const repoSpans = graph.spans.filter(
    s => s.type === 'repo' && s.parent_span_id === coreSpan.span_id
  );

  if (repoSpans.length === 0) {
    reasons.push('No repo-level child spans exist under the core span');
  }

  // Each repo span must have at least one agent-level child
  for (const repo of repoSpans) {
    const agentSpans = graph.spans.filter(
      s => s.type === 'agent' && s.parent_span_id === repo.span_id
    );
    if (agentSpans.length === 0) {
      reasons.push(`Repo span "${repo.name}" (${repo.span_id}) has zero agent-level child spans`);
    }
  }

  return { valid: reasons.length === 0, reasons };
}
