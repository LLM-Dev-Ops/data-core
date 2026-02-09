/**
 * LLM-Data-Core SDK - Programmatic interface for data coordination
 *
 * Instrumented: exposes getExecutionResult() to retrieve the
 * hierarchical execution graph conforming to CoreExecutionResult.
 */

import { initializeDataCore, DataCoreConfig, DataCoreContext } from './lib.js';
import type { CoreExecutionResult } from './execution/index.js';

export class DataCoreSDK {
  private context: DataCoreContext | null = null;
  private config: DataCoreConfig;

  constructor(config: DataCoreConfig = {}) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    this.context = await initializeDataCore(this.config);
  }

  private ensureInitialized(): DataCoreContext {
    if (!this.context) throw new Error('SDK not initialized. Call initialize() first.');
    return this.context;
  }

  // Context Operations
  async persistContext(contextId: string, data: Record<string, unknown>): Promise<{ success: boolean; id: string }> {
    return this.ensureInitialized().handlers.context.persist(contextId, data);
  }

  async queryContext(query: string): Promise<Record<string, unknown>[]> {
    return this.ensureInitialized().handlers.context.query(query);
  }

  async resolveLineage(artifactId: string): Promise<{ lineage: string[]; metadata: Record<string, unknown> }> {
    return this.ensureInitialized().handlers.context.resolveLineage(artifactId);
  }

  // Artifact Operations
  async registerArtifact(artifactId: string, metadata: Record<string, unknown>): Promise<{ success: boolean; id: string }> {
    return this.ensureInitialized().handlers.artifact.register(artifactId, metadata);
  }

  async lookupArtifact(artifactId: string): Promise<Record<string, unknown> | null> {
    return this.ensureInitialized().handlers.artifact.lookup(artifactId);
  }

  // Data Operations
  async getData(dataId: string, options?: { schema?: string }): Promise<Record<string, unknown>> {
    return this.ensureInitialized().handlers.dataRequest.get(dataId, options || {});
  }

  async resolveSchema(dataType: string): Promise<Record<string, unknown>> {
    return this.ensureInitialized().handlers.dataRequest.resolveSchema(dataType);
  }

  async normalizeData(data: Record<string, unknown>, schemaId: string): Promise<Record<string, unknown>> {
    return this.ensureInitialized().handlers.dataRequest.normalize(data, schemaId);
  }

  // Config Access
  async getConfig(key: string): Promise<unknown> {
    return this.ensureInitialized().adapters.configManager.getConfig(key);
  }

  // Execution Graph
  getExecutionResult(): CoreExecutionResult {
    return this.ensureInitialized().getExecutionResult();
  }
}

/** Factory function for quick initialization */
export async function createDataCore(config: DataCoreConfig = {}): Promise<DataCoreSDK> {
  const sdk = new DataCoreSDK(config);
  await sdk.initialize();
  return sdk;
}

export { DataCoreConfig, DataCoreContext } from './lib.js';
