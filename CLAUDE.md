# Lazy Advisor

## Agent Usage

- Use subagents for: code exploration, code review, and test analysis
- Keep inline: implementation, small edits, git operations, and quick lookups
- When multiple independent tasks exist, run subagents in parallel
- Code review subagents should evaluate against the perspectives and standards defined in Feedback Style below
- Before editing an existing file, read the full file first — if the addition exposes a structural issue, propose a restructure rather than inserting blindly

## Feedback Style

### Perspective
- Evaluate primarily from: code quality (clean code, SOLID), testability, and architectural consistency
- PM perspective for scope and trade-off decisions
- Senior developer perspective for maintainability and pattern correctness

### Behavior
- Default to critical, not agreeable — say what's wrong or risky before saying what's fine
- When multiple valid approaches exist, present pros/cons and ask before implementing — don't silently pick one
- Push back honestly when a request conflicts with project conventions, introduces unnecessary complexity, or has a better alternative — explain why with concrete reasoning

## Git Workflow

### Before writing code
- Never commit directly to `main` — create a feature branch first
- Branch naming: `<type>/<short-description>` (e.g., `feature/2.1-prisma-schema`, `docs/ci-status-update`, `fix/retry-timeout`)
- Design the API surface (input types, return types, error strategy) before implementing — see [Conventions § Development Process](documentation/CONVENTIONS.md)

### Before committing
- Run all checks: `npm run lint`, `npm run format:check`, `npm run type-check`, `npm test`
- Update `STATUS.md` if task completion status changed
- Only update other docs (`CONVENTIONS.md`, `TESTING.md`, plan sections) if the change introduces a new convention, testing pattern, or design decision — don't repeat what's already in the code

### Commits and PRs
- No `Co-Authored-By` lines in commit messages
- No "Generated with Claude Code" lines in PR descriptions
- Commit messages and PR descriptions must be descriptive, detailed, and self-contained — no links to plan docs or external documents, as they can break over time
- No "Test plan" section in PR descriptions — CI already covers lint, format, type-check, and tests

### Before merging
- CI (lint, format check, type-check, tests) must pass
- Branch must be up to date with `main`

## npm Scripts

Always use these exact commands — do not construct alternative invocations:

| Command | Description |
|---------|-------------|
| `npm run type-check` | TypeScript type checking (no emit) |
| `npm test` | Run unit tests |
| `npm run test:repositories` | Run repository integration tests (resets test DB first) |
| `npm run test:evals` | Run eval tests |
| `npm run dev:server` | Start the server in dev/watch mode |
| `npm run lint` | Lint source files |
| `npm run format` | Auto-format source files |
| `npm run format:check` | Check formatting without writing |

## References

| Document | Description |
|----------|-------------|
| [Conventions](documentation/CONVENTIONS.md) | Code style, naming, error handling, imports |
| [Testing](documentation/TESTING.md) | Test structure, mocking, test data, repository tests |
| [Plan](documentation/plan/PLAN.md) | Development plan and section breakdown |
| [Status](documentation/STATUS.md) | Task completion tracker |
| [Workflow](documentation/workflow/WORKFLOW.md) | Architecture, staged pipeline, session lifecycle |
| [Usage Stories](documentation/workflow/WORKFLOW_EXAMPLES.md) | Realistic CLI scenarios and expected behavior |
