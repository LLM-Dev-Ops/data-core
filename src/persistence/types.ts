/**
 * Types for the SimulationPersistenceGateway two-phase persistence model.
 *
 * Phase 1 (synchronous acceptance): All three mandatory subsystems must confirm.
 * Phase 2 (async post-validation): Background tasks after acceptance is confirmed.
 */

/** Identifies the kind of simulation data being persisted */
export type PersistenceOperationType =
  | 'context:persist'
  | 'artifact:register'
  | 'data:store'
  | 'lineage:record';

/** Payload submitted to the gateway for persistence */
export interface SimulationPersistenceRequest {
  /** Unique ID for this persistence operation */
  operationId: string;
  /** The type of persistence operation */
  operationType: PersistenceOperationType;
  /** The simulation ID this persistence belongs to */
  simulationId: string;
  /** Primary entity ID (contextId, artifactId, dataId, etc.) */
  entityId: string;
  /** The data payload to persist */
  payload: Record<string, unknown>;
  /** Optional metadata for the operation */
  metadata?: Record<string, unknown>;
}

/** Result from a single subsystem's acceptance phase */
export interface SubsystemAcceptance {
  subsystem: 'memory-graph' | 'data-vault' | 'registry';
  accepted: boolean;
  /** Subsystem-local reference/receipt for the accepted data */
  receipt?: string;
  /** Error message if rejected */
  error?: string;
  /** Timestamp of acceptance */
  acceptedAt?: string;
}

/** Phase 1 acceptance result — all three subsystems must confirm */
export interface AcceptanceResult {
  accepted: boolean;
  operationId: string;
  simulationId: string;
  subsystems: SubsystemAcceptance[];
  /** Set only when accepted === false */
  rejectionReason?: string;
  acceptedAt?: string;
}

/** Phase 2 post-validation task descriptor */
export interface PostValidationTask {
  taskId: string;
  type: 'index' | 'replicate' | 'notify' | 'audit';
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}

/** Final persistence result returned to callers */
export interface SimulationPersistenceResult {
  success: boolean;
  operationId: string;
  simulationId: string;
  acceptance: AcceptanceResult;
  /** Post-validation tasks are fire-and-forget; captures their handles */
  postValidationTasks: PostValidationTask[];
  /** Timestamp of the completed persistence */
  persistedAt: string;
}
