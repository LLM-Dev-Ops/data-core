import type { IMemoryGraphAdapter } from '../adapters';

/**
 * Resolves data lineage using Memory-Graph adapter.
 * Thin glue layer for lineage traversal and analysis.
 */
export class LineageResolverService {
  constructor(private readonly memoryGraphAdapter: IMemoryGraphAdapter) {}

  async recordLineage(sourceId: string, targetId: string, operation: string): Promise<void> {
    return this.memoryGraphAdapter.recordLineage(sourceId, targetId, operation);
  }

  async trackDataFlow(sourceId: string, targetId: string, transformType: string): Promise<void> {
    return this.memoryGraphAdapter.recordLineage(sourceId, targetId, transformType);
  }
}
