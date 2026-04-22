---
name: align-docs
description: After a PR is merged, review all documentation and CLAUDE.md for drift against the merged changes. Proposes edits for user review before applying.
---

## Steps

### 1. Get the merged changes

```bash
git log --oneline -3
git diff HEAD~1 HEAD --stat
git diff HEAD~1 HEAD
```

Hold the full diff in context — it is the lens for the entire review.

### 2. Enumerate documentation

Enumerate the full documentation set using Glob:
- `CLAUDE.md`
- Every file under `documentation/`
- Every `*.rules.md` file under `src/` (co-located stage/phase rules — behavior specs that drive prompts and evals)

Do not read them — the subagent will.

### 3. Spawn an Explore subagent for the review

Give the subagent:
- The full diff from Step 1
- The list of doc files from Step 2

Mission:

> Read every doc file listed. Then, using the diff as your lens, check each file for the following and report every issue you find:
>
> 1. **Stale references** — file paths, function names, module names, script commands, or relative links that no longer match the codebase after the diff
> 2. **Code-doc alignment** — things the diff added, changed, or removed that should be reflected in docs but aren't (focus on externally visible behavior: new stages, renamed files, changed commands, updated conventions, new workflows — not internal implementation details)
> 3. **Duplication** — the same information stated in more than one place across the doc set
> 4. **Clarity** — instructions that are verbose, vague, or harder to follow than they need to be
> 5. **Structure** — sections in the wrong order, broken hierarchy, or content that belongs in a different doc
>
> For every issue report: file path, section heading, issue type, the current text, and a concrete proposed replacement or action. Number findings sequentially across all files.
>
> **Severity note:** Drift in a `*.rules.md` file is higher severity — it's a live runtime contract, not just documentation.

### 4. Present findings

Display all findings as a numbered list. For each:
- File and section
- Issue type
- Current text
- Proposed change

Then ask: **"Which numbers should I apply?"**

### 5. Apply approved changes

For each approved finding, apply the edit and confirm it before moving to the next. Skip the rest.
