---
name: commit
description: Run all checks, draft a commit message, commit, and push to the current branch. Use when implementation and doc updates are complete.
---

## Steps

### 1. Run checks

Run these four commands, each as its own separate tool call, in this order:

```
npm run format
npm run lint
npm run type-check
npm test
```

Hard rules:
- **Sequential only.** One command per Bash call. Do not run them in parallel and do not chain them with `&&`, `;`, or `|`.
- **Verbatim.** No appended flags, no `2>&1`, no `| tail`, no redirection. Run each command exactly as written above.
- **Stop on failure.** If a command fails, stop immediately, report which one and the full error output, and do not proceed to commit.

### 2. Review changes

Run `git status` and `git diff` to understand what's changing. Note whether eval log files (`*.runs.jsonl`, `*.last-run.md`) are present and need to be staged alongside code.

### 3. Check branch

```bash
git branch --show-current
```

If the current branch is `main`, create a branch now — after reviewing the changes so the name reflects what's actually being committed. Use the convention `<type>/<short-description>` (e.g., `feature/2.1-prisma-schema`, `docs/ci-status-update`, `fix/retry-timeout`), then run:

```bash
git checkout -b <branch-name>
```

### 4. Draft commit message

Write a commit message:
- First line: imperative mood, ≤72 chars, describes what changed
- Body: descriptive, detailed, and self-contained — explains what changed and why, with enough context to understand the commit without reading the code
- No `Co-Authored-By` lines
- No links to external documents or plan files (they can break)

### 5. Commit and push

Stage relevant files by name (never `git add .` or `git add -A`). Commit with the drafted message. Push to the current branch.
