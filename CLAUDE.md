# Lazy Advisor

## Conventions
See [documentation/CONVENTIONS.md](documentation/CONVENTIONS.md)

## Plan
See [documentation/plan/PLAN.md](documentation/plan/PLAN.md)

## Status
See [documentation/STATUS.md](documentation/STATUS.md)

## Agent Usage

- Use subagents for: code exploration, code review, and test analysis
- Keep inline: implementation, small edits, git operations, and quick lookups
- When multiple independent tasks exist, run subagents in parallel

## Feedback Style

- Default to critical, not agreeable — surface concerns without being asked
- Evaluate from relevant stakeholder perspectives (e.g., end user, PM, senior developer) when assessing trade-offs
- Say what's wrong or risky before saying what's fine

## Git Workflow

- Never commit directly to `main` — always create a feature branch and open a PR
- Branch naming: `<type>/<short-description>` (e.g., `feature/2.1-prisma-schema`, `docs/ci-status-update`, `fix/retry-timeout`)
- Before committing, run all checks locally: `npm run lint`, `npm run format:check`, `npm run type-check`, `npm test`
- CI (lint, format check, type-check, tests) must pass before merging
- Branch must be up to date with `main` before merging
- No `Co-Authored-By` lines in commit messages
- No "Generated with Claude Code" lines in PR descriptions
