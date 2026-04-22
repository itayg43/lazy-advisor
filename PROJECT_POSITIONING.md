# Project Positioning Notes

Strategic reflection on how this project reads to interviewers and what to do about it. Not build documentation — for build docs see `documentation/`.

## The concern

The project's hardest work so far has been the clarify stage — small phases with typed I/O controlling LLM conversation flow. This is interesting engineering, but:

- It is not "magical" in the way autonomous-agent demos are magical
- The rigor is invisible at a glance (typed phases, evals, rules docs, phased refactor plan don't show up in a screenshot)
- Worry that this does not match "best practices" at big companies (monday / OpenAI / Anthropic / Meta / Apple)

## Assessment

### Where the concern is off

The hard problem in production LLM systems is reliability, testability, and structure around a non-deterministic model — the scaffolding IS the engineering. This project already demonstrates:

- **Typed phase I/O** — the architecture OpenAI's Agents SDK, LangGraph, and Anthropic's Skills converge on
- **Eval-driven development** — the single biggest separator between people who have shipped LLM systems and people who have played with them
- **Phase separation** to avoid god-prompts — anti-pattern avoidance many production systems still have not made
- **Prompt caching awareness** — production cost-consciousness
- **Written refactor plans and rules docs before code** — senior-level practice

Many product teams at large companies still ship soupy prompts with hardcoded strings and zero evals. This project is on the better side of that gap.

### Where the concern is right

**Presentation.** The engineering rigor is invisible at a glance. A recruiter or generalist interviewer skimming the repo will not perceive the decisions behind typed I/O phases. Substance is strong; showcase is weak.

## Actions

1. **Surface the thinking.** Write an `ARCHITECTURE.md` or README section walking through: why phases, why typed I/O, why eval-driven, how a turn flows end-to-end. One pipeline diagram. Highest-leverage single change — turns invisible rigor into visible rigor.
2. **Lead with the evals.** Screenshot eval output, or record a 30-second clip of the eval workflow. Most candidates cannot show this.
3. **One visible end-to-end moment.** Clean minimal UI, or a recorded demo of full clarify → research → plan. Does not need autonomy — needs one coherent run a human can watch.
4. **Own the framing verbally.** Not "I built a chatbot." Rather: "I built a multi-stage LLM pipeline with typed I/O between phases and an eval-driven development workflow. The interesting engineering is keeping non-deterministic model calls reliable and testable."
5. **Where "autonomy" fits naturally:** not the clarify stage (deliberately constrained) — the research and plan stages, which have legitimate agentic loops (tool use, iterative refinement, self-correction). Deferred until the clarify refactor is complete.

## TL;DR

Engineering is good and follows best practices better than most big-co LLM code does. Gap is presentation, not substance. Fix the presentation and it will interview well at the places worth working at.
