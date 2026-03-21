# Lazy Advisor

## Conventions
See [documentation/CONVENTIONS.md](documentation/CONVENTIONS.md)

## Plan
See [documentation/plan/PLAN.md](documentation/plan/PLAN.md)

## Status
See [documentation/STATUS.md](documentation/STATUS.md)

## Git Workflow

- Never commit directly to `main` — always create a feature branch and open a PR
- Branch naming: `<type>/<short-description>` (e.g., `feature/2.1-prisma-schema`, `docs/ci-status-update`, `fix/retry-timeout`)
- Before committing, run all checks locally: `npm run lint`, `npm run format:check`, `npm run type-check`, `npm test`
- CI (lint, format check, type-check, tests) must pass before merging
- Branch must be up to date with `main` before merging
