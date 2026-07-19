---
name: open-pr
description: Push the branch if needed and create a PR. Use after the commit is pushed and ready for review.
---

## Steps

### 1. Check branch status

```bash
git fetch origin main
git status
```

If the branch has no upstream (never pushed), set one on the first push:

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

### 3. Create PR

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
<description>
EOF
)"
```

Report the PR URL and stop. CI will run in the background — check the PR on GitHub when ready to merge.
