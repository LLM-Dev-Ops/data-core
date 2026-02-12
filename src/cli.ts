#!/usr/bin/env node
/**
 * LLM-Data-Core CLI - Command-line interface for data coordination
 */

import { randomUUID } from 'crypto';
import { initializeDataCore } from './lib';
import { isInvalidSimulationError } from './persistence/index.js';

const COMMANDS: Record<string, string> = {
  'context:persist': 'Persist context data (via gateway)',
  'context:query': 'Query context by ID or pattern',
  'lineage:resolve': 'Resolve data lineage for an artifact',
  'artifact:register': 'Register artifact (via gateway)',
  'artifact:lookup': 'Lookup artifact by ID',
  'data:store': 'Store data (via gateway)',
  'data:get': 'Get secure data via Data-Vault',
  'schema:resolve': 'Resolve schema for data type',
  'schema:normalize': 'Get schema-normalized view of data',
  'simulation:persist': 'Persist simulation data (direct gateway)',
  'config:get': 'Get configuration value',
  'help': 'Show this help message'
};

async function main(): Promise<void> {
  const [,, command, ...args] = process.argv;

  if (!command || command === 'help') {
    console.log('LLM-Data-Core CLI\n\nUsage: data-core <command> [args]\n\nCommands:');
    Object.entries(COMMANDS).forEach(([cmd, desc]) => console.log(`  ${cmd.padEnd(20)} ${desc}`));
    return;
  }

  const core = await initializeDataCore({ simulatorMode: true });

  switch (command) {
    case 'context:persist': {
      const [contextId, data] = args;
      const result = await core.handlers.context.persist(contextId, JSON.parse(data || '{}'));
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'context:query': {
      const [query] = args;
      const result = await core.handlers.context.query(query);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'lineage:resolve': {
      const [artifactId] = args;
      const result = await core.handlers.context.resolveLineage(artifactId);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'artifact:register': {
      const [artifactId, metadata] = args;
      const result = await core.handlers.artifact.register(artifactId, JSON.parse(metadata || '{}'));
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'artifact:lookup': {
      const [artifactId] = args;
      const result = await core.handlers.artifact.lookup(artifactId);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'data:get': {
      const [dataId, options] = args;
      const result = await core.handlers.dataRequest.get(dataId, JSON.parse(options || '{}'));
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'schema:resolve': {
      const [dataType] = args;
      const result = await core.handlers.dataRequest.resolveSchema(dataType);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'schema:normalize': {
      const [data, schemaId] = args;
      const result = await core.handlers.dataRequest.normalize(JSON.parse(data || '{}'), schemaId);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'data:store': {
      const [dataId, data] = args;
      const result = await core.handlers.dataRequest.store(dataId, JSON.parse(data || '{}'));
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'simulation:persist': {
      const [simulationId, entityId, data] = args;
      const result = await core.persistenceGateway.persist({
        operationId: randomUUID(),
        operationType: 'context:persist',
        simulationId,
        entityId,
        payload: JSON.parse(data || '{}'),
      });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'config:get': {
      const [key] = args;
      const result = await core.adapters.configManager.getConfig(key);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    default:
      console.error(`Unknown command: ${command}\nRun "data-core help" for usage`);
      process.exit(1);
  }
}

main().catch(err => {
  if (isInvalidSimulationError(err)) {
    console.error(`INVALID SIMULATION [${err.simulationId}]: ${err.message}`);
    console.error('Subsystem failures:', JSON.stringify(err.subsystemFailures, null, 2));
    process.exit(2);
  }
  console.error('Error:', err.message);
  process.exit(1);
});
