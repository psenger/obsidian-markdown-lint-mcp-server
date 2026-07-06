# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **mermaid**: `render_mermaid_diagrams` now folds accented characters to their ASCII base when slugifying `document_title` (`Café Menu` → `cafe-menu`) and falls back to `untitled` when a title has no ASCII slug characters, so fully non-ASCII titles no longer produce an empty path segment (`attachments//…`) and can no longer collide on the same SVG file. ([#17](https://github.com/psenger/obsidian-markdown-lint-mcp-server/issues/17))

## [0.1.1] - 2026-06-08

### Changed
- **docs**: documented publishing the multi-arch Docker image to a registry (GHCR / Docker Hub) in CONTRIBUTING.md. ([#8](https://github.com/psenger/obsidian-markdown-lint-mcp-server/issues/8))

## [0.1.0] - 2026-06-08

### Added
- **tools**: Initial MCP toolset: `lint_markdown`, `validate_front_matter`, `render_mermaid_diagrams`, and `extract_mermaid_from_svg`.
- **schemas**: JSON Schema set for seven Obsidian note types, with shared field definitions in `_shared.json`.
- **docker**: stdio server image bundling Chromium for offline Mermaid rendering.
- **tests**: unit (Jest), eval, and snapshot suites.

[Unreleased]: https://github.com/psenger/obsidian-markdown-lint-mcp-server/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/psenger/obsidian-markdown-lint-mcp-server/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/psenger/obsidian-markdown-lint-mcp-server/releases/tag/v0.1.0
