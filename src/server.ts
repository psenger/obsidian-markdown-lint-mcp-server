import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './create-server.js';
import { exitOnStdinClose } from './lib/stdio-lifecycle.js';

/**
 * Entry point. This is a stdio MCP server: Claude Code launches it as a
 * subprocess (e.g. `docker run -i --rm obsidian-markdown-lint-mcp`) and exchanges
 * newline-delimited JSON-RPC over stdin/stdout.
 *
 * IMPORTANT: stdout is the JSON-RPC channel. Never write anything to stdout
 * that is not an MCP message — a stray console.log corrupts the stream and the
 * client disconnects. All diagnostics go to stderr via console.error.
 * See https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
 */
async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  exitOnStdinClose(process.stdin, process.exit);
  console.error('obsidian-markdown-lint-mcp-server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error starting obsidian-markdown-lint-mcp-server:', err);
  process.exit(1);
});
