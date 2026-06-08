# start

Project-local skill for the **obsidian-markdown-lint-mcp-server** repository. Begins a new piece of work: fetches or creates a GitHub issue, then cuts a correctly named branch from `main`.

## Invocation

Invoke it explicitly:

```
/start #14
/start I need a transparent-background option for rendered SVGs
/start https://github.com/psenger/obsidian-markdown-lint-mcp-server/issues/5
```

## Two modes

### EXISTING ISSUE
Pass an issue number, URL, or reference. The skill checks auth, fetches the issue and confirms it, pulls latest `main`, and cuts `feature/<N>-<slug>` or `fix/<N>-<slug>`.

### NEW ISSUE
Pass a description. The skill classifies it as feature or bug, drafts an issue from the matching form in `.github/ISSUE_TEMPLATE/`, waits for your approval, creates the issue with the right label (`enhancement` or `bug`), and cuts the branch.

## Branch naming

| Label | Prefix | Example |
|---|---|---|
| `enhancement` / `feature` | `feature/` | `feature/14-mermaid-theme-option` |
| `bug` | `fix/` | `fix/23-lint-trailing-newline` |
| Other | `feature/` | (default) |

See the `conventions` skill for the full naming spec.

## Prerequisites

- `gh` CLI authenticated (or the GitHub MCP server)
- Clean working tree on `main`
