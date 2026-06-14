import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { BadGatewayError } from "#errors";
import { createLogger } from "#lib/logger";
import type { TranscriptEntry } from "#pipeline/eval.transcript";
import { callOpenAIParsed } from "#services/openai";

// LLM-as-judge for the allocation phase: a DEV-ONLY layer that grades the
// *composed* (LLM-written) turns of an eval conversation against subjective
// criteria regex assertions can't capture — wordiness, scope-bleed, tone.
//
// Wired into clarify.allocation.eval.ts, so it runs only under
// `npm run test:evals` (real API, never CI); a failing verdict fails the eval.
// Deterministic, code-rendered text (the initial proposal, the fixed re-ask
// messages) is never judged — it doesn't vary, so there's nothing to grade.

const logger = createLogger("clarifyAllocationJudge");

/**
 * The quality dimensions the judge can score. Each eval case passes only the
 * subset that fits the turn it exercises — answer-scoping fits question turns,
 * framing-plain-language fits counter turns — so the judge never reports on a
 * criterion the conversation can't exhibit.
 */
export const AllocationJudgeCriterionEnum = z.enum([
  "conciseness", // advisor turn says what it needs and stops, no padding
  "answer-scoping", // answer stays on the asked topic, then the standard re-ask
  "naturalness", // calm, matter-of-fact human tone, no filler or lecturing
  "framing-plain-language", // trade-off framing a beginner understands, not jargon
  "no-risk-labeling", // never pins a risk personality on the user
  "english-body", // prose is English; Hebrew instrument names inline are fine
]);

type AllocationJudgeCriterion = z.infer<typeof AllocationJudgeCriterionEnum>;

// One rubric per criterion, each a strict pass/fail test so the judge grades
// against an explicit bar rather than a vibe. Split into separate consts — each
// a discrete Rule / Note / PASS / FAIL spec the judge can parse, assembled into
// CRITERION_RUBRIC below — and buildJudgeInstructions renders each under its own
// heading.
const CONCISENESS_RUBRIC = `**Rule:** Each advisor turn says what it needs and stops.
**Note:** The turn's expected close (see 'How to judge') is never bloat — on a
counter-proposal turn, naming the equity percentage both when confirming the
split and again in the 'proceed with X%?' question is that expected close, NOT
redundant repetition.
**PASS:** No turn is a run-on that crams several distinct ideas into one sentence
(e.g. deferral + recommended range + future phases + shekel split), and no turn
restates its full figures beyond what the close requires.
**FAIL:** A turn is a genuine run-on, or repeats numbers or ideas beyond its
expected close — e.g. stating the full ₪/% split two separate times, or
re-stating the recommended range when it wasn't asked for.`;

const ANSWER_SCOPING_RUBRIC = `**Rule:** The advisor answers only what the user asked, then gives the required re-ask.
**Note:** Re-presenting the current split (₪ + %) and the three-way 'more in
stocks / more in buffer' question is MANDATORY on every answer turn — never flag
this standard re-ask as out of scope.
**PASS:** The answer itself stays on the asked topic — a concept question gets a
concept answer; a method question names the inputs (timeline, comfort with
drops) without exposing an internal table; an instrument question is deferred in
one line without pre-explaining concepts — and is followed by the re-ask.
**FAIL:** The answer bleeds into genuinely adjacent territory the user did not
ask about: explaining concepts that weren't asked, naming specific instruments,
or going into later-phase next steps beyond the one-line deferral.`;

const NATURALNESS_RUBRIC = `**Rule:** The advisor sounds like a calm, matter-of-fact human advisor —
educational, not preachy, robotic, or filler-laden.
**PASS:** The tone is natural with no filler openers ('Great', 'Sure', 'Of
course') and no lecturing.
**FAIL:** It lectures, hedges excessively, or opens with filler.`;

const FRAMING_PLAIN_LANGUAGE_RUBRIC = `**Rule:** When the advisor adds trade-off framing (compound-impact or an extreme
sanity-check), it reads as plain language a beginner understands and references
the user's actual situation (their timeline or shekel amounts), not a mechanical
keyword drop.
**PASS:** The framing is clear and concrete.
**FAIL:** It is jargon-y, generic, or merely name-checks a keyword.`;

const NO_RISK_LABELING_RUBRIC = `**Rule:** The advisor never pins a risk personality on the user — it describes
the split and the reasoning, not the person.
**Note:** Factually restating the user's own answers or situation is NOT a label
("your timeline is long", "you said big drops make you uncomfortable"). Plain,
non-personal uses of these words are also fine — "a moderate amount in stocks",
calling a fund or the market "aggressive". Only a label aimed at the *user*
counts.
**PASS:** No turn assigns the user a risk tier or investor personality — not by a
standard label ("you're a conservative/moderate/aggressive investor", "your
moderate profile") nor any equivalent "you're a ___ kind of investor" phrasing.
**FAIL:** A turn characterizes the *user* with a risk persona — e.g. "since
you're fairly aggressive", "for a conservative investor like you", "your moderate
risk profile".`;

