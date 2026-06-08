# Contributing

**obsidian-markdown-lint-mcp-server** uses **trunk-based development**: `main` is the only long-lived branch, it stays green and releasable, and every change lands through a short-lived branch and a small pull request.

If you use Claude Code in this repo, the `/start`, `/conventions`, and `/release` skills automate the flow below. The manual steps are documented here so the process stands on its own.

## Ground rules

- `main` is the trunk and is **protected**: no direct pushes, every change arrives by PR, and CI must pass.
- Branches are short-lived (hours to days) and named `feature/<issue>-<slug>` or `fix/<issue>-<slug>`.
- PRs are **squash-merged**: one PR becomes one commit on `main`. Keep them small and focused.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/).
- No `develop` or `release/*` branches. Releases are semver tags cut from `main`.

## Prerequisites

- Node.js >= 20
- Docker Desktop (to build the image; the snapshot tests need a real Chromium, which the image bundles)
- `gh` CLI authenticated, for PRs and releases

```bash
git clone https://github.com/psenger/obsidian-markdown-lint-mcp-server.git
cd obsidian-markdown-lint-mcp-server
npm install && npm run build
```

---

## For developers

1. **Branch** from an up-to-date `main`, with the issue number in the name:
   ```bash
   git switch main && git pull
   git switch -c feature/14-mermaid-theme-option   # or fix/<issue>-<slug>
   ```
2. **Make the change.** Match the surrounding style (TypeScript, ESM). Every tool is content-in/content-out: no disk or network access in tool code. Add or update tests for any behavior change.
3. **Run the gates** (all must pass):
   ```bash
   npm run build     # tsc
   npm test          # unit tests; coverage thresholds enforced
   npm run eval      # tool-correctness evals
   npm run snapshot  # end-to-end fixtures (needs a real Chromium)
   npm audit         # no new advisories
   ```
4. **Record the change** in `CHANGELOG.md` under `## [Unreleased]` (`### Added` / `### Changed` / `### Fixed`):
   ```
   - **scope**: what changed and why. ([#14](issue-url))
   ```
5. **Commit and open a PR** against `main`, filling in the template. CI must be green; a maintainer approves and squash-merges.

### Commit and branch format

| | Format | Example |
|---|---|---|
| Commit | `type(scope): subject` | `feat(mermaid): add per-document theme override` |
| Branch | `type/<issue>-<slug>` | `feature/14-mermaid-theme-option`, `fix/23-lint-trailing-newline` |

- **Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`
- **Scopes:** code areas (`tools`, `lint`, `validate`, `mermaid`, `server`, `lib`, `schemas`) or repo areas (`ci`, `docker`, `deps`, `readme`, `release`)
- Link the issue with `Closes #N`. Do not add `Co-Authored-By` trailers.

### Tests

| Command | Covers | Browser |
|---|---|---|
| `npm test` | unit tests, enforced coverage (90% lines/functions/statements, 85% branches) | mocked |
| `npm run eval` | tool correctness against the compiled functions | mocked |
| `npm run snapshot` | byte-for-byte fixtures through the real pipeline | real Chromium |

`src/server.ts` and `src/create-server.ts` are excluded from coverage as pure wiring; they are covered through an in-memory MCP transport in `tests/unit/create-server.test.ts`.

---

## For the repo manager

### Reviewing and merging

- A PR needs **one approving review and green CI** before it merges (enforced by the `default-branch-protection` ruleset).
- Merge with **squash** and delete the branch.
- **Your own PRs:** GitHub does not allow self-approval, so merge them with admin bypass:
  ```bash
  gh pr merge <n> --squash --admin --delete-branch
  ```
  External and Dependabot PRs: approve normally, then squash-merge.

### Cutting a release

Releases are semver tags from `main`; `package.json` `version` is the source of truth and `CHANGELOG.md` drives the notes. The `/release` skill does steps 1 to 5 interactively. Manually, from a clean, up-to-date `main`:

1. **Pick the version** from the commits since the last tag: `feat` → minor, `fix`/`chore`/`docs`/`refactor`/`test` → patch, `BREAKING CHANGE` or `type!:` → major.
2. **Bump and roll the changelog:**
   ```bash
   npm version <x.y.z> --no-git-tag-version   # updates package.json + lockfile only
   ```
   In `CHANGELOG.md`, rename `## [Unreleased]` to `## [x.y.z] - YYYY-MM-DD`, add a fresh empty `## [Unreleased]`, and update the compare links.
3. **Land the release commit** (`chore(release): cut vx.y.z release`). Because `main` is protected, route it through a quick `chore/release-vx.y.z` PR, or merge with `--admin`.
4. **Tag and push the tag** (tags are not blocked by the branch ruleset):
   ```bash
   git tag -a vx.y.z -m "Release vx.y.z" && git push origin vx.y.z
   ```
5. **Create the GitHub release** as a **draft** from the changelog section, then review and publish:
   ```bash
   gh release create vx.y.z --draft --title "vx.y.z" --notes "<the [x.y.z] CHANGELOG section>"
   ```
6. **Build the Docker image** to match the release:
   ```bash
   docker build -t obsidian-markdown-lint-mcp:<x.y.z> -t obsidian-markdown-lint-mcp:latest .
   ```

---

## Issues, security, and license

- Open issues with the bug report or feature request template.
- For security problems, do **not** open a public issue; follow [SECURITY.md](./SECURITY.md).
- By contributing, you agree your contributions are licensed under the [MIT License](./LICENSE) and that you uphold the [Code of Conduct](./CODE_OF_CONDUCT.md).
