/**
 * LLM-Data-Core - Layer-3 Core Integration Bundle
 *
 * Coordinates data persistence, context lineage, and data governance
 * by composing: Memory-Graph, Registry, Data-Vault, Config-Manager, Schema-Registry
 */

import {
  MemoryGraphAdapter,
  RegistryAdapter,
  DataVaultAdapter,
  ConfigManagerAdapter,
  SchemaRegistryAdapter
} from './adapters';
import {
  ContextCoordinatorService,
  LineageResolverService,
  DataAccessService,
  SchemaNormalizerService
} from './services';
import { DataRequestHandler, ContextHandler, ArtifactHandler } from './handlers';

export interface DataCoreConfig {
  simulatorMode?: boolean;
}

export interface DataCoreContext {
  adapters: {
    memoryGraph: MemoryGraphAdapter;
    registry: RegistryAdapter;
    dataVault: DataVaultAdapter;
    configManager: ConfigManagerAdapter;
    schemaRegistry: SchemaRegistryAdapter;
  };
  services: {
    contextCoordinator: ContextCoordinatorService;
    lineageResolver: LineageResolverService;
    dataAccess: DataAccessService;
    schemaNormalizer: SchemaNormalizerService;
  };
  handlers: {
    dataRequest: DataRequestHandler;
    context: ContextHandler;
    artifact: ArtifactHandler;
  };
}

/** Initialize LLM-Data-Core with all integrated systems */
export async function initializeDataCore(config: DataCoreConfig = {}): Promise<DataCoreContext> {
  // Initialize adapters (thin wrappers to integrated systems)
  const configManager = new ConfigManagerAdapter();
  const schemaRegistry = new SchemaRegistryAdapter();
  const memoryGraph = new MemoryGraphAdapter();
  const registry = new RegistryAdapter();
  const dataVault = new DataVaultAdapter();

  // Initialize services (glue logic coordinating adapters)
  const contextCoordinator = new ContextCoordinatorService(memoryGraph);
  const lineageResolver = new LineageResolverService(memoryGraph);
  const dataAccess = new DataAccessService(dataVault);
  const schemaNormalizer = new SchemaNormalizerService(schemaRegistry);

  // Initialize handlers (request routing)
  const dataRequest = new DataRequestHandler(dataAccess, schemaNormalizer);
  const context = new ContextHandler(contextCoordinator, lineageResolver);
  const artifact = new ArtifactHandler(registry);

  return {
    adapters: { memoryGraph, registry, dataVault, configManager, schemaRegistry },
    services: { contextCoordinator, lineageResolver, dataAccess, schemaNormalizer },
    handlers: { dataRequest, context, artifact }
  };
}
