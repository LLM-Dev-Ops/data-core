/**
 * SimulationPersistenceGateway Failure Scenario Tests
 *
 * Verifies that Data-Core failure invalidates the simulation.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SimulationPersistenceGateway, InvalidSimulationError, isInvalidSimulationError } from '../persistence/index';
import { MemoryGraphAdapter, DataVaultAdapter, RegistryAdapter } from '../adapters/index';

function createFailingGateway(failSubsystem: 'memory-graph' | 'data-vault' | 'registry'): SimulationPersistenceGateway {
  const memoryGraph = new MemoryGraphAdapter();
  const dataVault = new DataVaultAdapter();
  const registry = new RegistryAdapter();

  if (failSubsystem === 'memory-graph') {
    memoryGraph.trackContext = async () => { throw new Error('memory-graph unavailable'); };
  } else if (failSubsystem === 'data-vault') {
    dataVault.store = async () => { throw new Error('data-vault unavailable'); };
  } else if (failSubsystem === 'registry') {
    registry.registerArtifact = async () => { throw new Error('registry unavailable'); };
  }

  return new SimulationPersistenceGateway({ memoryGraph, dataVault, registry });
}

const validRequest = {
  operationId: 'fail-op',
  operationType: 'context:persist' as const,
  simulationId: 'fail-sim',
  entityId: 'fail-entity',
  payload: { key: 'value' },
};

describe('SimulationPersistenceGateway Failure Scenarios', () => {
  test('failure in memory-graph throws InvalidSimulationError', async () => {
    const gateway = createFailingGateway('memory-graph');

    await assert.rejects(
      () => gateway.persist({ ...validRequest, operationId: 'mg-fail' }),
      (err: unknown) => {
        assert.ok(isInvalidSimulationError(err));
        const simErr = err as InvalidSimulationError;
        assert.strictEqual(simErr.simulationId, 'fail-sim');
        assert.ok(simErr.subsystemFailures.some(f => f.subsystem === 'memory-graph'));
        assert.ok(simErr.subsystemFailures.some(f => f.error.includes('memory-graph unavailable')));
        return true;
      },
    );
  });

  test('failure in data-vault throws InvalidSimulationError', async () => {
    const gateway = createFailingGateway('data-vault');

    await assert.rejects(
      () => gateway.persist({ ...validRequest, operationId: 'dv-fail' }),
      (err: unknown) => {
        assert.ok(isInvalidSimulationError(err));
        const simErr = err as InvalidSimulationError;
        assert.ok(simErr.subsystemFailures.some(f => f.subsystem === 'data-vault'));
        assert.ok(simErr.subsystemFailures.some(f => f.error.includes('data-vault unavailable')));
        return true;
      },
    );
  });

  test('failure in registry throws InvalidSimulationError', async () => {
    const gateway = createFailingGateway('registry');

    await assert.rejects(
      () => gateway.persist({ ...validRequest, operationId: 'reg-fail' }),
      (err: unknown) => {
        assert.ok(isInvalidSimulationError(err));
        const simErr = err as InvalidSimulationError;
        assert.ok(simErr.subsystemFailures.some(f => f.subsystem === 'registry'));
        assert.ok(simErr.subsystemFailures.some(f => f.error.includes('registry unavailable')));
        return true;
      },
    );
  });

  test('failure in ANY subsystem means simulation is INVALID (no partial persistence)', async () => {
    // Registry fails, but memory-graph and data-vault succeed
    const gateway = createFailingGateway('registry');

    try {
      await gateway.persist({ ...validRequest, operationId: 'partial-fail' });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(isInvalidSimulationError(err));
      const simErr = err as InvalidSimulationError;

      // Only registry should appear in failures
      assert.strictEqual(simErr.subsystemFailures.length, 1);
      assert.strictEqual(simErr.subsystemFailures[0].subsystem, 'registry');

      // The error is terminal and frozen
      assert.strictEqual(simErr.isTerminal, true);
    }
  });

  test('multiple subsystem failures are all reported', async () => {
    const memoryGraph = new MemoryGraphAdapter();
    const dataVault = new DataVaultAdapter();
    const registry = new RegistryAdapter();

    memoryGraph.trackContext = async () => { throw new Error('mg down'); };
    dataVault.store = async () => { throw new Error('dv down'); };

    const gateway = new SimulationPersistenceGateway({ memoryGraph, dataVault, registry });

    try {
      await gateway.persist({ ...validRequest, operationId: 'multi-fail' });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(isInvalidSimulationError(err));
      const simErr = err as InvalidSimulationError;

      assert.strictEqual(simErr.subsystemFailures.length, 2);
      const failedNames = simErr.subsystemFailures.map(f => f.subsystem).sort();
      assert.deepStrictEqual(failedNames, ['data-vault', 'memory-graph']);
    }
  });

  test('all three subsystem failures are reported', async () => {
    const memoryGraph = new MemoryGraphAdapter();
    const dataVault = new DataVaultAdapter();
    const registry = new RegistryAdapter();

    memoryGraph.trackContext = async () => { throw new Error('mg down'); };
    dataVault.store = async () => { throw new Error('dv down'); };
    registry.registerArtifact = async () => { throw new Error('reg down'); };

    const gateway = new SimulationPersistenceGateway({ memoryGraph, dataVault, registry });

    try {
      await gateway.persist({ ...validRequest, operationId: 'all-fail' });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(isInvalidSimulationError(err));
      const simErr = err as InvalidSimulationError;

      assert.strictEqual(simErr.subsystemFailures.length, 3);
      const failedNames = simErr.subsystemFailures.map(f => f.subsystem).sort();
      assert.deepStrictEqual(failedNames, ['data-vault', 'memory-graph', 'registry']);
    }
  });

  test('InvalidSimulationError preserves operationId and simulationId', async () => {
    const gateway = createFailingGateway('data-vault');

    try {
      await gateway.persist({
        ...validRequest,
        operationId: 'specific-op-id',
        simulationId: 'specific-sim-id',
      });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(isInvalidSimulationError(err));
      const simErr = err as InvalidSimulationError;
      assert.strictEqual(simErr.operationId, 'specific-op-id');
      assert.strictEqual(simErr.simulationId, 'specific-sim-id');
    }
  });
});
