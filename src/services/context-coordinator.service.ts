import type { IMemoryGraphAdapter } from '../adapters';

export interface ContextMetadata {
  sessionId: string;
  timestamp: number;
  userId?: string;
  tags?: string[];
  [key: string]: unknown;
}

/**
 * Coordinates context persistence via Memory-Graph adapter.
 * Thin glue layer that delegates all operations to the adapter.
 */
export class ContextCoordinatorService {
  constructor(private readonly memoryGraphAdapter: IMemoryGraphAdapter) {}

  async trackContext(contextId: string, metadata: ContextMetadata): Promise<void> {
    return this.memoryGraphAdapter.trackContext(contextId, metadata);
  }

  async getHistory(contextId: string): Promise<unknown[]> {
    return this.memoryGraphAdapter.getContextHistory(contextId);
  }

  async pruneOldContext(contextId: string, beforeTimestamp: number): Promise<void> {
    return this.memoryGraphAdapter.pruneContext(contextId, beforeTimestamp);
  }
}
