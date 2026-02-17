/**
 * Tests for POST /v1/lineage/record handler
 */
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { handleLineageRecord } from '../handlers/lineage-record.handler';

describe('handleLineageRecord', () => {
  test('returns accepted with routed_to list for valid payload', () => {
    const result = handleLineageRecord({
      execution_id: 'exec-123',
      source: 'test-agent',
      event: 'completed',
    });
    assert.strictEqual(result.accepted, true);
    assert.deepStrictEqual(result.routed_to, [
      'llm-memory-graph',
      'llm-registry',
      'llm-data-vault',
    ]);
  });

  test('throws when execution_id is missing', () => {
    assert.throws(
      () => handleLineageRecord({ source: 'test-agent' }),
      { message: 'execution_id is required' },
    );
  });

  test('throws when source is missing', () => {
    assert.throws(
      () => handleLineageRecord({ execution_id: 'exec-123' }),
      { message: 'source is required' },
    );
  });

  test('accepts optional fields without error', () => {
    const result = handleLineageRecord({
      execution_id: 'exec-456',
      source: 'pipeline-a',
      parent_span_id: 'span-001',
      layers_executed: ['layer1', 'layer2'],
      output_hash: 'sha256:abc',
      event: 'transform',
    });
    assert.strictEqual(result.accepted, true);
    assert.strictEqual(result.routed_to.length, 3);
  });

  test('routed_to array is a fresh copy each call', () => {
    const r1 = handleLineageRecord({ execution_id: 'a', source: 'b' });
    const r2 = handleLineageRecord({ execution_id: 'c', source: 'd' });
    assert.notStrictEqual(r1.routed_to, r2.routed_to);
    assert.deepStrictEqual(r1.routed_to, r2.routed_to);
  });
});
