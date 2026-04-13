# Lazy Advisor

## Agent Usage

- Use subagents for: broad code exploration and pre-implementation area mapping (multiple files or areas — see Before Writing Code below), and code review
- Keep inline: looking up a specific file or function, implementation, small edits, git operations
- When multiple independent tasks exist, run subagents in parallel
- Code review subagents should evaluate against the perspectives and standards defined in Feedback Style below

## References

| Document | Read when |
|----------|-----------|
| [Status](documentation/STATUS.md) | At the start of each session |
| [Plan](documentation/plan/PLAN.md) | When starting a new task — confirms scope and task definition; read before the exploration step |
| [Conventions](documentation/CONVENTIONS.md) | Before writing any new code |
| [Testing](documentation/TESTING.md) | Before writing or modifying tests |
| [Workflow](documentation/workflow/WORKFLOW.md) | Before implementing pipeline features, stages, or session behavior |
| [Decisions](documentation/DECISIONS.md) | Before implementing a new stage or cross-cutting change |
| [Usage Stories](documentation/workflow/STORIES.md) | When implementing stage behavior or LLM prompts |
| [Stage Rules](documentation/workflow/stages/) | When implementing any stage's behavior, prompts, or evals |

## Feedback Style

### Perspective
- Evaluate primarily from: code quality (clean code, SOLID), testability, and architectural consistency
- PM perspective for scope and trade-off decisions
- Senior developer perspective for maintainability and pattern correctness

### Behavior
- Default to critical, not agreeable — say what's wrong or risky before saying what's fine
- When multiple valid approaches exist, present pros/cons and ask before implementing — don't silently pick one
- Push back honestly when a request conflicts with project conventions, introduces unnecessary complexity, or has a better alternative — explain why with concrete reasoning

## Session Workflow

Work one task at a time. Each task must be fully closed before moving to the next:
- Implementation complete
- Docs updated (`STATUS.md` + any relevant plan section)
- Use `/commit-and-push` to run checks and commit, then `/open-pr` to create the PR

If a refactor or design question surfaces mid-task, note it but do not act on it until the current task is closed. New sessions are a natural boundary — start each session by confirming which single task to work on.

## Before Writing Code
- For tasks touching multiple files or areas: spawn an Explore subagent to map the affected area with no task framing ("what exists, what patterns are used"), then compare findings against the plan before designing
- Read any existing file in the affected area in full before designing — if the structure exposes an issue, propose a restructure rather than working around it
- Design the API surface (input types, return types, error strategy) before implementing — see [Conventions § Development Process](documentation/CONVENTIONS.md)

## npm Scripts

Always use these exact commands — do not construct alternative invocations:

| Command | Description |
|---------|-------------|
| `npm run format` | Auto-format source files |
| `npm run lint` | Lint source files |
| `npm run type-check` | TypeScript type checking (no emit) |
| `npm test` | Run unit tests |
| `npm run test:repositories` | Run repository integration tests (resets test DB first) — Prisma's AI safety guard will prompt for confirmation before `db push --force-reset`; respond with "yes" to proceed |
| `npm run test:evals` | Run all eval tests |
| `npm run test:evals -- <file>` | Run a single eval file (e.g. `npm run test:evals -- src/server/pipeline/stages/research/research.extraction.eval.ts`) |
| `npm run dev:server` | Start the server in dev/watch mode |

