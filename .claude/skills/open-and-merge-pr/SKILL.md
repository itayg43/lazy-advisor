---
name: open-and-merge-pr
description: Create a PR, wait for CI, squash merge, delete the branch, and switch back to main. Use after the commit is pushed and ready for review.
---

## Steps

### 1. Check branch status

```bash
git fetch origin main
git status
```

If the current branch is behind `main`, rebase and force-push:

```bash
git rebase origin/main
git push --force-with-lease
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

If CI fails: stop, report what failed, and do not merge. Wait for the user to fix it.

### 5. Merge and clean up

```bash
BRANCH=$(git branch --show-current)
gh pr merge --squash --delete-branch
git checkout main
git pull
git branch -d "$BRANCH"
```

Report the final state: branch merged, now on main.
