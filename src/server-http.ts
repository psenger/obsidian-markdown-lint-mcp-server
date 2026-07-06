import { createServer as createHttpServer } from 'node:http';
import { createMcpHttpHandler, MCP_ENDPOINT } from './lib/http-transport.js';

/**
 * Optional entry point. This is the Streamable HTTP transport (issue #19): one
 * long-running server process serves every session over `POST/GET/DELETE
 * ${MCP_ENDPOINT}`, instead of stdio's one-subprocess-per-session model.
 *
 * The default transport is still stdio (`server.ts`). Run this only when you
 * want a single shared instance: `node dist/server-http.js`, or the `http`
 * service in docker-compose.yml. Port comes from the PORT env, default 3000.
 *
 * Diagnostics go to stderr (there is no JSON-RPC stdout channel here, but
 * keeping logs on stderr matches the stdio entry point).
 */
const PORT = Number(process.env.PORT ?? 3000);
const handler = createMcpHttpHandler();

const httpServer = createHttpServer((req, res) => {
  handler.handle(req, res).catch((err) => {
    console.error('Error handling MCP request:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        })
      );
    }
  });
});

httpServer.listen(PORT, () => {
  console.error(
    `obsidian-markdown-lint-mcp-server (HTTP) listening on port ${PORT}, endpoint ${MCP_ENDPOINT}`
  );
});

const shutdown = (): void => {
  void handler.closeAll().finally(() => {
    httpServer.close(() => process.exit(0));
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
