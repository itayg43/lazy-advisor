## Section 12: Eval Infrastructure

**Goal**: Tooling and infrastructure that supports eval quality, reliability, and debuggability — independent of any specific pipeline stage.

### Design Decisions

- **Co-located `.runs.jsonl` files** — run logs sit next to their eval file (e.g., `clarify.stage.runs.jsonl`) rather than a central `eval-runs/` directory. Keeps history close to the test it describes; easier to find, delete, or inspect per stage.
- **JSONL over JSON** — append-only writes; no read-parse-rewrite cycle, no merge conflicts, trivially grep-able.
- **Custom Vitest reporter over `afterEach` hooks** — a reporter in `vitest.config.evals.ts` applies to all current and future eval files with zero changes to individual eval files. `afterEach` hooks would require adding boilerplate to every eval file.
- **History tracking deferred from trials and observability** — see [EVALS_LEARNINGS.md](../../EVALS_LEARNINGS.md) for full rationale.

### Tasks

| Task | Summary | Status |
|------|---------|--------|
| 12.1 | Eval run history — custom Vitest reporter writing `.runs.jsonl` per eval file | Pending |
