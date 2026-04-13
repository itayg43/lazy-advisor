---
name: commit-and-push
description: Run all checks, draft a commit message, commit, and push to the current branch. Use when implementation and doc updates are complete.
---

## Steps

### 1. Run checks

Run in sequence — stop immediately and report if any fail:

```
npm run format
npm run lint
npm run type-check
npm test
```

If any check fails, report which one and the full error output. Do not proceed to commit.

### 2. Review changes

Run `git status` and `git diff` to understand what's changing. Note whether eval log files (`*.runs.jsonl`, `*.last-run.md`) are present and need to be staged alongside code.

### 3. Draft commit message

Write a commit message:
- First line: imperative mood, ≤72 chars, describes what changed
- Body: descriptive, detailed, and self-contained — explains what changed and why, with enough context to understand the commit without reading the code
- No `Co-Authored-By` lines
- No links to external documents or plan files (they can break)

Present the draft to the user for approval before committing.

### 4. Commit and push

Stage relevant files by name (never `git add .` or `git add -A`). Commit with the approved message. Push to the current branch.
