# LLM-Data-Core

Layer-3 Core Integration Bundle for LLM data coordination.

## Overview

LLM-Data-Core is a coordination layer that orchestrates data persistence, context lineage, and data governance by composing multiple upstream systems:

| Integrated System | Purpose |
|-------------------|---------|
| **LLM-Memory-Graph** | Context tracking and lineage |
| **LLM-Registry** | Metadata and artifact registration |
| **LLM-Data-Vault** | Secure storage and anonymization |
| **LLM-Config-Manager** | Configuration and secrets |
| **LLM-Schema-Registry** | Data contracts and versioning |

## Installation

```bash
npm install llm-data-core
```

## Quick Start

### Programmatic Usage (SDK)

```typescript
import { createDataCore } from 'llm-data-core';

const sdk = await createDataCore();

// Context operations
await sdk.persistContext('session-123', { userId: 'user-1', action: 'query' });
const history = await sdk.queryContext('session-123');
const lineage = await sdk.resolveLineage('artifact-456');

// Artifact operations
await sdk.registerArtifact('model-v1', { type: 'model', version: '1.0.0' });
const artifact = await sdk.lookupArtifact('model-v1');

// Data operations
const data = await sdk.getData('dataset-789', { schema: 'user-profile-v1' });
const schema = await sdk.resolveSchema('user-profile');
const normalized = await sdk.normalizeData(rawData, 'user-profile-v1');

// Configuration
const config = await sdk.getConfig('feature.enabled');
```

### Direct Initialization

```typescript
import { initializeDataCore } from 'llm-data-core';

const core = await initializeDataCore({ simulatorMode: true });

// Access adapters directly
await core.adapters.memoryGraph.trackContext('ctx-1', { timestamp: Date.now() });
await core.adapters.registry.registerArtifact({ id: 'art-1', type: 'model', version: '1.0.0' });

// Use services
await core.services.contextCoordinator.trackContext('ctx-1', { sessionId: 'sess-1', timestamp: Date.now() });
await core.services.lineageResolver.recordLineage('source-1', 'target-1', 'transform');

// Use handlers
await core.handlers.context.persist('ctx-1', { data: 'value' });
await core.handlers.artifact.register('art-1', { type: 'dataset' });
```

## CLI Usage

```bash
# Context operations
data-core context:persist <contextId> '<json-data>'
data-core context:query <contextId>
data-core lineage:resolve <artifactId>

# Artifact operations
data-core artifact:register <artifactId> '<json-metadata>'
data-core artifact:lookup <artifactId>

# Data operations
data-core data:get <dataId> '<json-options>'
data-core schema:resolve <dataType>
data-core schema:normalize '<json-data>' <schemaId>

# Configuration
data-core config:get <key>

# Help
data-core help
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        SDK / CLI                            │
├─────────────────────────────────────────────────────────────┤
│                        Handlers                             │
│   DataRequestHandler │ ContextHandler │ ArtifactHandler     │
├─────────────────────────────────────────────────────────────┤
│                        Services                             │
│  ContextCoordinator │ LineageResolver │ DataAccess │ Schema │
├─────────────────────────────────────────────────────────────┤
│                        Adapters                             │
│ MemoryGraph │ Registry │ DataVault │ ConfigManager │ Schema │
├─────────────────────────────────────────────────────────────┤
│                   External Systems                          │
│  LLM-Memory-Graph │ LLM-Registry │ LLM-Data-Vault │ ...    │
└─────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

- **Adapters**: Thin wrappers providing interfaces to external systems
- **Services**: Glue logic coordinating adapter operations
- **Handlers**: Request routing and response formatting
- **SDK/CLI**: User-facing interfaces for programmatic and command-line access

## API Reference

### DataCoreSDK

| Method | Description |
|--------|-------------|
| `persistContext(contextId, data)` | Persist context data via Memory-Graph |
| `queryContext(query)` | Query context by ID or pattern |
| `resolveLineage(artifactId)` | Resolve data lineage for an artifact |
| `registerArtifact(artifactId, metadata)` | Register artifact via Registry |
| `lookupArtifact(artifactId)` | Lookup artifact by ID |
| `getData(dataId, options?)` | Get secure data via Data-Vault |
| `resolveSchema(dataType)` | Resolve schema for data type |
| `normalizeData(data, schemaId)` | Get schema-normalized view of data |
| `getConfig(key)` | Get configuration value |

### Configuration

```typescript
interface DataCoreConfig {
  simulatorMode?: boolean;  // Enable simulator mode for testing
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Type check
npm run lint

# Clean build artifacts
npm run clean
```

## Testing

The project uses Node.js built-in test runner:

```bash
npm test
```

Tests cover:
- Component initialization
- SDK factory creation
- Context persistence operations
- Artifact registration operations
- Data request operations

## Design Principles

This module follows Layer-3 integration patterns:

1. **Coordination Only**: All core functionality is delegated to upstream systems
2. **No Infrastructure Duplication**: No retry logic, circuit breakers, logging configuration, metrics registries, or caching engines
3. **Thin Adapters**: Adapters define interfaces and delegate without implementing business logic
4. **Product Boundary Compliance**: No re-implementation of engines, algorithms, or storage owned by integrated systems

## License

UNLICENSED
