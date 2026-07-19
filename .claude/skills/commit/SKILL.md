---
name: commit
description: Draft a commit message, commit, and push to the current branch. Use when implementation and doc updates are complete.
---

Checks run automatically via git hooks, not in this skill:

- **pre-commit** (`lint-staged`): `secretlint` on all staged files, plus `prettier --write` and `eslint --fix` on staged `src/**/*.ts`. Formatting fixes are re-staged automatically.
- **pre-push**: `npm run type-check` then `npm test` over the whole repo.

Do not run `format`, `lint`, `type-check`, or `test` manually — let the hooks own them.

## Steps

### 1. Review changes

Run `git status` and `git diff` to understand what's changing. Note whether eval log files (`*.runs.jsonl`, `*.last-run.md`) are present and need to be staged alongside code.

### 2. Check branch

```bash
git branch --show-current
```

If the current branch is `main`, create a branch now — after reviewing the changes so the name reflects what's actually being committed. Use the convention `<type>/<short-description>` (e.g., `feature/2.1-prisma-schema`, `docs/ci-status-update`, `fix/retry-timeout`), then run:

```bash
git checkout -b <branch-name>
```

### 3. Draft commit message

Write a commit message:
- First line: imperative mood, ≤72 chars, describes what changed
- Body: descriptive, detailed, and self-contained — explains what changed and why, with enough context to understand the commit without reading the code
- No `Co-Authored-By` lines
- No links to external documents or plan files (they can break)

### 4. Commit and push

Stage relevant files by name (never `git add .` or `git add -A`). Commit with the drafted message, then push to the current branch.

If the branch has an upstream, `git push`. If it has none (never pushed — e.g. a branch created in step 2), set one on the first push with `git push -u origin <branch>`.

If a hook fails:
- **pre-commit** aborts the commit. Fix the reported issue, re-stage, and commit again. If `prettier`/`eslint --fix` modified files, they are already re-staged — just re-run the commit.
- **pre-push** aborts the push (commit is already made). Fix the `type-check` or `test` failure, commit the fix, and push again. Never bypass with `--no-verify`.
