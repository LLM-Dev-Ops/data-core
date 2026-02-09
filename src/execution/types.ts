/**
 * Execution span types for agentics-execution-engine integration.
 *
 * Hierarchy invariant (non-negotiable):
 *   Execution
 *     └─ Core (this repo)
 *         └─ Repo (invoked upstream system)
 *             └─ Agent (executed operation)
 */

export interface ExecutionArtifact {
  id: string;
  type: string;
  reference: string;
}

export interface ExecutionEvidence {
  id: string;
  type: string;
  uri: string;
  hash?: string;
}

export interface ExecutionSpan {
  span_id: string;
  parent_span_id: string | null;
  type: 'core' | 'repo' | 'agent';
  name: string;
  start_time: string;
  end_time?: string;
  status: 'running' | 'completed' | 'failed';
  error?: string;
  artifacts?: ExecutionArtifact[];
  evidence?: ExecutionEvidence[];
}

export interface ExecutionGraph {
  root_span_id: string;
  spans: ExecutionSpan[];
  metadata: {
    core_name: string;
    created_at: string;
    version: string;
  };
}

export interface CoreExecutionResult {
  success: boolean;
  execution_graph: ExecutionGraph;
  failure_reasons?: string[];
}

export interface SpanCreationOptions {
  parent_span_id: string | null;
  type: ExecutionSpan['type'];
  name: string;
  artifacts?: ExecutionArtifact[];
  evidence?: ExecutionEvidence[];
}
