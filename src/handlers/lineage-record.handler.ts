/** Handler for POST /v1/lineage/record — non-blocking fan-out to downstream services */

export interface LineageRecordPayload {
  execution_id: string;
  parent_span_id?: string;
  source: string;
  layers_executed?: string[];
  output_hash?: string;
  event?: string;
}

export interface LineageRecordResult {
  accepted: true;
  routed_to: string[];
}

const SERVICE_URLS = {
  memoryGraph: process.env.LLM_MEMORY_GRAPH_URL || 'https://llm-memory-graph-1062287243982.us-central1.run.app',
  registry: process.env.LLM_REGISTRY_URL || 'https://llm-registry-1062287243982.us-central1.run.app',
  dataVault: process.env.LLM_DATA_VAULT_URL || 'https://llm-data-vault-1062287243982.us-central1.run.app',
} as const;

const ROUTED_TO = ['llm-memory-graph', 'llm-registry', 'llm-data-vault'] as const;

async function postJSON(url: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  // Consume the response body to release the underlying socket back to the pool.
  // Without this, undici keeps the socket allocated and eventually exhausts the
  // connection pool or triggers UND_ERR_ABORTED on GC, crashing the process.
  await res.text();
}

export function handleLineageRecord(payload: Record<string, unknown>): LineageRecordResult {
  const execution_id = payload.execution_id as string | undefined;
  const source = payload.source as string | undefined;

  if (!execution_id) throw new Error('execution_id is required');
  if (!source) throw new Error('source is required');

  const timestamp = new Date().toISOString();

  const parent_span_id = payload.parent_span_id as string | undefined;
  const layers_executed = payload.layers_executed as string[] | undefined;
  const output_hash = payload.output_hash as string | undefined;
  const event = payload.event as string | undefined;

  // Fire-and-forget: dispatch all three, log failures but don't block
  void Promise.allSettled([
    postJSON(`${SERVICE_URLS.memoryGraph}/prompt-lineage`, {
      execution_id,
      parent_span_id,
      source,
      layers: layers_executed,
      timestamp,
    }),
    postJSON(`${SERVICE_URLS.registry}/api/v1/executions`, {
      execution_id,
      source,
      checksum: output_hash,
      timestamp,
    }),
    postJSON(`${SERVICE_URLS.dataVault}/metadata`, {
      execution_id,
      source,
      event,
      timestamp,
    }),
  ]).then((results) => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[lineage-record] Failed to route to ${ROUTED_TO[i]}:`, r.reason);
      }
    });
  }).catch((err) => {
    console.error('[lineage-record] Unexpected fanout error:', err);
  });

  return { accepted: true, routed_to: [...ROUTED_TO] };
}
