import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createServer as createHttpServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createMcpHttpHandler, type McpHttpHandler } from '../../../src/lib/http-transport.js';

/**
 * Exercises the Streamable HTTP session lifecycle end-to-end against a real
 * in-process `http.Server` (issue #19): the SDK client drives initialize →
 * session-id assignment → request routing → teardown, and raw requests cover
 * the rejection branches. No Docker, no fixed port.
 */

const started: Server[] = [];

function start(handler: McpHttpHandler): Promise<string> {
  return new Promise((resolve) => {
    const server = createHttpServer((req, res) => {
      handler.handle(req, res).catch(() => res.destroy());
    });
    started.push(server);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}${'/mcp'}`);
    });
  });
}

async function connect(url: string): Promise<Client> {
  const client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities: {} });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  return client;
}

afterEach(async () => {
  await Promise.all(
    started.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve())))
  );
});

describe('createMcpHttpHandler', () => {
  it('assigns a session on initialize and lists all four tools over HTTP', async () => {
    const handler = createMcpHttpHandler();
    const url = await start(handler);
    const client = await connect(url);

    expect(handler.sessionCount()).toBe(1);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'extract_mermaid_from_svg',
      'lint_markdown',
      'render_mermaid_diagrams',
      'validate_front_matter',
    ]);
    await client.close();
  });

  it('routes a tool call to the initialized session', async () => {
    const handler = createMcpHttpHandler();
    const client = await connect(await start(handler));
    const result = await client.callTool({
      name: 'lint_markdown',
      arguments: { content: '# Heading\n\n### Skipped Level\n' },
    });
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(Array.isArray(parsed.errors)).toBe(true);
    await client.close();
  });

  it('tears the session down when the client terminates it (DELETE)', async () => {
    const handler = createMcpHttpHandler();
    const url = await start(handler);
    const transport = new StreamableHTTPClientTransport(new URL(url));
    const client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities: {} });
    await client.connect(transport);
    expect(handler.sessionCount()).toBe(1);

    await transport.terminateSession(); // client-initiated DELETE /mcp
    expect(handler.sessionCount()).toBe(0);
    await client.close();
  });

  it('closeAll() closes every live session', async () => {
    const handler = createMcpHttpHandler();
    await connect(await start(handler));
    expect(handler.sessionCount()).toBe(1);
    await handler.closeAll();
    expect(handler.sessionCount()).toBe(0);
  });

  it('rejects a POST with no session id that is not an initialize request (400)', async () => {
    const url = await start(createMcpHttpHandler());
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects a POST with an empty body (400)', async () => {
    const url = await start(createMcpHttpHandler());
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects a GET with no session id (400)', async () => {
    const url = await start(createMcpHttpHandler());
    const res = await fetch(url, { method: 'GET', headers: { accept: 'text/event-stream' } });
    expect(res.status).toBe(400);
  });

  it('rejects an unsupported method (405)', async () => {
    const url = await start(createMcpHttpHandler());
    const res = await fetch(url, { method: 'PUT' });
    expect(res.status).toBe(405);
  });

  it('returns 404 for a path other than /mcp', async () => {
    const base = await start(createMcpHttpHandler());
    const res = await fetch(base.replace('/mcp', '/nope'), { method: 'POST' });
    expect(res.status).toBe(404);
  });
});
