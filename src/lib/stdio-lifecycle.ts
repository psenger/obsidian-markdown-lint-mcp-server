/**
 * The stdio SDK transport (`StdioServerTransport`) subscribes only to stdin
 * `data` and `error` events, never `end` or `close`, and nothing else calls
 * `process.exit`. So when the client disconnects and stdin reaches EOF the
 * process keeps running. Under `docker run -i --rm` that leaves the container
 * alive indefinitely after the session ends, accumulating orphans.
 *
 * Exit the process when stdin ends or closes so the container stops and `--rm`
 * removes it. stdin only closes when the client's pipe goes away, so this fires
 * on disconnect and never during normal operation.
 *
 * See https://github.com/psenger/obsidian-markdown-lint-mcp-server/issues/18
 *
 * @param stdin - the input stream to watch (`process.stdin` in production)
 * @param exit  - the exit function to call on disconnect (`process.exit` in production)
 */
export function exitOnStdinClose(
  stdin: NodeJS.EventEmitter,
  exit: (code?: number) => void
): void {
  let exited = false;
  const shutdown = (): void => {
    if (exited) return;
    exited = true;
    exit(0);
  };
  stdin.once('end', shutdown);
  stdin.once('close', shutdown);
}
