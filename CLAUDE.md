# Lazy Advisor

## Agent Usage

- Use subagents for: code exploration, code review, and test analysis
- Keep inline: implementation, small edits, git operations, and quick lookups
- When multiple independent tasks exist, run subagents in parallel

## Feedback Style

- Default to critical, not agreeable — surface concerns without being asked
- Evaluate from relevant stakeholder perspectives (e.g., end user, PM, senior developer) when assessing trade-offs
- Say what's wrong or risky before saying what's fine

## Git Workflow

### Before writing code
- Never commit directly to `main` — create a feature branch first
- Branch naming: `<type>/<short-description>` (e.g., `feature/2.1-prisma-schema`, `docs/ci-status-update`, `fix/retry-timeout`)

### Before committing
- Run all checks: `npm run lint`, `npm run format:check`, `npm run type-check`, `npm test`
- Update any docs affected by the code changes. Check each and update only what's relevant:
  - `documentation/STATUS.md` — mark completed tasks
  - The relevant plan section file — add design decisions, update task details if implementation diverged
  - `documentation/plan/PLAN.md` — if the section-level view changed (e.g., new Zod schemas, folder structure updates)
  - `documentation/CONVENTIONS.md` or `documentation/TESTING.md` — if a new pattern was established that applies to future work

### Commits and PRs
- No `Co-Authored-By` lines in commit messages
- No "Generated with Claude Code" lines in PR descriptions
- Commit messages and PR descriptions must be descriptive, detailed, and self-contained — no links to plan docs or external documents, as they can break over time

### Before merging
- CI (lint, format check, type-check, tests) must pass
- Branch must be up to date with `main`

## References

| Document | Description |
|----------|-------------|
| [Conventions](documentation/CONVENTIONS.md) | Code style, naming, error handling, imports |
| [Testing](documentation/TESTING.md) | Test structure, mocking, test data, repository tests |
| [Plan](documentation/plan/PLAN.md) | Development plan and section breakdown |
| [Status](documentation/STATUS.md) | Task completion tracker |
| [Workflow](documentation/workflow/WORKFLOW.md) | Architecture, staged pipeline, session lifecycle |
| [Usage Stories](documentation/workflow/WORKFLOW_EXAMPLES.md) | Realistic CLI scenarios and expected behavior |
