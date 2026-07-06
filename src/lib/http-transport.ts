import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createServer } from '../create-server.js';

/**
 * Streamable HTTP session router for the shared-server transport (issue #19).
 *
 * One long-running process serves every client. Each client gets its own MCP
 * session — a `StreamableHTTPServerTransport` bound to a fresh `createServer()`
 * instance — keyed by the `mcp-session-id` header. This is the transport wiring
 * only; tool code (`createServer` and everything it registers) is untouched and
 * stays content-in/content-out.
 *
 * - `POST /mcp` with no session id and an `initialize` body opens a new session.
 * - `POST /mcp` with a known session id routes to that session.
 * - `GET /mcp` (SSE stream) and `DELETE /mcp` (teardown) require a known session.
 * - Anything else is rejected without touching a session.
 */

export const MCP_ENDPOINT = '/mcp';

export interface McpHttpHandler {
  /** Handle one HTTP request (POST/GET/DELETE on the MCP endpoint). */
  handle(req: IncomingMessage, res: ServerResponse): Promise<void>;
  /** Number of live sessions — for readiness checks and tests. */
  sessionCount(): number;
  /** Close every live session; used on server shutdown. */
  closeAll(): Promise<void>;
}

export interface McpHttpHandlerOptions {
  /** Factory for a per-session MCP server. Defaults to the real `createServer`; injected in tests. */
  serverFactory?: () => McpServer;
  /** Session id generator. Defaults to `randomUUID`; injected in tests for determinism. */
  sessionIdGenerator?: () => string;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function requestPath(url: string | undefined): string {
  const raw = url ?? '/';
  const queryStart = raw.indexOf('?');
  return queryStart === -1 ? raw : raw.slice(0, queryStart);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) {
    return undefined;
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
}

function writeJsonRpcError(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message },
      id: null,
    })
  );
}

export function createMcpHttpHandler(options: McpHttpHandlerOptions = {}): McpHttpHandler {
  const serverFactory = options.serverFactory ?? createServer;
  const newSessionId = options.sessionIdGenerator ?? randomUUID;
  const transports = new Map<string, StreamableHTTPServerTransport>();

  async function openSession(): Promise<StreamableHTTPServerTransport> {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: newSessionId,
      onsessioninitialized: (sessionId) => {
        transports.set(sessionId, transport);
      },
      // Fired when the client ends the session with DELETE /mcp.
      onsessionclosed: (sessionId) => {
        transports.delete(sessionId);
      },
    });
    // Fired if the connection drops without a clean DELETE, so a dead session
    // is not left in the map on the long-running server.
    transport.onclose = () => {
      const sessionId = transport.sessionId;
      if (sessionId) {
        transports.delete(sessionId);
      }
    };
    await serverFactory().connect(transport);
    return transport;
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (requestPath(req.url) !== MCP_ENDPOINT) {
      writeJsonRpcError(res, 404, `Not Found: use ${MCP_ENDPOINT}`);
      return;
    }

    const sessionId = firstHeader(req.headers['mcp-session-id']);
    const method = req.method;

    if (method === 'POST') {
      const body = await readJsonBody(req);
      let transport = sessionId ? transports.get(sessionId) : undefined;
      if (!transport) {
        if (!sessionId && isInitializeRequest(body)) {
          transport = await openSession();
        } else {
          writeJsonRpcError(res, 400, 'Bad Request: no valid session id, and not an initialize request');
          return;
        }
      }
      await transport.handleRequest(req, res, body);
      return;
    }

    if (method === 'GET' || method === 'DELETE') {
      const transport = sessionId ? transports.get(sessionId) : undefined;
      if (!transport) {
        writeJsonRpcError(res, 400, 'Bad Request: missing or unknown session id');
        return;
      }
      await transport.handleRequest(req, res);
      return;
    }

    writeJsonRpcError(res, 405, 'Method Not Allowed');
  }

  return {
    handle,
    sessionCount: () => transports.size,
    closeAll: async () => {
      for (const transport of transports.values()) {
        await transport.close();
      }
      transports.clear();
    },
  };
}
