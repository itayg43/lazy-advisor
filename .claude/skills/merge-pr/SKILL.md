---
name: merge-pr
description: Squash-merge the current branch's PR, delete the remote and local branch, and sync main.
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

### 3. Confirm

Show the PR number and title, then ask the user to confirm before merging.

### 4. Merge

```bash
gh pr merge --squash --delete-branch
```

### 5. Sync local main and clean up local branch

Note the branch name before switching.

```bash
git checkout main
git pull
git branch -d <branch>
```

Report the merge and stop.
