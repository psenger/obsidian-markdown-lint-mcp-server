# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-11-13

### Added
- **server**: optional Streamable HTTP transport (`src/server-http.ts`, `npm run start:http`, and the `obsidian-markdown-lint-mcp-http` docker-compose service) — one shared, long-running server serves every session over `POST/GET/DELETE /mcp` instead of a container per session. stdio remains the default; tool code is unchanged. ([#19](https://github.com/psenger/obsidian-markdown-lint-mcp-server/issues/19))

### Changed
- **deps**: bumped `@mermaid-js/mermaid-cli` from 11.17.0 to 12.2.0, a major version of the renderer behind `render_mermaid_diagrams`. ([#52](https://github.com/psenger/obsidian-markdown-lint-mcp-server/pull/52))
- **deps**: kept `typescript` at `^6.0.3` and declined the TypeScript 7 bump, because `ts-jest` 29.4.15 (latest) declares peer `typescript >=4.3 <7` and the upgrade fails `npm ci` with ERESOLVE. ([#51](https://github.com/psenger/obsidian-markdown-lint-mcp-server/pull/51))

### Fixed
- **mermaid**: `render_mermaid_diagrams` now folds accented characters to their ASCII base when slugifying `document_title` (`Café Menu` → `cafe-menu`) and falls back to `untitled` when a title has no ASCII slug characters, so fully non-ASCII titles no longer produce an empty path segment (`attachments//…`) and can no longer collide on the same SVG file. ([#17](https://github.com/psenger/obsidian-markdown-lint-mcp-server/issues/17))
- **server**: the stdio server now exits when the client disconnects (stdin reaches EOF), so `docker run -i --rm` containers stop and are removed at the end of a session instead of lingering as orphans. ([#18](https://github.com/psenger/obsidian-markdown-lint-mcp-server/issues/18))

### Security
- **deps**: ran `npm audit fix` to update vulnerable transitive dependencies (including `dompurify`, `handlebars`, `proxy-addr`, `katex`, `zod`) within their existing semver ranges, clearing all high and critical advisories so the CI `npm audit --audit-level=high` gate passes again. Lockfile-only; no `package.json` ranges changed.
- **deps**: bumped `markdownlint` to 0.42.1, which pulls in `re2js` 2.9.1 and clears the high-severity quadratic-time denial of service advisory in `re2js` lookbehind matching ([GHSA-gg6h-894w-4m9c](https://github.com/advisories/GHSA-gg6h-894w-4m9c)). ([#53](https://github.com/psenger/obsidian-markdown-lint-mcp-server/pull/53))
- **deps**: bumped `hono` from 4.13.13 to 4.13.18 and `@hono/node-server` from 2.1.5 to 2.1.8 for the HTTP transport, clearing three moderate `hono` advisories (middleware bypass via `mount()`, RegExpRouter wildcard middleware skip, and `css` helper HTML injection). ([#54](https://github.com/psenger/obsidian-markdown-lint-mcp-server/pull/54), [#55](https://github.com/psenger/obsidian-markdown-lint-mcp-server/pull/55))

## [0.1.1] - 2026-06-08

### Changed
- **docs**: documented publishing the multi-arch Docker image to a registry (GHCR / Docker Hub) in CONTRIBUTING.md. ([#8](https://github.com/psenger/obsidian-markdown-lint-mcp-server/issues/8))

## [0.1.0] - 2026-06-08

### Added
- **tools**: Initial MCP toolset: `lint_markdown`, `validate_front_matter`, `render_mermaid_diagrams`, and `extract_mermaid_from_svg`.
- **schemas**: JSON Schema set for seven Obsidian note types, with shared field definitions in `_shared.json`.
- **docker**: stdio server image bundling Chromium for offline Mermaid rendering.
- **tests**: unit (Jest), eval, and snapshot suites.

[Unreleased]: https://github.com/psenger/obsidian-markdown-lint-mcp-server/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/psenger/obsidian-markdown-lint-mcp-server/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/psenger/obsidian-markdown-lint-mcp-server/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/psenger/obsidian-markdown-lint-mcp-server/releases/tag/v0.1.0
