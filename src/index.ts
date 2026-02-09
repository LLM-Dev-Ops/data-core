/**
 * LLM-Data-Core - Layer-3 Core Integration Bundle
 *
 * Phase-8 integration module that coordinates:
 * - LLM-Memory-Graph (5): Context tracking and lineage
 * - LLM-Registry (15): Metadata and artifact registration
 * - LLM-Data-Vault (25): Secure storage and anonymization
 * - LLM-Config-Manager (18): Configuration and secrets
 * - LLM-Schema-Registry (19): Data contracts and versioning
 */

// Core initialization
export { initializeDataCore, DataCoreConfig, DataCoreContext } from './lib';

// SDK for programmatic access
export { DataCoreSDK, createDataCore } from './sdk';

// Adapters (for advanced use cases)
export * from './adapters';

// Services (for advanced use cases)
export * from './services';

// Handlers (for advanced use cases)
export * from './handlers';

// Execution span types (for agentics-execution-engine integration)
export * from './execution';
