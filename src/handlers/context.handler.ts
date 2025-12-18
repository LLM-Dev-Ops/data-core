import type { ContextCoordinatorService, LineageResolverService, ContextMetadata } from '../services';

export interface ContextRequest { action: 'persist' | 'query' | 'lineage'; contextId?: string; data?: Record<string, unknown>; }
export interface ContextResponse { success: boolean; data?: unknown; error?: string; }

export class ContextHandler {
  constructor(
    private contextCoordinator: ContextCoordinatorService,
    private lineageResolver: LineageResolverService
  ) {}

  async persist(contextId: string, data: Record<string, unknown>): Promise<{ success: boolean; id: string }> {
    const metadata: ContextMetadata = { sessionId: contextId, timestamp: Date.now(), ...data };
    await this.contextCoordinator.trackContext(contextId, metadata);
    return { success: true, id: contextId };
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
