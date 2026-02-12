import { randomUUID } from 'crypto';
import type { RegistryAdapter } from '../adapters';
import type { SimulationPersistenceGateway } from '../persistence/index.js';

export interface ArtifactRequest { action: 'register' | 'lookup'; artifactId?: string; metadata?: Record<string, unknown>; }
export interface ArtifactResponse { success: boolean; artifact?: Record<string, unknown>; error?: string; }

export class ArtifactHandler {
  constructor(
    private registry: RegistryAdapter,
    private persistenceGateway: SimulationPersistenceGateway
  ) {}

  async register(artifactId: string, metadata: Record<string, unknown>): Promise<{ success: boolean; id: string }> {
    const result = await this.persistenceGateway.persist({
      operationId: randomUUID(),
      operationType: 'artifact:register',
      simulationId: (metadata.simulationId as string) || artifactId,
      entityId: artifactId,
      payload: metadata,
    });
    return { success: result.success, id: artifactId };
  }

  async lookup(artifactId: string): Promise<Record<string, unknown> | null> {
    const artifact = await this.registry.getArtifact(artifactId);
    return artifact as Record<string, unknown> | null;
  }
}
