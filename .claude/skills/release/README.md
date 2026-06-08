# release

Project-local skill for the **obsidian-markdown-lint-mcp-server** repository. Ships completed work in two phases depending on context: **WRAP UP** (on a feature branch) and **CUT RELEASE** (on `main` after a merge).

## Invocation

Invoke it explicitly:

```
/release
```

The skill detects your current branch and runs the correct phase.

## Two phases

### WRAP UP, run on your feature branch

When you are on a non-main branch with a clean tree, the skill:

1. Checks GitHub auth and confirms identity
2. Verifies the working tree is clean
3. Runs `npm run build`, `npm test`, `npm run eval` to confirm green
4. Detects what changed (new tool, changed tool, fix, docs)
5. Adds a `CHANGELOG.md` entry under `## [Unreleased]`
6. Updates `README.md` if user-facing behavior changed
7. Commits the changelog/readme update
8. Pushes the branch and opens a draft PR using the repo PR template
9. Prints the PR URL

### CUT RELEASE, run on `main` after merging

When you are on `main`, clean and synced, the skill:

1. Checks GitHub auth and confirms identity
2. Pre-flight: on main, clean, synced with origin
3. Determines the next semver version from commits since the last tag, and waits for confirmation
4. Bumps `package.json` with `npm version`
5. Rolls `CHANGELOG.md` `[Unreleased]` into `[X.Y.Z] - YYYY-MM-DD` and updates the compare links
6. Commits `chore(release): cut vX.Y.Z release` and creates the annotated tag `vX.Y.Z`
7. Pushes, then creates a draft GitHub release (does not publish)

> `main` is protected by a branch ruleset, so the release commit must go through a PR or your admin bypass. Pushing the tag is unaffected. See the skill for details.

## Full workflow

```
/start #14            create the issue branch
  ... do the work, commit with Conventional Commits ...
/release              WRAP UP: changelog + PR
  ... approve and merge the PR on GitHub ...
git checkout main && git pull
/release              CUT RELEASE: version bump + tag + draft release
  ... review and publish the release on GitHub ...
```

## Prerequisites

- `gh` CLI authenticated (or the GitHub MCP server)
- Clean working tree (all work committed)
- For CUT RELEASE: on `main`, synced with `origin/main`
