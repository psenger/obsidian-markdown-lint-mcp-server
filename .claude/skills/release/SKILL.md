---
name: release
metadata:
  internal: true
description: >
  Ships completed work in the obsidian-markdown-lint-mcp-server repository. Two
  phases depending on context: WRAP UP (on a feature branch with committed work,
  runs the test gates, updates CHANGELOG and README, commits, pushes, opens a draft
  PR) and CUT RELEASE (on main after a merge, determines the semver bump, bumps
  package.json, rolls the CHANGELOG version section, tags, pushes, creates a GitHub
  draft release). Use when the user says "ship this", "I'm done", "create a PR",
  "cut a release", "tag a release", "wrap this up", or "release it". Always checks
  GitHub auth first. Load the conventions skill for commit and PR formatting rules.
allowed-tools: Read, Edit, Bash(git *), Bash(gh *), Bash(npm *), mcp__github__get_me, mcp__github__create_pull_request, mcp__github__pull_request_read, mcp__github__list_releases, mcp__github__get_latest_release
---

# Release

Ships completed work. The skill detects context and runs the right phase:

- **On a feature branch with committed work** → WRAP UP phase
- **On main after a merge** → CUT RELEASE phase

For all message formatting, follow the `conventions` skill.

---

## Step 0: Auth and identity (always)

Check for a GitHub MCP server in available tools. If none:
```bash
gh auth status
```
Stop if neither is available: *"I need the GitHub MCP server or `gh` CLI authenticated. Run `gh auth login`."*

Confirm identity with `mcp__github__get_me`, otherwise:
```bash
gh api user --jq '"@\(.login): \(.name)"'
```
Show the result and ask: *"I'll be acting as @username, is that right?"* Wait for confirmation.

---

## WRAP UP phase

Triggered when on any non-main branch (`feature/`, `fix/`, `chore/`, `refactor/`, `test/`) with a clean working tree.

### Step 1: Verify state

```bash
git branch --show-current     # must not be main
git status --porcelain        # must be empty; all work committed
```
If the tree is dirty, stop: *"You have uncommitted changes. Commit or stash them first."*

### Step 2: Run the gates

Confirm the change is green before opening a PR (CONTRIBUTING requires it):
```bash
npm run build
npm test
npm run eval
```
`npm run snapshot` needs a real Chromium; run it if one is available, otherwise note it as not run. If any gate fails, stop and report.

### Step 3: Detect what changed

```bash
git diff main...HEAD --name-only
```
Determine:
- **New tool or capability** (changes in `src/tools/`, `src/create-server.ts`, or a new file under `src/`) → `### Added`, `feat`
- **Changed behavior** of an existing tool → `### Changed`
- **Bug fix** → `### Fixed`, `fix`
- **Security fix** (dependency or audit) → `### Security`
- **Docs or tooling only** → may not need a changelog entry; use judgement

Derive the issue number from the branch name (e.g. `feature/14-mermaid-theme-option` → `#14`). If none, ask the user.

### Step 4: Update admin files

**CHANGELOG.md**: add a bullet to `## [Unreleased]` under the correct subsection, format (see `conventions`):
```
- **scope**: what changed and why. ([#N](issue-url))
```

**README.md**: only if user-facing behavior changed (a new tool, a changed tool signature, a new option). Update the Tools table, the tool signatures, or the relevant section.

### Step 5: Commit admin updates

```bash
git add CHANGELOG.md README.md
git commit -m "docs(changelog): record <scope> change (#N)"
```
Only stage files that actually changed.

### Step 6: Push and open a PR

```bash
git push -u origin <branch-name>
```

Open a draft PR using the repo template (`.github/PULL_REQUEST_TEMPLATE.md`):
```bash
gh pr create \
  --draft \
  --title "<type>(<scope>): <subject>" \
  --body "$(cat <<'EOF'
## What and why
<brief description and why it is needed>

Closes #<issue-number>

## How
<approach notes; anything reviewers should scrutinize>

## Checklist
- [x] Branched from `main` and kept the change focused
- [x] `npm run build` passes
- [x] `npm test` passes (coverage thresholds met)
- [x] `npm run eval` passes
- [ ] `npm run snapshot` passes (or N/A, explained above)
- [x] `npm audit` shows no new advisories
- [ ] Tests added or updated for the change
- [ ] Docs updated (README / CONTRIBUTING / CHANGELOG) if behavior changed
EOF
)"
```

Print the PR URL. Tell the user: *"Draft PR created: <URL>. Review it, mark it ready, get it approved, and merge to main. Then run `/release` again on main to cut the release."*

---

## CUT RELEASE phase

Triggered when on `main` with a clean working tree.

### Step 1: Pre-flight

```bash
git branch --show-current              # must be: main
git status --porcelain                 # must be empty
git fetch origin
git rev-list HEAD..origin/main --count # must be: 0
```
Abort clearly if any check fails.

### Step 2: Determine version

```bash
git describe --tags --abbrev=0 2>/dev/null   # last tag, e.g. v0.1.0; empty on first release
git log <last-tag>..HEAD --oneline           # commits since last tag (use full log if no tag)
```

Apply semver rules (from `conventions`):
- `BREAKING CHANGE` footer or `type!:` → **major**
- `feat` → **minor**
- `fix`, `chore`, `docs`, `refactor`, `test` → **patch**

If there is no previous tag, this is the first release; default to the current `package.json` version (e.g. `0.1.0`) unless the commits justify higher.

Present the proposed version and the commits that drove it. **Wait for explicit confirmation before proceeding.**

### Step 3: Bump package.json and CHANGELOG

```bash
npm version <X.Y.Z> --no-git-tag-version   # updates package.json + package-lock.json, no commit, no tag
```

Then three `CHANGELOG.md` edits in order:
1. Insert a fresh `## [Unreleased]` heading (with empty body) above the current one
2. Rename the existing `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD` (today's date)
3. Update the comparison links at the bottom:
   - Add `[X.Y.Z]: https://github.com/psenger/obsidian-markdown-lint-mcp-server/compare/<last-tag>...vX.Y.Z` (for the first release, use `.../releases/tag/vX.Y.Z`)
   - Update `[Unreleased]: https://github.com/psenger/obsidian-markdown-lint-mcp-server/compare/vX.Y.Z...HEAD`

### Step 4: Commit and tag

```bash
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore(release): cut vX.Y.Z release"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
```

### Step 5: Push

```bash
git push origin main
git push origin vX.Y.Z
```

> `main` is protected by the `default-branch-protection` ruleset (a pull request is required), so a direct `git push origin main` will be rejected. Either route the release commit through a quick PR (cut a `chore/release-vX.Y.Z` branch, open the PR, merge it), or, as the repo admin, merge with your bypass (`gh pr merge --admin`). The tag push (`refs/tags/...`) is a tag ref and is not affected by the branch ruleset.

### Step 6: Create a draft release

Extract the release body from the `## [X.Y.Z]` CHANGELOG section (down to the next `## [`):
```bash
gh release create vX.Y.Z \
  --draft \
  --title "vX.Y.Z" \
  --notes "<extracted changelog section>"
```

### Step 7: Done

Print:
```
Draft release created: <URL>

Review on GitHub and click Publish when ready.
Publishing triggers any CI release workflows.
```

Do **not** publish the release; the user does this manually.
