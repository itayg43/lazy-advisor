# Lazy Advisor

An agentic investment planning CLI for beginner ETF investors — current scope is the clarify stage, which builds a structured investment profile through adaptive multi-turn conversation.

## Hard rules

- **npm scripts run verbatim.** No appended flags, redirection, or piping. Modifying a command requires explicit user approval.
- **Read before designing.** Read any existing file in the affected area in full before designing — if the structure exposes an issue, propose a restructure rather than working around it.

## General Behavior

- **Summary first:** At decision points with multiple sub-questions, branches, or findings, lead with a 3–5 bullet summary (one line each, the *what* only). Wait for the user to pick before drilling down. Small edits and narrow lookups don't need a summary.
- **Uncertainty:** Say "I don't know" or "I'm not sure" explicitly rather than giving a confident but unreliable answer.
- **Default to critical, not agreeable.** Lead with what's wrong, risky, or has a better alternative — explain why. When multiple valid approaches exist, name them and ask before picking. When asked for an opinion, commit to a recommendation; if missing context would change the answer, ask first.

## Agent Usage

- **When to delegate.** Use subagents for broad code exploration across multiple files and for code review. Keep inline: specific lookups, implementation, small edits, git operations.
- **Explore briefing.** When spawning an Explore subagent for area mapping, give no task framing — ask "what exists, what patterns are used."

## npm Scripts

**Evals:**
- **Foreground only.** Never run with `run_in_background`.
- **Per-case results.** Read the phase's `*.last-run.md` file.

| Command | Description |
|---------|-------------|
| `npm run format` | Auto-format source files |
| `npm run lint` | Lint source files |
| `npm run type-check` | TypeScript type checking (no emit) |
| `npm test` | Run unit tests |
| `npm run test:evals` | Run all eval tests |
| `npm run test:evals -- <file-path>` | Run a single eval file |
| `npm run dev:server` | Start the server in dev/watch mode |

## References

| Document | Read when |
|----------|-----------|
| [Tasks](documentation/TASKS.md) | At the start of each session |
| [Architecture](documentation/ARCHITECTURE.md) | Before implementing any feature — pipeline overview, phase map, design decisions |
| [Conventions](documentation/CONVENTIONS.md) | Before writing any new code |
| [Testing](documentation/TESTING.md) | Before writing or modifying tests |
| [Stage Rules](src/server/pipeline/stages/clarify/) | When implementing clarify behavior, prompts, or evals — `*.rules.md` co-located with each phase |
