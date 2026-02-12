import { randomUUID } from 'crypto';
import type { ContextCoordinatorService, LineageResolverService } from '../services';
import type { SimulationPersistenceGateway } from '../persistence/index.js';

export interface ContextRequest { action: 'persist' | 'query' | 'lineage'; contextId?: string; data?: Record<string, unknown>; }
export interface ContextResponse { success: boolean; data?: unknown; error?: string; }

export class ContextHandler {
  constructor(
    private contextCoordinator: ContextCoordinatorService,
    private lineageResolver: LineageResolverService,
    private persistenceGateway: SimulationPersistenceGateway
  ) {}

  async persist(contextId: string, data: Record<string, unknown>): Promise<{ success: boolean; id: string }> {
    const result = await this.persistenceGateway.persist({
      operationId: randomUUID(),
      operationType: 'context:persist',
      simulationId: (data.simulationId as string) || contextId,
      entityId: contextId,
      payload: { sessionId: contextId, timestamp: Date.now(), ...data },
      metadata: data.lineageSource ? { lineageSource: data.lineageSource } : undefined,
    });
    return { success: result.success, id: contextId };
  }

  async query(contextId: string): Promise<Record<string, unknown>[]> {
    const history = await this.contextCoordinator.getHistory(contextId);
    return history as Record<string, unknown>[];
  }

  async resolveLineage(artifactId: string): Promise<{ lineage: string[]; metadata: Record<string, unknown> }> {
    await this.lineageResolver.recordLineage(artifactId, artifactId, 'query');
    return { lineage: [artifactId], metadata: { resolvedAt: Date.now() } };
  }
}
