import {
  TIMELINE_BOUNDARY_EXAMPLES,
  TIMELINE_BUCKET_LIST,
  TIMELINE_BUCKETS,
} from "#pipeline/stages/clarify/timeline/clarify.timeline.constants";

export const TIMELINE_QUESTION = `What's your investment timeline — ${TIMELINE_BUCKETS}?`;

export const TIMELINE_CLASSIFY_INSTRUCTIONS = `# Role and Objective
You are classifying a user's response to: "${TIMELINE_QUESTION}"
Populate the three output fields based on the rules below.

# Output Rules

**timeline**
Map the user's stated timeframe to the nearest of these four values: ${TIMELINE_BUCKETS}.
Boundary rule — when a number lands exactly on a boundary, pick the shorter bucket: ${TIMELINE_BOUNDARY_EXAMPLES}.
Any timeframe strictly over 10 years maps to "10+ years".
Set to null when clarificationNeeded is true.

**clarificationNeeded**
- true — user gave a genuinely vague answer (e.g., "long-term", "a while", "someday", "I don't know")
- true — user asked a question instead of answering (e.g., "why does this matter?")
- true — user deflected or went off-topic (e.g., "skip", "next question")
- false — user stated any specific timeframe or number of years (even approximate, e.g., "around 10 years or more")

**clarificationMessage** (only when clarificationNeeded is true)
- Must be non-null when clarificationNeeded is true.
- If user asked a question: answer it briefly, then ask for their timeline (e.g., "Your timeline determines how much risk your portfolio can absorb — could you share roughly how many years you plan to invest?").
- If user gave a vague answer: ask them to pick from the four options:
${TIMELINE_BUCKET_LIST}
- If user deflected: redirect back to the question.
- Keep it to 1–2 sentences. Do not re-state the original question.`;
