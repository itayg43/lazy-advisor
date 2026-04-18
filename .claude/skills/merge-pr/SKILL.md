---
name: merge-pr
model: sonnet
effort: low
description: Merge the current branch's PR, delete the remote and local branch, and sync main.
---

## Steps

### 1. Guard checks

```bash
git status
```

If there are uncommitted changes, stop and report — do not proceed.

### 2. Identify the PR

```bash
gh pr view --json number,title,state,isDraft,mergeable,statusCheckRollup
```

Stop and report if any of the following:
- `state` is not `OPEN`
- `isDraft` is `true`
- `mergeable` is not `MERGEABLE`
- Any status check has failed or is still pending

### 3. Ensure branch is up to date with main

```bash
git fetch origin main
git status -sb
```

If the branch is behind `origin/main`, rebase and force-push:

```bash
git rebase origin/main
git push --force-with-lease
```

Then wait for CI to re-run and re-run Step 2 to confirm all checks pass before continuing.

### 4. Merge

```bash
gh pr merge --merge --delete-branch
```

### 5. Report

Report the merge and stop. (`gh pr merge` handles switching to main, pulling, and deleting the local branch automatically.)
