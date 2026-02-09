/**
 * LLM-Data-Core - Layer-3 Core Integration Bundle
 *
 * Coordinates data persistence, context lineage, and data governance
 * by composing: Memory-Graph, Registry, Data-Vault, Config-Manager, Schema-Registry
 *
 * Instrumented for agentics-execution-engine: emits hierarchical execution spans
 * (Core → Repo → Agent) for every adapter invocation.
 */

import {
  MemoryGraphAdapter,
  RegistryAdapter,
  DataVaultAdapter,
  ConfigManagerAdapter,
  SchemaRegistryAdapter
} from './adapters/index.js';
import {
  ContextCoordinatorService,
  LineageResolverService,
  DataAccessService,
  SchemaNormalizerService
} from './services/index.js';
import { DataRequestHandler, ContextHandler, ArtifactHandler } from './handlers/index.js';
import { SpanContext, instrumentAdapter, finalizeRepoSpans } from './execution/index.js';
import type { CoreExecutionResult } from './execution/index.js';

const CORE_NAME = 'llm-data-core';

/** Repo names matching the upstream systems this Core coordinates */
const REPO_NAMES = {
  memoryGraph: 'llm-memory-graph',
  registry: 'llm-registry',
  dataVault: 'llm-data-vault',
  configManager: 'llm-config-manager',
  schemaRegistry: 'llm-schema-registry',
} as const;

export interface DataCoreConfig {
  simulatorMode?: boolean;
  /** Parent span ID from the calling execution engine */
  parentSpanId?: string | null;
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
  /** Execution span context for the agentics execution graph */
  spanContext: SpanContext;
  /** Finalize the execution graph and return a validated CoreExecutionResult */
  getExecutionResult: () => CoreExecutionResult;
}

/** Initialize LLM-Data-Core with all integrated systems */
export async function initializeDataCore(config: DataCoreConfig = {}): Promise<DataCoreContext> {
  // 1. Create Core-level execution span
  const spanContext = new SpanContext(CORE_NAME, config.parentSpanId ?? null);

  // 2. Initialize adapters and wrap with span instrumentation
  const rawMemoryGraph = new MemoryGraphAdapter();
  const rawRegistry = new RegistryAdapter();
  const rawDataVault = new DataVaultAdapter();
  const rawConfigManager = new ConfigManagerAdapter();
  const rawSchemaRegistry = new SchemaRegistryAdapter();

  const memoryGraph = instrumentAdapter(rawMemoryGraph, {
    repoName: REPO_NAMES.memoryGraph,
    spanContext,
  });
  const registry = instrumentAdapter(rawRegistry, {
    repoName: REPO_NAMES.registry,
    spanContext,
  });
  const dataVault = instrumentAdapter(rawDataVault, {
    repoName: REPO_NAMES.dataVault,
    spanContext,
  });
  const configManager = instrumentAdapter(rawConfigManager, {
    repoName: REPO_NAMES.configManager,
    spanContext,
  });
  const schemaRegistry = instrumentAdapter(rawSchemaRegistry, {
    repoName: REPO_NAMES.schemaRegistry,
    spanContext,
  });

  // Initialize services (glue logic coordinating adapters)
  const contextCoordinator = new ContextCoordinatorService(memoryGraph);
  const lineageResolver = new LineageResolverService(memoryGraph);
  const dataAccess = new DataAccessService(dataVault);
  const schemaNormalizer = new SchemaNormalizerService(schemaRegistry);

  // Initialize handlers (request routing)
  const dataRequest = new DataRequestHandler(dataAccess, schemaNormalizer);
  const context = new ContextHandler(contextCoordinator, lineageResolver);
  const artifact = new ArtifactHandler(registry);

  const getExecutionResult = (): CoreExecutionResult => {
    finalizeRepoSpans(spanContext);
    return spanContext.finalize();
  };

  return {
    adapters: { memoryGraph, registry, dataVault, configManager, schemaRegistry },
    services: { contextCoordinator, lineageResolver, dataAccess, schemaNormalizer },
    handlers: { dataRequest, context, artifact },
    spanContext,
    getExecutionResult,
  };
}
