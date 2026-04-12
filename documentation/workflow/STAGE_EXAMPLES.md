# Stage Examples Index

## Stages

| Stage | File | Contents |
|-------|------|----------|
| Stage 1 — Clarify | [CLARIFY_EXAMPLES.md](CLARIFY_EXAMPLES.md) | Gap-filling, redirects, portfolio defaults, investment preferences |
| Stage 2 — Research | [RESEARCH_EXAMPLES.md](RESEARCH_EXAMPLES.md) | Allocation logic, Israeli defaults, ETF extraction |

## Debugging Failing Evals

When an eval fails, check the `*.last-run.md` file alongside the eval before doing anything else. It contains the full transcript of what the model said and did — this is usually enough to diagnose the failure without rerunning.

Common failure patterns and how the transcript reveals them:

- **Overflow throw** (`no response scripted for turn N`): the transcript shows all turns up to the throw. Count the agent questions — the test has fewer scripted responses than the model asked for. Add the missing response.
- **Assertion failure**: the extracted profile is shown at the bottom. Check whether the assertion is too strict (e.g., the model chose `conservative` where `moderate` was expected and both are valid), or whether the model genuinely extracted the wrong value. Loosen the assertion or fix the prompt accordingly.
- **Stage error before transcript**: the last-run entry will be missing or empty. Look at the test's scripted responses — one may be an unexpected or nonsensical answer that caused the stage to error out.

After diagnosing, make the minimal fix (add a response, adjust an assertion, fix the prompt) and rerun the specific eval file to confirm.
