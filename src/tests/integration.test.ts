/**
 * LLM-Data-Core Integration Tests
 */
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { initializeDataCore, createDataCore } from '../index';

describe('LLM-Data-Core Integration', () => {
  test('initializeDataCore creates all components', async () => {
    const core = await initializeDataCore({ simulatorMode: true });

    // Verify adapters are created
    assert.ok(core.adapters.memoryGraph, 'memoryGraph adapter should exist');
    assert.ok(core.adapters.registry, 'registry adapter should exist');
    assert.ok(core.adapters.dataVault, 'dataVault adapter should exist');
    assert.ok(core.adapters.configManager, 'configManager adapter should exist');
    assert.ok(core.adapters.schemaRegistry, 'schemaRegistry adapter should exist');

    // Verify services are created
    assert.ok(core.services.contextCoordinator, 'contextCoordinator service should exist');
    assert.ok(core.services.lineageResolver, 'lineageResolver service should exist');
    assert.ok(core.services.dataAccess, 'dataAccess service should exist');
    assert.ok(core.services.schemaNormalizer, 'schemaNormalizer service should exist');

    // Verify handlers are created
    assert.ok(core.handlers.dataRequest, 'dataRequest handler should exist');
    assert.ok(core.handlers.context, 'context handler should exist');
    assert.ok(core.handlers.artifact, 'artifact handler should exist');
  });

  test('SDK createDataCore factory works', async () => {
    const sdk = await createDataCore({ simulatorMode: true });
    assert.ok(sdk, 'SDK should be created');
  });

  test('context handler persist operation', async () => {
    const core = await initializeDataCore({ simulatorMode: true });
    const result = await core.handlers.context.persist('test-context', { foo: 'bar' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.id, 'test-context');
  });

  test('artifact handler register operation', async () => {
    const core = await initializeDataCore({ simulatorMode: true });
    const result = await core.handlers.artifact.register('test-artifact', { type: 'model', version: '1.0.0' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.id, 'test-artifact');
  });

  test('data request handler get operation', async () => {
    const core = await initializeDataCore({ simulatorMode: true });
    const result = await core.handlers.dataRequest.get('test-data');
    assert.ok(result.dataId, 'dataId should be present');
  });
});
