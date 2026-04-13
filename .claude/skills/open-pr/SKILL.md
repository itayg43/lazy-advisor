---
name: open-pr
description: Push the branch if needed, create a PR, and wait for CI. Use after the commit is pushed and ready for review.
---

## Steps

### 1. Check branch status

```bash
git fetch origin main
git status
```

If the current branch has no upstream (never been pushed), push it first:

```bash
git push -u origin <branch>
```

If the current branch is behind `main`, rebase and force-push:

```bash
git rebase origin/main
git push --force-with-lease
```

If the branch has an upstream but local commits haven't been pushed yet, push:

```bash
git push
```

### 2. Draft PR

Write the PR title and description:
- Title: ≤70 chars, describes what the PR does (not "fix" unless it's a bug fix)
- Description: descriptive, detailed, and self-contained — no "Generated with Claude Code", no "Test plan" section
- Suggested structure: `## Summary` with bullet points, plus any relevant context on decisions or trade-offs

Present the draft to the user for approval before creating.

### 3. Create PR

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
<description>
EOF
)"
```

### 4. Wait for CI

```bash
gh pr checks --watch
```

Report the result. If CI passes, say so and stop — merging is a separate step. If CI fails, report what failed.
