# conventions

Project-local skill for the **obsidian-markdown-lint-mcp-server** repository. Defines the commit message format, branch naming, PR body structure, CHANGELOG entries, and semver rules used by the `start` and `release` skills.

## Invocation

Primarily loaded as a dependency by `start` and `release`. It also activates when you ask a formatting question directly:

```
/conventions
what commit type should I use here?
how do I format this changelog entry?
what's the branch naming convention?
```

## What it covers

| Topic | Details |
|---|---|
| Commit messages | `type(scope): subject`, Conventional Commits |
| Valid types | `feat`, `fix`, `chore`, `docs`, `refactor`, `test` |
| Scopes | code areas (`tools`, `lint`, `validate`, `mermaid`, `server`, `lib`, `schemas`); repo areas (`ci`, `docker`, `deps`, `readme`, `release`) |
| Branch naming | `feature/<N>-slug`, `fix/<N>-slug`, `chore/slug` |
| PR body | the repo PR template, with `Closes #N` |
| CHANGELOG | Keep a Changelog 1.1.0 |
| Semver | `BREAKING` / `feat` / `fix` maps to major / minor / patch |
