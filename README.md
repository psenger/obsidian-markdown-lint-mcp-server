<div align="center">

# obsidian-markdown-lint-mcp-server

**An MCP server that lints, validates, and renders your Obsidian vault markdown — all inside Docker.**

[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org) [![MCP SDK](https://img.shields.io/badge/MCP%20SDK-1.29-blue)](https://github.com/modelcontextprotocol/typescript-sdk) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Tools](#tools) • [Quick Start](#quick-start) • [Configuration](#configuration) • [Schemas](#front-matter-schemas) • [Development](#development)

</div>

---

Run markdown linting, front matter validation, and Mermaid-to-SVG rendering as MCP tools callable from Claude Code. Docker isolates Chromium and Node.js from your host machine. The server is stateless — it processes content you send and returns results; Claude Code handles all disk I/O.

This is a **stdio MCP server**: Claude Code launches it as a subprocess (`docker run -i --rm`) and talks to it over stdin/stdout. There is no port and no long-running container — the container starts when a session opens and is removed when it ends.

## Why Docker

Mermaid rendering requires a Chromium browser (via Puppeteer). Running that, plus dozens of Node.js dependencies, directly on your laptop is a valid security concern. This server packages everything inside a container. Your vault never mounts into it; content travels as strings.

## Tools

| Tool | What it does |
|-------|----|
| `lint_markdown` | Runs markdownlint on content, returns errors and a corrected version |
| `validate_front_matter` | Validates YAML front matter against a JSON Schema you pass in |
| `render_mermaid_diagrams` | Renders all ` ```mermaid ``` ` blocks to SVG, replaces them with GitHub image links, embeds the original Mermaid source as base64 in each SVG's `<metadata>` |
| `extract_mermaid_from_svg` | Reads a rendered SVG and returns the original Mermaid source as a code block, ready to edit |

The render/extract pair supports a full edit cycle: render → view SVG in Obsidian → extract → edit source → re-render.

## Quick start

**Prerequisites:** Docker Desktop, Node.js ≥ 20, Claude Code.

```bash
git clone <repo>
cd obsidian-markdown-lint-mcp-server
npm install
npm run build              # compile TypeScript → dist/
docker build -t obsidian-markdown-lint-mcp .   # or: docker compose build
```

Register the server with Claude Code. Claude Code runs `docker run -i --rm` itself, per session — you do **not** start a container yourself.

**Per-project (recommended for a vault)** — run this from your vault root; it writes a committable `.mcp.json`:

```bash
claude mcp add obsidian-markdown-lint -s project -- docker run -i --rm obsidian-markdown-lint-mcp
```

The resulting `.mcp.json`:

```json
{
  "mcpServers": {
    "obsidian-markdown-lint": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "obsidian-markdown-lint-mcp"]
    }
  }
}
```

**Global** — make it available in every project (`-s user` writes to `~/.claude.json`):

```bash
claude mcp add obsidian-markdown-lint -s user -- docker run -i --rm obsidian-markdown-lint-mcp
```

Verify with `claude mcp list` (should show `obsidian-markdown-lint` → `connected`), then start a **new** Claude Code session — tools are discovered at session start. The four tools are now available.

> The `-i` flag is required: it keeps the container's stdin open for the JSON-RPC stream. Without it the container gets EOF and exits immediately. Do **not** use `docker compose up` for this server — it is a stdio subprocess, not a long-running HTTP service.

### Hardening (optional)

The server needs no network, no writable root filesystem, and little memory, so you can lock the container down. `--network none` and `--security-opt no-new-privileges` are always safe (the image skips the Puppeteer download and renders offline):

```bash
claude mcp add obsidian-markdown-lint -s project -- docker run -i --rm --network none --security-opt no-new-privileges --memory 2g obsidian-markdown-lint-mcp
```

For stricter isolation, add a read-only root with a writable temp dir and drop all Linux capabilities. Chromium renders into `/tmp` because the server launches it with `--disable-dev-shm-usage`, so the `--tmpfs /tmp` is required. Verify a Mermaid render still succeeds under these flags before relying on them, since Chromium's writable paths vary by version:

```bash
docker run -i --rm --network none --security-opt no-new-privileges --read-only --tmpfs /tmp --cap-drop ALL --memory 2g obsidian-markdown-lint-mcp
```

## Choosing a transport

The default is **stdio**, and it is the right choice for almost everyone. An optional **Streamable HTTP** transport ([#19](https://github.com/psenger/obsidian-markdown-lint-mcp-server/issues/19)) exists for the specific case where you want a single shared server instead of one container per session.

| | stdio (default) | Streamable HTTP (optional) |
|---|---|---|
| Container lifecycle | Client starts/stops one per session; zero management | You run one shared server (`docker compose up -d`) and own its lifecycle |
| Concurrency | N sessions → N containers | N sessions → 1 container |
| Sandbox | Strongest (`--network none` possible) | A port must be open; loopback-only binding is the mitigation |
| Failure mode | Isolated per session | If the shared server is down, every session fails |

Both share one image and the same tool code. To run the HTTP server:

```bash
docker compose up -d obsidian-markdown-lint-mcp-http
claude mcp add --transport http obsidian-markdown-lint http://localhost:3000/mcp -s user
```

The server listens on `PORT` (default 3000) and handles `POST`/`GET`/`DELETE` at `/mcp`, one MCP session per client keyed by the `mcp-session-id` header. Without Docker: `npm run build && npm run start:http`. The compose service binds to `127.0.0.1` only and runs read-only with all capabilities dropped; verify a Mermaid render succeeds under those flags before relying on them.

## Configuration

### Vault layout

The server reads nothing from disk directly. Claude Code reads your vault files and passes content as strings. Place these config files at your vault root:

```
vault/
  .markdownlint.json     ← linting rules (optional; defaults to markdownlint defaults)
  .schemas/
    _shared.json         ← shared field definitions (reference; not loaded at runtime)
    article.json
    how-to.json
    technical.json
    deep-research.json
    strategy.json
    meeting.json
    brainstorming.json
```

Pre-built schemas for all seven note types are included in this repo's `.schemas/` directory. Copy them to your vault root. The seven type schemas are self-contained, so `validate_front_matter` only needs the one matching the document's `type`; `_shared.json` is the source the type schemas are built from and is kept for maintenance.

### CLAUDE.md for your vault

Add a `CLAUDE.md` to your vault project that tells Claude how to use the server. Minimum viable example:

```markdown
## MCP: obsidian-markdown-lint-mcp-server

Vault attachments directory: attachments
Schemas directory: .schemas/
Linting config: .markdownlint.json

When asked to "process a vault file":
1. Read the file
2. Read .markdownlint.json and call lint_markdown
3. Read the type field from front matter, read .schemas/{type}.json, call validate_front_matter
4. Call render_mermaid_diagrams with attachments_dir="attachments" and the document title
5. Write the modified_content back to the file
6. Write each SVG from the svgs array to its path field (decoded from base64)

SVG files contain the original Mermaid source base64-encoded in <metadata>.
To edit a diagram: call extract_mermaid_from_svg with the SVG content,
edit the returned mermaid_block, then re-run render_mermaid_diagrams.
```

### Mermaid front matter options

Control rendering per-document:

```yaml
mermaid_theme: dark          # default | dark | neutral | forest  (default: default)
mermaid_background: white    # any CSS color or "transparent"     (default: white)
```

After rendering, the server adds `mermaid_svg_source: base64-embedded` to the front matter so Claude knows SVGs in this document contain extractable source.

## Front matter schemas

Seven note types are supported. Each schema lives at `.schemas/{type}.json`.

| Type | Extra required fields |
|---|---|
| `article` | core only |
| `how-to` | core only |
| `technical` | `system`, `component` |
| `deep-research` | `sources` (array, min 1) |
| `strategy` | `related`, `prepared_for`, `quarter` |
| `meeting` | `meeting_date`, `attendees` (array, min 1) |
| `brainstorming` | core only |

Core required fields on every type: `type`, `title`, `author`, `category`, `tags`, `description`, `summary`, `status`, `version`, `date_created`, `date_updated`.

The `type` field is the discriminator. Claude reads it from the front matter to select the right schema file before calling `validate_front_matter`.

## How SVG embedding works

Each rendered SVG contains the original Mermaid source, base64-encoded, inside the SVG's `<metadata>` element:

```xml
<metadata>
  <mermaid:source xmlns:mermaid="http://mermaid.js.org/" encoding="base64">
    Zmxvd2NoYXJ0IExSCiAgICBBIC0tPiBCCg==
  </mermaid:source>
</metadata>
```

Base64 avoids all whitespace normalization issues — Mermaid is whitespace-sensitive and attribute-value normalization in XML would corrupt indentation. The `extract_mermaid_from_svg` tool decodes this and returns a ready-to-use ` ```mermaid ``` ` block.

## SVG output paths

Diagrams render to `{attachments_dir}/{document-title-slug}/{diagram-type}-{n}.svg`.

For a document titled "System Architecture" with `attachments_dir = "attachments"` and two flowchart blocks, you get:

```
attachments/system-architecture/flowchart-1.svg
attachments/system-architecture/flowchart-2.svg
```

The markdown is updated to:

```markdown
![flowchart diagram 1](attachments/system-architecture/flowchart-1.svg)
```

Standard GitHub-flavored markdown — renders in Obsidian, GitHub, and any standard markdown viewer.

## Testing

Three layers, all runnable from the repo without building the Docker image:

```bash
npm test          # 52 Jest unit tests (ESM), enforced coverage thresholds
npm run eval      # tool-correctness evals against the compiled functions
npm run snapshot  # end-to-end fixture snapshots (requires a real Chromium)
```

**Unit tests** (`tests/unit/`) call the tool functions directly. Coverage is gated (90% lines/functions/statements, 85% branches); `src/server.ts` and `src/create-server.ts` are excluded as pure wiring and are covered separately through an in-memory MCP transport. Mermaid rendering is tested with an injected browser/renderer, so no Chromium is needed here. Use `npm run test:coverage` for the lcov/HTML report.

**Evals** (`tests/evals/`) check tool correctness against the compiled functions (no Docker). Output is JSON with `summary.passed`, `summary.failed`, and a `results` array; exit code is `1` if any eval fails. The suite covers all four tools: lint detection, schema validation (pass and fail cases), Mermaid rendering with a mock browser, and SVG round-trip extraction. In Claude Code, say *"run evals"* or *"evaluate the tools"* and it runs `npm run eval` and reports the results.

**Snapshots** (`tests/snapshot/`) prove that each input under `test-obsidian-vault/original/` reproduces its committed `test-obsidian-vault/snap-shot/` output through the real tool pipeline. Unlike the evals, `test-1` launches Puppeteer for an actual render, so this needs a real Chromium and is kept out of `npm test`. SVG geometry is not byte-compared (it varies by Mermaid, Chromium, and font version); the deterministic projection is, namely the modified markdown, the file layout, and the embedded Mermaid source. Output is JSON; exits non-zero on any failure.

## JSON Schema format

Each file in `.schemas/` is a self-contained [JSON Schema draft-07](https://json-schema.org/) object. `validate_front_matter` parses the document's YAML front matter and validates the resulting object against the schema you pass in. A trimmed view of `.schemas/article.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Article",
  "type": "object",
  "required": ["type","title","author","category","tags","description","summary","status","version","date_created","date_updated"],
  "properties": {
    "type":         { "const": "article" },
    "title":        { "type": "string", "minLength": 1 },
    "category":     { "type": "string", "enum": ["Software Development", "Security", "DevOps", "..."] },
    "tags":         { "type": "array", "items": { "type": "string", "pattern": "^[a-z0-9][a-z0-9_\\-/]*$" }, "minItems": 4, "maxItems": 12 },
    "status":       { "type": "string", "enum": ["published", "draft", "in-progress"] },
    "version":      { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "date_created": { "type": "string", "format": "date" }
  },
  "additionalProperties": false
}
```

See `.schemas/article.json` for the complete schema, including the optional fields it also permits (`aliases`, `subtitle`, `source`, `sources`, `reviewers`, `signoff`, `mermaid_theme`, `mermaid_background`, `mermaid_svg_source`). Every schema sets `additionalProperties: false`, so any front matter key not declared in the schema is a validation error; add a key to the schema before using it in notes.

**Important:** Date fields must be quoted strings in YAML (`date_created: "2026-01-01"`) because YAML auto-converts unquoted `YYYY-MM-DD` values to JavaScript `Date` objects, which fail the `type: string` check.

The per-type required fields are listed in [Front matter schemas](#front-matter-schemas) above.

## Development

```bash
npm install
npm run build       # compile TypeScript → dist/
```

TypeScript source is in `src/`. After changing code, rebuild the image so the next Claude Code session picks it up:

```bash
npm run build && docker build -t obsidian-markdown-lint-mcp .   # or: docker compose build
```

Then start a new Claude Code session (stdio tools are loaded at session start).

To smoke-test the container by hand without Claude Code, drive it over stdio:

```bash
docker compose run --rm obsidian-markdown-lint-mcp
# then paste a JSON-RPC line, e.g. an initialize request, and read the reply
```

## Project structure

```
src/
  server.ts             stdio entry point (StdioServerTransport bootstrap)
  server-http.ts        optional Streamable HTTP entry point (shared server)
  create-server.ts      builds the McpServer and registers the 4 tools
  tools/
    lint.ts             lint_markdown implementation
    validate.ts         validate_front_matter implementation
    mermaid.ts          render_mermaid_diagrams + extract_mermaid_from_svg
  lib/
    frontmatter.ts      gray-matter parse/update helpers
    svg-metadata.ts     base64 embed/extract helpers
    stdio-lifecycle.ts  exit the stdio server when the client disconnects
    http-transport.ts   Streamable HTTP session router (POST/GET/DELETE /mcp)
.schemas/               JSON Schema files for all 7 note types
Dockerfile              stdio server image (Chromium for Mermaid)
docker-compose.yml      build/tag helper + optional HTTP service
```

## License

[MIT](LICENSE) © 2026 Philip Senger

---

<div align="center">

**Lint, validate, and render your Obsidian vault markdown without touching your host system.**

[Report a bug](../../issues) • [Request a feature](../../issues)

</div>
