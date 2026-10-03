# Eval Best Practices — notes from the monday.com AI post

Source: LinkedIn post by a monday.com AI director describing how they set up and
run evals after expanding their AI products. Captured here to compare against our
allocation-phase evals and decide what to adopt.

---

## What they do (best practices)

### Two eval tracks

1. **Offline evals** — labeled datasets run in CI to catch regressions *before*
   code reaches users (and to evaluate new models). Blocks the PR if accuracy
   drops below a threshold (e.g. 85%).
2. **Online evals** — monitoring live production traffic to measure quality,
   catch drift, and surface issues in real time.

> Their stated goal (from an internal "Evals Hackathon"): a full pipeline from
> online evals in prod all the way down to offline evals that block PRs in CI.

### The 7-step offline flow (packaged as a Claude Code skill)

Built on **LangSmith**. Delivered as an in-repo Claude Code skill — "zero build
steps, zero new dependencies," doesn't touch the team's repo structure.

1. **Setup** — preflight checks, LangSmith config, auto-create the evals folder.
2. **Create Dataset** — pull real traces from LangSmith (or read existing
   fixtures / `samples.ts`).
3. **Label Dataset** — the skill shows samples and lets you define
   `expectedOutput` to build trustworthy **ground truth**.
4. **Suggest Metrics** — scans the code and proposes built-in metrics
   (match rate, semantic similarity, latency SLO, schema validity) and a pass
   threshold.
5. **Target Init** — link the agent's own **Runner** directly to the evals
   runner, so the tests exercise exactly what runs in prod.
6. **Run** — full local eval run on the new data; scores auto-upload to LangSmith
   for analysis and visualization.
7. **CI Workflow** — a GitHub Actions file that runs the evals on every PR and
   blocks merge if accuracy falls below the threshold.

### Two infrastructure decisions

- **Code-based judges over LLM-as-a-judge.** LLM judges are flexible but
  "expensive, slow, and prone to inconsistency." They prefer deterministic
  code-based judges for everything possible (e.g. verifying the agent called a
  tool with the correct arguments) and use an LLM judge **only as a last resort**.
- **`mirrord` instead of a local test env.** Agents need internal services (their
  LLM gateway). Rather than standing up a complex environment on laptops/CI, they
  run the eval runner through `mirrord`, which tunnels local code so it behaves as
  if it runs inside their test cluster — free access to all internal services.

### Key correction to a common misreading

Their CI evals **still call the real model.** The dataset is *labeled inputs →
expected outputs* (ground truth), not recorded outputs replayed offline. What
makes it CI-safe is (a) deterministic **code-based judgment** and (b) **`mirrord`**
for env access — not avoiding the LLM call.

---

## Online evals in depth (how live-traffic evaluation works)

> The post doesn't detail monday's online setup — this is a general read of how
> these systems work, not their specifics.

The defining constraint: **online evals have no answer key.** Offline evals
compare output to a labeled `expectedOutput`; a live user typed something never
seen before, with no human-written correct answer to compare against. Every online
technique is a workaround for *"how do I judge quality when I don't know the right
answer?"*

### Measuring quality without ground truth (cheapest → most expensive)

1. **Cheap deterministic signals** — schema valid? tool call succeeded? latency
   under SLO? conversation finished vs. hit the turn ceiling? No ground truth
   needed; the output is either well-formed or not. This is the floor (and is
   really just production *monitoring*).
2. **Implicit user-behavior signals** — the user's reaction is a free quality
   label: accepted vs. immediately rephrased, thumbs up/down, abandoned mid-flow,
   asked the same thing twice. For our allocation phase: "countered 3× before
   accepting" or "hit `hardStopTurns`" is exactly this — the conversation itself
   signals it went badly, no judge needed.
3. **LLM-as-a-judge on a *sample* of live traffic** — take ~1–5% of real
   conversations and run a rubric-based judge, but on **reference-free** criteria
   ("coherent? on-topic? right tone?") rather than "matches expected answer."
   Sampled, not 100%, because judging all of prod is too expensive.
4. **Human review** — lowest-volume, highest-trust; a person spot-checks flagged
   conversations, and those become **new labeled dataset rows** for the offline
   suite.

### Is the offline dataset used to score live traffic? No.

Live inputs aren't in the dataset, so you can't compare against it. The
relationship runs the other way: **live traffic feeds the dataset** (their step 2,
"pull real traces from LangSmith"). Interesting production failures get captured,
labeled, and become permanent offline regression tests.

### What "drift" means

Quality silently degrading over time **even though your code never changed** — so
there's no PR and no CI run to catch it. Common causes:

- **Model drift** — the provider updates the model behind `gpt-5.4`; same prompt,
  different outputs.
