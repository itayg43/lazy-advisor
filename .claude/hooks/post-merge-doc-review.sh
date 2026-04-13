#!/usr/bin/env bash
# PostToolUse hook: triggers a documentation quality review after gh pr merge.
# Claude Code passes tool input as JSON on stdin.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null)

if echo "$COMMAND" | grep -q "gh pr merge"; then
  cat <<'EOF'
Post-merge documentation review required. Review every file listed below for the following issues — work through them one file at a time:

1. Stale refs/links — internal links to sections that no longer exist, references to renamed files or functions, outdated plan section numbers, broken relative paths
2. Duplicate/redundant data — information repeated across multiple documents unnecessarily, or content within a file that repeats itself
3. Order/structure — logical section hierarchy, consistent heading levels, related content grouped together, structured for top-to-bottom readability
4. Clarity for future agents — lean and actionable, no ambiguous instructions, no content that only made sense in historical context, no procedural steps now automated by skills

For each file: identify specific issues with their location and propose concrete edits. If a file is clean, confirm it explicitly.

Files to review:
- CLAUDE.md
- documentation/STATUS.md
- documentation/CONVENTIONS.md
- documentation/TESTING.md
- documentation/plan/PLAN.md
- documentation/plan/plan-sections/ (all files)
- documentation/workflow/WORKFLOW.md
- documentation/workflow/STORIES.md
- documentation/workflow/stages/ (all files)
EOF
fi