const ENGLISH_BODY_RUBRIC = `**Rule:** The body of the advisor's message is written in English.
**Note:** Naming a specific Israeli instrument by its Hebrew term inline is
explicitly allowed and is NOT a violation — e.g. "a money-market fund (קרן
כספית)" or "the קרן כספית". The carve-out is for *instrument names*, not running
prose.
**PASS:** Sentences and explanations are in English; any Hebrew is limited to
inline instrument names.
**FAIL:** A full sentence or clause is written in Hebrew, or the message answers
in Hebrew prose rather than English.`;

const CRITERION_RUBRIC: Record<AllocationJudgeCriterion, string> = {
  conciseness: CONCISENESS_RUBRIC,
  "answer-scoping": ANSWER_SCOPING_RUBRIC,
  naturalness: NATURALNESS_RUBRIC,
  "framing-plain-language": FRAMING_PLAIN_LANGUAGE_RUBRIC,
  "no-risk-labeling": NO_RISK_LABELING_RUBRIC,
  "english-body": ENGLISH_BODY_RUBRIC,
};

// `reason` precedes `pass` so the judge reasons before committing to a verdict
// (chain-of-thought, not a rationalised snap decision). `min(1)` only guarantees
// some verdict, not one per requested criterion — full coverage is enforced in
// judgeAllocationConversation, which throws on any ungraded criterion.
const AllocationJudgeOutputSchema = z.object({
  verdicts: z
    .array(
      z.object({
        criterion: AllocationJudgeCriterionEnum,
        reason: z.string().min(1),
        pass: z.boolean(),
      }),
    )
    .min(1),
});

export type AllocationJudgeOutput = z.infer<typeof AllocationJudgeOutputSchema>;

const buildJudgeInstructions = (
  criteria: ReadonlyArray<AllocationJudgeCriterion>,
): string => {
  const rubric = criteria
    .map((criterion) => `## ${criterion}\n${CRITERION_RUBRIC[criterion]}`)
    .join("\n\n");

  return `# Role and Objective
You are a strict quality evaluator for an investment-advisor conversation. The
advisor helps a beginner investor settle on a split between equity (stock ETFs)
and a buffer (cash / money-market). You grade ONLY the advisor's messages
against the criteria below and return one verdict per criterion.

# Criteria to grade
${rubric}

# How to judge
- The FIRST advisor turn is a fixed, pre-written proposal — do NOT grade it.
  Grade only the advisor's later turns, which are its responses to the user.
- A turn closes in the way its type calls for, and that expected close is never
  a fault: a turn that ANSWERS A QUESTION re-presents the current split (₪ + %)
  and asks "that split, more in stocks, or more in buffer"; a turn that responds
  to a COUNTER-PROPOSAL confirms the new split and asks whether to proceed. Do
  not require the three-way question on a counter turn.
- Grade each criterion independently and ONLY against its own definition. Do not
  penalize a message for something that belongs to a different criterion.
- Reason first, then commit to pass/true or pass/false. Be strict: pass only
  when the advisor clearly meets the bar.
- Length is not inherently bad. Only treat verbosity as a fault when grading
  conciseness, and never reward padding.
- Domain facts (for context, not extra criteria): the advisor replies in English
  (Hebrew instrument names inline are fine), uses ₪ for amounts, writes plain
  prose (no markdown), and must never label the user with risk tiers.

# Output
Return a verdict for every listed criterion — each with a one-sentence reason
and a boolean pass. Do not grade criteria that were not listed.`;
};

// The schema enforces only `min(1)` verdict, so the judge can return a
// structurally valid response that silently drops a requested criterion — which
// would read as a clean pass for an ungraded turn. Returns the requested criteria
// left without a verdict so the caller can reject such a response.
const findUngradedCriteria = (
  verdicts: AllocationJudgeOutput["verdicts"],
  criteria: ReadonlyArray<AllocationJudgeCriterion>,
): AllocationJudgeCriterion[] => {
  const graded = new Set(verdicts.map((verdict) => verdict.criterion));

  return criteria.filter((criterion) => !graded.has(criterion));
};

/**
 * Grades one eval conversation against the given criteria. The full transcript
 * (both roles) is sent so the judge can see what the user asked before grading
 * how the advisor answered.
 */
export const judgeAllocationConversation = async (
  transcript: ReadonlyArray<TranscriptEntry>,
  criteria: ReadonlyArray<AllocationJudgeCriterion>,
): Promise<AllocationJudgeOutput> => {
  const conversation = transcript
    .map((turn) => `${turn.role === "agent" ? "Advisor" : "User"}: ${turn.content}`)
    .join("\n\n");

  const { id, output } = await callOpenAIParsed(
    {
      // Stronger than the nano that composes the replies — nano judging nano
      // rubber-stamps, and the nuance we grade needs a more capable judge.
      model: "gpt-5.4",
      instructions: buildJudgeInstructions(criteria),
      input: conversation,
      text: {
        format: zodTextFormat(AllocationJudgeOutputSchema, "AllocationJudgeOutputSchema"),
      },
      reasoning: { effort: "medium" },
    },
    AllocationJudgeOutputSchema,
  );

  const ungraded = findUngradedCriteria(output.verdicts, criteria);
  if (ungraded.length > 0)
    throw new BadGatewayError(`Judge returned no verdict for: ${ungraded.join(", ")}`);

  logger.debug("Judged allocation conversation", {
    responseId: id,
    verdicts: output.verdicts,
  });

  return output;
};