- **Input/population drift** — the *users* change (new market, new language, new
  question types the prompt wasn't tuned for).
- **Concept drift** — the world changes and old answers become wrong (minor for a
  rules-based advisor, major for time-sensitive domains).

Detection = **track a quality metric as a time series** and watch for a downward
trend or step-change ("acceptance was 88% last month, 79% this week"). Offline
evals are a snapshot at merge time; online drift detection is the continuous line
on a chart — which is why it's a *separate* track, not "run offline evals in prod."

### Surfacing issues — two tiers

- **Hard issues** — invalid schema, network/timeout errors, crashes. Binary,
  immediate, alertable; really just production monitoring.
- **Soft issues** — well-formed and returns 200, but wrong/off-tone/unhelpful.
  Need the sampled LLM-judge or behavior signals to catch, since a schema check
  waves them through. This is where online evals earn their keep over monitoring.

### Takeaway for us (pre-prod)

Online evals are aspirational until there's live traffic — but **design for it
now**: keep logging full traces (the transcript machinery already exists) and
capture implicit signals (turn counts, give-up exits, counter-proposal counts) so
the online layer becomes a query over data we already collect, not a retrofit.

---

## How this compares to our allocation evals (at a glance)

| Dimension | monday.com | Us (allocation) |
|-----------|-----------|-----------------|
| Real model calls in evals | Yes | Yes |
| Runs in CI / blocks PRs | Yes (threshold gate) | **No** — manual `test:evals` only |
| Ground-truth labeled dataset | Yes (`expectedOutput`) | **No** — assertions inline in the test file |
| Code-based judges | Default | Yes (regex/exact-value assertions) |
| LLM-as-a-judge | Last resort | 6 subjective criteria, **fails** the eval |
| Recorded run artifacts | LangSmith | `last-run.md` + `runs.jsonl` |
| Online / prod evals | Yes | N/A (pre-prod) |

---

## Three open points to discuss

### A — CI gate + threshold (their steps 6–7)
We run `test:evals` manually, only when we touch the logic or the prompt; it never
blocks a merge. Adopting a CI gate raises real obstacles: per-PR API cost, the
`OPENAI_API_KEY` as a CI secret, and LLM-judge flakiness turning the gate red on
borderline prose. A threshold gate (pass rate, not all-green) is how they absorb
that flakiness.

**What a threshold actually protects (not "we tolerate 15% wrong"):**

- **Grader noise.** Our LLM judge grades subjective prose, so a borderline turn
  can pass one run and fail the next on identical input. All-green turns one
  flipped verdict into a red PR; the author learns the gate lies and starts
  re-running until green — which destroys the gate. A threshold absorbs the flip
  (19/20 still clears 85%) so red stays meaningful.
- **Regression vs. blip.** A pass *rate* shows how far you fell: 95%→94% is noise,
  95%→70% is a real break. All-green can't tell those apart.
- **The tradeoff.** A threshold *can* mask a genuine single-case regression that
  stays above the line — which is why it's paired with online evals + a growing
  dataset (the leak surfaces in prod and becomes a new labeled row), not left as
  the only safety net.
- **Corollary → point B.** For a *deterministic code-based* check, flakiness is
  zero, so the bar is 100% — any failure is real. The sub-100% threshold exists
  *because* an LLM judge is in the loop. So the more criteria we push to code, the
  higher we can safely set the gate.

### B — Code-based vs LLM-judge rebalancing
Our judge grades six subjective criteria and *fails* the eval on them. Their
guidance: push everything you can to deterministic code, keep the LLM judge as a
last resort. Some of our criteria may be code-checkable (e.g. `english-body`, and
arguably parts of `no-risk-labeling`), which would shrink the nondeterministic
surface.

### C — Labeled dataset + fail-vs-record
Our cases live as inline assertions in `clarify.allocation.eval.ts`, not a
separable input→expectedOutput dataset. This ties into open **Finding #5**
(`ALLOCATION_AUDIT.md`): the LLM judge fails the eval nondeterministically. The
unresolved question — should a subjective judge *fail* the run, or only be
*recorded* to the artifact for human review — is the same tension their
code-first / threshold-gate approach is designed to sidestep.

**The real axis is artifact-vs-prose, not single-turn-vs-multi-turn.** It's
tempting to say "their model fits single-shot agents and ours doesn't" — but
monday's own **Vibe** (build a board/app through conversation) is multi-turn and
still fits their offline setup. Conversational agents fold back into
`input → expectedOutput` in several ways: grade the **final artifact** not the
chat (Vibe ends in a board schema — deterministically checkable); a **simulated
user** to make the path reproducible; **per-turn** eval with the
conversation-so-far as input; or **trajectory** eval (reached the goal? how many
turns? sensible tool order?). So multi-turn isn't the blocker — the blocker is
that Vibe *terminates in a structured artifact* a code check can diff, whereas our
allocation phase terminates partly in **prose** (tone, framing) with no artifact,
which is why we're stuck with an LLM judge where Vibe leans on code. Point C's
task is to **manufacture a checkable artifact out of our conversation**, not to
escape multi-turn.

**Two things still make our case harder than Vibe's.** Even with an artifact to
grade:

- **The input is a whole path, not a value.** Turn 4's correct behavior depends on
  turns 1–3, so a row must pin the entire preceding transcript. Our
  `runAllocation(input, replies)` already does this — the `replies` array *is* the
  frozen user path — so a row is `(profile + reply sequence) → per-turn
  assertions`, not `input → output`.
- **Reply generation drifts the path.** Our user replies are themselves
  nano-composed for naturalness, so a valid conversation can branch differently
  run-to-run. A fixed labeled output against one branch would false-fail whenever
  another valid branch is taken.

**The shape that fits us:** a dataset of `(profile, reply-path) → per-turn
structural assertions`, where the code-checkable facts (split math, question
presence, English body) are ground truth thresholded at 100%, and the
irreducibly subjective bits (tone, conciseness) stay with a sampled LLM judge
thresholded below 100%. This is *why C precedes A*: until structural facts are
split from subjective prose, there's nothing clean to point a CI gate at.
