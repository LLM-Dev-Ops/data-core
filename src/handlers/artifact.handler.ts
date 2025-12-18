import type { RegistryAdapter, IArtifactMetadata } from '../adapters';

export interface ArtifactRequest { action: 'register' | 'lookup'; artifactId?: string; metadata?: Record<string, unknown>; }
export interface ArtifactResponse { success: boolean; artifact?: Record<string, unknown>; error?: string; }

export class ArtifactHandler {
  constructor(private registry: RegistryAdapter) {}

  async register(artifactId: string, metadata: Record<string, unknown>): Promise<{ success: boolean; id: string }> {
    const artifact: IArtifactMetadata = {
      id: artifactId,
      type: (metadata.type as string) || 'unknown',
      version: (metadata.version as string) || '1.0.0',
      tags: metadata.tags as string[],
      properties: metadata
    };
    const id = await this.registry.registerArtifact(artifact);
    return { success: true, id };
  }

  async lookup(artifactId: string): Promise<Record<string, unknown> | null> {
    const artifact = await this.registry.getArtifact(artifactId);
    return artifact as Record<string, unknown> | null;
  }
}
