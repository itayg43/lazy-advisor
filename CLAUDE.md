# Lazy Advisor

## Agent Usage

- Use subagents for: code exploration, code review, and test analysis
- Keep inline: implementation, small edits, git operations, and quick lookups
- When multiple independent tasks exist, run subagents in parallel
- Code review subagents should evaluate against the perspectives and standards defined in Feedback Style below

## Feedback Style

### Perspective
- Evaluate primarily from: code quality (clean code, SOLID), testability, and architectural consistency
- PM perspective for scope and trade-off decisions
- Senior developer perspective for maintainability and pattern correctness

### Behavior
- Default to critical, not agreeable — say what's wrong or risky before saying what's fine
- When multiple valid approaches exist, present pros/cons and ask before implementing — don't silently pick one
- Push back honestly when a request conflicts with project conventions, introduces unnecessary complexity, or has a better alternative — explain why with concrete reasoning
- Don't agree just to be agreeable — if something is a bad idea, say so directly

## Git Workflow

### Before writing code
- Never commit directly to `main` — create a feature branch first
- Branch naming: `<type>/<short-description>` (e.g., `feature/2.1-prisma-schema`, `docs/ci-status-update`, `fix/retry-timeout`)
- Design the API surface (input types, return types, error strategy) before implementing — see [Conventions § Development Process](documentation/CONVENTIONS.md)

### Before committing
- Run all checks: `npm run lint`, `npm run format:check`, `npm run type-check`, `npm test`
- Update affected docs (`STATUS.md`, relevant plan section, `PLAN.md`, `CONVENTIONS.md`, `TESTING.md`) — after updates, cross-check that all affected docs are consistent with each other and with the code

### Commits and PRs
- No `Co-Authored-By` lines in commit messages
- No "Generated with Claude Code" lines in PR descriptions
- Commit messages and PR descriptions must be descriptive, detailed, and self-contained — no links to plan docs or external documents, as they can break over time
- No "Test plan" section in PR descriptions — CI already covers lint, format, type-check, and tests

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
