/**
 * LLM-Data-Core HTTP Server for Cloud Run
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { createDataCore, DataCoreSDK } from './sdk';

const PORT = process.env.PORT || 8080;

let sdk: DataCoreSDK;

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { resolve({}); }
    });
  });
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method || 'GET';

  try {
    if (path === '/health' || path === '/') {
      return json(res, { status: 'ok', service: 'data-core' });
    }

    if (path === '/context' && method === 'POST') {
      const body = await parseBody(req);
      const result = await sdk.persistContext(body.contextId as string, body.data as Record<string, unknown>);
      return json(res, result);
    }

    if (path === '/context' && method === 'GET') {
      const query = url.searchParams.get('q') || '';
      const result = await sdk.queryContext(query);
      return json(res, result);
    }

    if (path.startsWith('/lineage/') && method === 'GET') {
      const artifactId = path.slice('/lineage/'.length);
      const result = await sdk.resolveLineage(artifactId);
      return json(res, result);
    }

    if (path === '/artifact' && method === 'POST') {
      const body = await parseBody(req);
      const result = await sdk.registerArtifact(body.artifactId as string, body.metadata as Record<string, unknown>);
      return json(res, result);
    }

    if (path.startsWith('/artifact/') && method === 'GET') {
      const artifactId = path.slice('/artifact/'.length);
      const result = await sdk.lookupArtifact(artifactId);
      return json(res, result || { error: 'not found' }, result ? 200 : 404);
    }

    if (path.startsWith('/data/') && method === 'GET') {
      const dataId = path.slice('/data/'.length);
      const schema = url.searchParams.get('schema') || undefined;
      const result = await sdk.getData(dataId, schema ? { schema } : undefined);
      return json(res, result);
    }

    if (path.startsWith('/schema/') && method === 'GET') {
      const dataType = path.slice('/schema/'.length);
      const result = await sdk.resolveSchema(dataType);
      return json(res, result);
    }

    if (path === '/normalize' && method === 'POST') {
      const body = await parseBody(req);
      const result = await sdk.normalizeData(body.data as Record<string, unknown>, body.schemaId as string);
      return json(res, result);
    }

    json(res, { error: 'not found' }, 404);
  } catch (err) {
    json(res, { error: (err as Error).message }, 500);
  }
}

async function main(): Promise<void> {
  sdk = await createDataCore({ simulatorMode: true });

  const server = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      json(res, { error: (err as Error).message }, 500);
    });
  });

  server.listen(PORT, () => {
    console.log(`data-core server listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
