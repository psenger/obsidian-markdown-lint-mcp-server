---
name: conventions
metadata:
  internal: true
description: >
  Defines the commit message, branch naming, pull request, and release note
  conventions for the obsidian-markdown-lint-mcp-server repository. Make sure to
  load this skill whenever writing a commit message, naming a branch, drafting a
  PR title or body, or writing CHANGELOG entries in this repo. Use when the user
  asks "how should I format this commit", "what's the branch naming convention",
  "how do I write the PR", "what commit type should I use", or before any git
  commit, PR creation, release note, or CHANGELOG task in this project.
allowed-tools: Read
---

# Conventions: obsidian-markdown-lint-mcp-server

---

## Commit messages

Format: `type(scope): subject`

- **Subject:** imperative mood, lowercase, no trailing period, 72 characters or fewer
- **Scope:** the code area touched (`tools`, `lint`, `validate`, `mermaid`, `server`, `lib`, `schemas`) or a repo area (`ci`, `docker`, `deps`, `readme`, `release`)
- **Body:** optional; explain *why*, not *what*; wrap at 72 chars
- **Footer:** `Closes #N` or `Fixes #N` for GitHub issues; `BREAKING CHANGE: <desc>` for breaking changes

Do not add `Co-Authored-By` trailers.

### Types

| Type       | When |
|------------|------------------------------------------------------------|
| `feat`     | New tool, or a new capability in an existing tool           |
| `fix`      | Bug fix in tool behaviour or output                        |
| `chore`    | Release commits, tooling, deps, config; no behaviour change |
| `docs`     | README, CHANGELOG, CONTRIBUTING only                       |
| `refactor` | Code restructure with no behaviour change                  |
| `test`     | Unit, eval, or snapshot test changes                       |

### Release commit, always exactly:
```
chore(release): cut vX.Y.Z release
```

### Examples
```
feat(mermaid): add per-document theme override
```
```
fix(lint): preserve trailing newline in fixed_content

Closes #12
```

---

## Branch names

Pattern: `type/issue-number-short-description`

```
feature/14-mermaid-theme-option
fix/23-lint-trailing-newline
chore/release-v0-2-0
```

- `feature/` for new tools or capabilities
- `fix/` for bug fixes
- `chore/` for release and tooling work
- Always include the issue number when one exists
- 2 to 4 words, hyphenated, no version dots (use dashes)

---

## Pull requests

**Title:** same format as a commit, `type(scope): subject`

Fill in the repo PR template at `.github/PULL_REQUEST_TEMPLATE.md`. It expects: what and why, how, and the checklist (build, test, eval, snapshot, audit, tests added, docs updated). Always link the issue with `Closes #N`.

---

## CHANGELOG entries (Keep a Changelog 1.1.0)

Entries live in `CHANGELOG.md` under `## [Unreleased]`:

```markdown
### Added
- **scope**: what was added and why it matters. ([#N](url))

### Changed
- **scope**: what changed and the user-visible impact. ([#N](url))

### Fixed
- **scope**: what was broken and what was fixed. ([#N](url))
```

- Bold the scope, plain English, issue link at the end
- `### Added` for new tools or features, `### Changed` for changes, `### Fixed` for bugs, `### Security` for security fixes
- One bullet per logical change

---

## Versioning

Semver from conventional commits since the last tag; `package.json` `version` is the source of truth:

| Commit                                     | Bump  |
|--------------------------------------------|-------|
| `BREAKING CHANGE` or `type!:`              | major |
| `feat`                                     | minor |
| `fix`, `chore`, `docs`, `refactor`, `test` | patch |

A new tool = `feat` = **minor** bump. Tag format: `vX.Y.Z` (annotated tag), matching `package.json`.
