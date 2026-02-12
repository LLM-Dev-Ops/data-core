/**
 * LLM-Data-Core Integration Tests
 */
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { initializeDataCore, createDataCore } from '../index';
import { InvalidSimulationError, isInvalidSimulationError } from '../persistence/index';
import type { ExecutionSpan, CoreExecutionResult } from '../execution';

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

    // Verify persistence gateway is created
    assert.ok(core.persistenceGateway, 'persistenceGateway should exist');
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

describe('SimulationPersistenceGateway', () => {
  test('persist invokes all three mandatory subsystems', async () => {
    const core = await initializeDataCore({ simulatorMode: true });
    const result = await core.persistenceGateway.persist({
      operationId: 'op-1',
      operationType: 'context:persist',
      simulationId: 'sim-1',
      entityId: 'entity-1',
      payload: { key: 'value' },
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.acceptance.accepted, true);
    assert.strictEqual(result.acceptance.subsystems.length, 3);

    const subsystemNames = result.acceptance.subsystems.map(s => s.subsystem).sort();
    assert.deepStrictEqual(subsystemNames, ['data-vault', 'memory-graph', 'registry']);

    for (const sub of result.acceptance.subsystems) {
      assert.strictEqual(sub.accepted, true, `${sub.subsystem} should have accepted`);
      assert.ok(sub.receipt, `${sub.subsystem} should have a receipt`);
    }
  });

  test('persist creates execution spans for all three subsystems', async () => {
    const core = await initializeDataCore({ simulatorMode: true });
    await core.persistenceGateway.persist({
      operationId: 'op-2',
      operationType: 'artifact:register',
      simulationId: 'sim-2',
      entityId: 'entity-2',
      payload: { type: 'model' },
    });

    const spans = core.spanContext.getSpans();
    const repoSpans = spans.filter(s => s.type === 'repo');
    const repoNames = repoSpans.map(s => s.name);

    assert.ok(repoNames.includes('llm-memory-graph'), 'memory-graph repo span must exist');
    assert.ok(repoNames.includes('llm-data-vault'), 'data-vault repo span must exist');
    assert.ok(repoNames.includes('llm-registry'), 'registry repo span must exist');
  });

  test('acceptance phase is synchronous (all settled before return)', async () => {
    const core = await initializeDataCore({ simulatorMode: true });
    const result = await core.persistenceGateway.persist({
      operationId: 'op-3',
      operationType: 'context:persist',
      simulationId: 'sim-3',
      entityId: 'entity-3',
      payload: {},
    });

    for (const sub of result.acceptance.subsystems) {
      assert.ok(sub.acceptedAt, `${sub.subsystem} should have acceptedAt timestamp`);
    }
    assert.ok(result.acceptance.acceptedAt, 'overall acceptedAt should be set');
    assert.ok(result.persistedAt >= result.acceptance.acceptedAt!,
      'persistedAt should be after or equal to acceptedAt');
  });

  test('post-validation tasks are scheduled after acceptance', async () => {
    const core = await initializeDataCore({ simulatorMode: true });
    const result = await core.persistenceGateway.persist({
      operationId: 'op-4',
      operationType: 'context:persist',
      simulationId: 'sim-4',
      entityId: 'entity-4',
      payload: {},
    });

    assert.ok(result.postValidationTasks.length > 0, 'should have post-validation tasks');
    for (const task of result.postValidationTasks) {
      assert.ok(task.taskId, 'task should have an ID');
      assert.ok(['index', 'replicate', 'notify', 'audit'].includes(task.type));
    }
  });

  test('handler persist operations flow through gateway (all three repos invoked)', async () => {
    const core = await initializeDataCore({ simulatorMode: true });

    await core.handlers.context.persist('ctx-gw-1', { simulationId: 'sim-5' });

    const spans = core.spanContext.getSpans();
    const repoNames = spans.filter(s => s.type === 'repo').map(s => s.name);
    assert.ok(repoNames.includes('llm-memory-graph'));
    assert.ok(repoNames.includes('llm-data-vault'));
    assert.ok(repoNames.includes('llm-registry'));
  });

  test('artifact register flows through gateway (all three repos invoked)', async () => {
    const core = await initializeDataCore({ simulatorMode: true });

    await core.handlers.artifact.register('art-gw-1', { type: 'model', version: '1.0' });

    const spans = core.spanContext.getSpans();
    const repoNames = spans.filter(s => s.type === 'repo').map(s => s.name);
    assert.ok(repoNames.includes('llm-memory-graph'));
    assert.ok(repoNames.includes('llm-data-vault'));
    assert.ok(repoNames.includes('llm-registry'));
  });

  test('data store flows through gateway (all three repos invoked)', async () => {
    const core = await initializeDataCore({ simulatorMode: true });

    await core.handlers.dataRequest.store('data-gw-1', { value: 42 });

    const spans = core.spanContext.getSpans();
    const repoNames = spans.filter(s => s.type === 'repo').map(s => s.name);
    assert.ok(repoNames.includes('llm-memory-graph'));
    assert.ok(repoNames.includes('llm-data-vault'));
    assert.ok(repoNames.includes('llm-registry'));
  });

  test('execution graph remains valid after gateway operations', async () => {
    const core = await initializeDataCore({ simulatorMode: true });

    await core.persistenceGateway.persist({
      operationId: 'op-valid',
      operationType: 'context:persist',
      simulationId: 'sim-valid',
      entityId: 'entity-valid',
      payload: { key: 'value' },
    });

    const result = core.getExecutionResult();
    assert.strictEqual(result.success, true, 'execution graph should be valid');
    assert.strictEqual(result.failure_reasons, undefined, 'no failure reasons');

    const spans = result.execution_graph.spans;
    const coreSpans = spans.filter(s => s.type === 'core');
    const repoSpans = spans.filter(s => s.type === 'repo');
    const agentSpans = spans.filter(s => s.type === 'agent');

    assert.strictEqual(coreSpans.length, 1, 'exactly one core span');
    assert.ok(repoSpans.length >= 3, 'at least three repo spans (mandatory trio)');
    assert.ok(agentSpans.length >= 3, 'at least three agent spans');
  });

  test('SDK persistSimulation method works', async () => {
    const sdk = await createDataCore({ simulatorMode: true });
    const result = await sdk.persistSimulation({
      operationId: 'sdk-op-1',
      operationType: 'context:persist',
      simulationId: 'sdk-sim-1',
      entityId: 'sdk-entity-1',
      payload: { key: 'val' },
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.acceptance.accepted, true);
    assert.strictEqual(result.acceptance.subsystems.length, 3);
  });

  test('SDK storeData method works', async () => {
    const sdk = await createDataCore({ simulatorMode: true });
    const result = await sdk.storeData('data-sdk-1', { value: 'test' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.id, 'data-sdk-1');
  });
});

describe('InvalidSimulationError', () => {
  test('is a proper Error subclass', () => {
    const err = new InvalidSimulationError({
      simulationId: 'sim-x',
      operationId: 'op-x',
      message: 'test failure',
      subsystemFailures: [{ subsystem: 'data-vault', error: 'connection refused' }],
    });

    assert.ok(err instanceof Error);
    assert.ok(err instanceof InvalidSimulationError);
    assert.strictEqual(err.isTerminal, true);
    assert.strictEqual(err.simulationId, 'sim-x');
    assert.strictEqual(err.subsystemFailures.length, 1);
  });

  test('isInvalidSimulationError type guard works', () => {
    const err = new InvalidSimulationError({
      simulationId: 'sim-y',
      operationId: 'op-y',
      message: 'test',
      subsystemFailures: [],
    });
    assert.ok(isInvalidSimulationError(err));
    assert.ok(!isInvalidSimulationError(new Error('regular error')));
    assert.ok(!isInvalidSimulationError(null));
  });

  test('InvalidSimulationError is frozen (immutable)', () => {
    const err = new InvalidSimulationError({
      simulationId: 'sim-z',
      operationId: 'op-z',
      message: 'frozen test',
      subsystemFailures: [],
    });
    assert.throws(() => {
      (err as any).simulationId = 'tampered';
    }, 'should not allow modification of simulationId');
  });
});

describe('Execution Graph Instrumentation', () => {
  test('core span is created on initialization', async () => {
    const core = await initializeDataCore({ simulatorMode: true });
    const spans = core.spanContext.getSpans();

    const coreSpan = spans.find(s => s.type === 'core');
    assert.ok(coreSpan, 'core span should exist');
    assert.strictEqual(coreSpan!.name, 'llm-data-core');
    assert.strictEqual(coreSpan!.status, 'running');
    assert.ok(coreSpan!.span_id, 'core span should have an ID');
    assert.ok(coreSpan!.start_time, 'core span should have a start_time');
  });

  test('core span accepts parent_span_id from caller', async () => {
    const parentId = 'external-engine-span-123';
    const core = await initializeDataCore({ simulatorMode: true, parentSpanId: parentId });
    const spans = core.spanContext.getSpans();

    const coreSpan = spans.find(s => s.type === 'core');
    assert.strictEqual(coreSpan!.parent_span_id, parentId);
  });

  test('adapter call creates repo + agent spans', async () => {
    const core = await initializeDataCore({ simulatorMode: true });

    // Call an adapter method (via handler — now routes through gateway)
    await core.handlers.context.persist('ctx-1', { key: 'value' });

    const spans = core.spanContext.getSpans();
    const repoSpans = spans.filter(s => s.type === 'repo');
    const agentSpans = spans.filter(s => s.type === 'agent');

    assert.ok(repoSpans.length > 0, 'at least one repo span should exist');
    assert.ok(agentSpans.length > 0, 'at least one agent span should exist');

    // Repo span should be child of core span
    const coreSpan = spans.find(s => s.type === 'core')!;
    for (const repo of repoSpans) {
      assert.strictEqual(repo.parent_span_id, coreSpan.span_id, 'repo span parent should be core span');
    }

    // Agent span should be child of a repo span
    const repoSpanIds = new Set(repoSpans.map(s => s.span_id));
    for (const agent of agentSpans) {
      assert.ok(repoSpanIds.has(agent.parent_span_id!), 'agent span parent should be a repo span');
    }
  });

  test('multiple adapter calls produce correct hierarchy', async () => {
    const core = await initializeDataCore({ simulatorMode: true });

    // Touch multiple adapters through different handlers (all now via gateway)
    await core.handlers.context.persist('ctx-1', {});
    await core.handlers.artifact.register('art-1', { type: 'model', version: '1.0' });
    await core.handlers.dataRequest.get('data-1');

    const spans = core.spanContext.getSpans();
    const repoSpans = spans.filter(s => s.type === 'repo');
    const agentSpans = spans.filter(s => s.type === 'agent');

    // Should have repo spans for memory-graph, registry, and data-vault
    const repoNames = repoSpans.map(s => s.name);
    assert.ok(repoNames.includes('llm-memory-graph'), 'memory-graph repo span should exist');
    assert.ok(repoNames.includes('llm-registry'), 'registry repo span should exist');
    assert.ok(repoNames.includes('llm-data-vault'), 'data-vault repo span should exist');

    // Each repo should have agent children
    for (const repo of repoSpans) {
      const children = agentSpans.filter(a => a.parent_span_id === repo.span_id);
      assert.ok(children.length > 0, `repo "${repo.name}" should have agent children`);
    }
  });

  test('agent span names include repo and method', async () => {
    const core = await initializeDataCore({ simulatorMode: true });
    await core.handlers.context.persist('ctx-1', {});

    const spans = core.spanContext.getSpans();
    const agentSpans = spans.filter(s => s.type === 'agent');

    // Agent names should be formatted as "repoName.methodName"
    for (const agent of agentSpans) {
      assert.ok(agent.name.includes('.'), `agent name "${agent.name}" should contain dot separator`);
    }
  });

  test('completed agent spans have end_time and completed status', async () => {
    const core = await initializeDataCore({ simulatorMode: true });
    await core.handlers.context.persist('ctx-1', {});

    const spans = core.spanContext.getSpans();
    const agentSpans = spans.filter(s => s.type === 'agent');

    for (const agent of agentSpans) {
      assert.strictEqual(agent.status, 'completed', `agent "${agent.name}" should be completed`);
      assert.ok(agent.end_time, `agent "${agent.name}" should have end_time`);
    }
  });

  test('getExecutionResult produces valid CoreExecutionResult', async () => {
    const core = await initializeDataCore({ simulatorMode: true });

    // Invoke at least one adapter to create repo+agent spans
    await core.handlers.context.persist('ctx-1', {});

    const result = core.getExecutionResult();

    // Structure checks
    assert.ok(result.execution_graph, 'execution_graph should exist');
    assert.ok(result.execution_graph.root_span_id, 'root_span_id should exist');
    assert.ok(result.execution_graph.spans.length > 0, 'spans should not be empty');
    assert.ok(result.execution_graph.metadata, 'metadata should exist');
    assert.strictEqual(result.execution_graph.metadata.core_name, 'llm-data-core');

    // Hierarchy invariant: Core → Repo → Agent
    const spans = result.execution_graph.spans;
    const coreSpans = spans.filter(s => s.type === 'core');
    const repoSpans = spans.filter(s => s.type === 'repo');
    const agentSpans = spans.filter(s => s.type === 'agent');

    assert.strictEqual(coreSpans.length, 1, 'exactly one core span');
    assert.ok(repoSpans.length >= 1, 'at least one repo span');
    assert.ok(agentSpans.length >= 1, 'at least one agent span');

    // Success because hierarchy is complete
    assert.strictEqual(result.success, true, 'result should be successful');
    assert.strictEqual(result.failure_reasons, undefined, 'no failure reasons');
  });

  test('getExecutionResult fails without repo spans', async () => {
    const core = await initializeDataCore({ simulatorMode: true });

    // No adapter calls → no repo/agent spans → must fail validation
    const result = core.getExecutionResult();

    assert.strictEqual(result.success, false, 'result should fail without repo spans');
    assert.ok(result.failure_reasons, 'failure_reasons should be present');
    assert.ok(result.failure_reasons!.length > 0, 'should have at least one failure reason');
    assert.ok(
      result.failure_reasons!.some(r => r.includes('No repo-level child spans')),
      'failure reason should mention missing repo spans'
    );

    // Execution graph must still be returned on failure
    assert.ok(result.execution_graph, 'execution_graph must be returned on failure');
    assert.ok(result.execution_graph.spans.length > 0, 'spans must be present even on failure');
  });

  test('execution graph is JSON-serializable', async () => {
    const core = await initializeDataCore({ simulatorMode: true });
    await core.handlers.context.persist('ctx-1', {});
    await core.handlers.artifact.register('art-1', { type: 'model', version: '1.0' });

    const result = core.getExecutionResult();
    const jsonStr = JSON.stringify(result);
    const parsed = JSON.parse(jsonStr) as CoreExecutionResult;

    assert.deepStrictEqual(parsed, result, 'round-trip JSON serialization should be lossless');
  });

  test('execution graph preserves causal ordering via parent_span_id', async () => {
    const core = await initializeDataCore({ simulatorMode: true });
    await core.handlers.context.persist('ctx-1', {});

    const result = core.getExecutionResult();
    const spanMap = new Map<string, ExecutionSpan>();
    for (const span of result.execution_graph.spans) {
      spanMap.set(span.span_id, span);
    }

    // Every span (except root) should have a valid parent
    for (const span of result.execution_graph.spans) {
      if (span.parent_span_id !== null) {
        assert.ok(
          spanMap.has(span.parent_span_id),
          `span "${span.name}" parent ${span.parent_span_id} should exist in graph`
        );
      }
    }
  });

  test('execution graph is append-only (spans accumulate)', async () => {
    const core = await initializeDataCore({ simulatorMode: true });

    await core.handlers.context.persist('ctx-1', {});
    const count1 = core.spanContext.getSpans().length;

    await core.handlers.artifact.register('art-1', { type: 'model', version: '1.0' });
    const count2 = core.spanContext.getSpans().length;

    assert.ok(count2 > count1, 'span count should increase with more operations');
  });

  test('SDK exposes getExecutionResult', async () => {
    const sdk = await createDataCore({ simulatorMode: true });
    await sdk.persistContext('ctx-1', { key: 'val' });

    const result = sdk.getExecutionResult();
    assert.ok(result.execution_graph, 'SDK should expose execution graph');
    assert.strictEqual(result.success, true);
  });

  test('all span IDs are unique UUIDs', async () => {
    const core = await initializeDataCore({ simulatorMode: true });
    await core.handlers.context.persist('ctx-1', {});
    await core.handlers.artifact.register('art-1', { type: 'model', version: '1.0' });
    await core.handlers.dataRequest.get('data-1');

    const result = core.getExecutionResult();
    const ids = result.execution_graph.spans.map(s => s.span_id);
    const uniqueIds = new Set(ids);

    assert.strictEqual(ids.length, uniqueIds.size, 'all span IDs should be unique');

    // UUID format check
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const id of ids) {
      assert.ok(uuidRegex.test(id), `span ID "${id}" should be a valid UUID`);
    }
  });
});
