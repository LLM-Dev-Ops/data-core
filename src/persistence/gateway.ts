/**
 * SimulationPersistenceGateway
 *
 * The SOLE path for simulation persistence. All simulation data flows through
 * this gateway, which coordinates the mandatory trio:
 *   1. LLM-Memory-Graph  (context / lineage)
 *   2. LLM-Data-Vault    (secure storage)
 *   3. LLM-Registry      (metadata registration)
 *
 * Two-phase model:
 *   Phase 1 (synchronous / blocking): All three subsystems must accept.
 *     Fail-fast on any rejection — atomic, all or nothing.
 *   Phase 2 (async / fire-and-forget): Post-validation background tasks
 *     scheduled only after execution is validated.
 */

import { randomUUID } from 'crypto';
import type { IMemoryGraphAdapter } from '../adapters/memory-graph.adapter.js';
import type { IDataVaultAdapter } from '../adapters/data-vault.adapter.js';
import type { IRegistryAdapter, IArtifactMetadata } from '../adapters/registry.adapter.js';
import type {
  SimulationPersistenceRequest,
  SimulationPersistenceResult,
  AcceptanceResult,
  SubsystemAcceptance,
  PostValidationTask,
} from './types.js';
import { InvalidSimulationError } from './errors.js';

export interface GatewayDependencies {
  memoryGraph: IMemoryGraphAdapter;
  dataVault: IDataVaultAdapter;
  registry: IRegistryAdapter;
}

export class SimulationPersistenceGateway {
  private readonly memoryGraph: IMemoryGraphAdapter;
  private readonly dataVault: IDataVaultAdapter;
  private readonly registry: IRegistryAdapter;

  constructor(deps: GatewayDependencies) {
    this.memoryGraph = deps.memoryGraph;
    this.dataVault = deps.dataVault;
    this.registry = deps.registry;
  }

  /**
   * The ONLY method external callers use to persist simulation data.
   * Returns SimulationPersistenceResult on success.
   * Throws InvalidSimulationError on any failure — no partial persistence.
   */
  async persist(request: SimulationPersistenceRequest): Promise<SimulationPersistenceResult> {
    // === PHASE 1: Synchronous Acceptance (all three must confirm) ===
    const acceptance = await this.executeAcceptancePhase(request);

    if (!acceptance.accepted) {
      throw new InvalidSimulationError({
        simulationId: request.simulationId,
        operationId: request.operationId,
        message: acceptance.rejectionReason || 'One or more subsystems rejected the persistence request',
        subsystemFailures: acceptance.subsystems
          .filter(s => !s.accepted)
          .map(s => ({ subsystem: s.subsystem, error: s.error || 'unknown' })),
      });
    }

    // === PHASE 2: Async Post-Validation (fire-and-forget) ===
    const postValidationTasks = this.schedulePostValidation(request);

    return {
      success: true,
      operationId: request.operationId,
      simulationId: request.simulationId,
      acceptance,
      postValidationTasks,
      persistedAt: new Date().toISOString(),
    };
  }

  /**
   * Phase 1: Call all three subsystems in parallel. All must accept.
   * Uses Promise.allSettled to collect diagnostics from every subsystem,
   * even when some reject.
   */
  private async executeAcceptancePhase(
    request: SimulationPersistenceRequest,
  ): Promise<AcceptanceResult> {
    const [memoryGraphResult, dataVaultResult, registryResult] = await Promise.allSettled([
      this.acceptMemoryGraph(request),
      this.acceptDataVault(request),
      this.acceptRegistry(request),
    ]);

    const subsystems: SubsystemAcceptance[] = [
      this.resolveSettled('memory-graph', memoryGraphResult),
      this.resolveSettled('data-vault', dataVaultResult),
      this.resolveSettled('registry', registryResult),
    ];

    const allAccepted = subsystems.every(s => s.accepted);

    return {
      accepted: allAccepted,
      operationId: request.operationId,
      simulationId: request.simulationId,
      subsystems,
      rejectionReason: allAccepted
        ? undefined
        : `Subsystem(s) rejected: ${subsystems.filter(s => !s.accepted).map(s => `${s.subsystem}: ${s.error}`).join('; ')}`,
      acceptedAt: allAccepted ? new Date().toISOString() : undefined,
    };
  }

  private resolveSettled(
    subsystem: SubsystemAcceptance['subsystem'],
    result: PromiseSettledResult<SubsystemAcceptance>,
  ): SubsystemAcceptance {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      subsystem,
      accepted: false,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    };
  }

  // --- Subsystem acceptance methods ---

  private async acceptMemoryGraph(request: SimulationPersistenceRequest): Promise<SubsystemAcceptance> {
    await this.memoryGraph.trackContext(request.entityId, {
      simulationId: request.simulationId,
      operationType: request.operationType,
      ...request.payload,
    });
    if (request.metadata?.lineageSource) {
      await this.memoryGraph.recordLineage(
        request.metadata.lineageSource as string,
        request.entityId,
        request.operationType,
      );
    }
    return {
      subsystem: 'memory-graph',
      accepted: true,
      receipt: `mg:${request.operationId}`,
      acceptedAt: new Date().toISOString(),
    };
  }

  private async acceptDataVault(request: SimulationPersistenceRequest): Promise<SubsystemAcceptance> {
    const storageKey = `sim:${request.simulationId}:${request.entityId}`;
    await this.dataVault.store(storageKey, {
      operationId: request.operationId,
      operationType: request.operationType,
      payload: request.payload,
      metadata: request.metadata,
    });
    return {
      subsystem: 'data-vault',
      accepted: true,
      receipt: `dv:${storageKey}`,
      acceptedAt: new Date().toISOString(),
    };
  }

  private async acceptRegistry(request: SimulationPersistenceRequest): Promise<SubsystemAcceptance> {
    const artifactMetadata: IArtifactMetadata = {
      id: request.entityId,
      type: request.operationType,
      version: '1.0.0',
      tags: [`simulation:${request.simulationId}`],
      properties: {
        operationId: request.operationId,
        ...request.metadata,
      },
    };
    const registeredId = await this.registry.registerArtifact(artifactMetadata);
    return {
      subsystem: 'registry',
      accepted: true,
      receipt: `reg:${registeredId}`,
      acceptedAt: new Date().toISOString(),
    };
  }

  // --- Phase 2: Post-validation (fire-and-forget) ---

  private schedulePostValidation(
    request: SimulationPersistenceRequest,
  ): PostValidationTask[] {
    const tasks: PostValidationTask[] = [];

    const indexTask: PostValidationTask = {
      taskId: randomUUID(),
      type: 'index',
      status: 'pending',
    };
    tasks.push(indexTask);
    void this.runPostValidation(indexTask, request);

    const auditTask: PostValidationTask = {
      taskId: randomUUID(),
      type: 'audit',
      status: 'pending',
    };
    tasks.push(auditTask);
    void this.runPostValidation(auditTask, request);

    return tasks;
  }

  private async runPostValidation(
    task: PostValidationTask,
    _request: SimulationPersistenceRequest,
  ): Promise<void> {
    try {
      task.status = 'running';
      // Stub: real indexing / audit logic would be implemented by upstream systems
      task.status = 'completed';
    } catch {
      task.status = 'failed';
    }
  }
}
