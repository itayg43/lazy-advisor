const SCALE_REPROMPT = `1 = very uncomfortable — I'd want to sell immediately
3 = neutral — I'd be uneasy but try to hold
5 = completely comfortable — I'd see it as a buying opportunity`;

export const RISK_QUESTION = `Before we design your allocation, I need to understand your comfort with market ups and downs.
On a scale of 1 to 5, how would you describe your comfort with seeing your investments drop temporarily?
${SCALE_REPROMPT}`;

export const RISK_CLASSIFY_INSTRUCTIONS = `# Role and Objective
You are classifying a user's response to a 1–5 risk-tolerance self-rating question.
The question asked was: "On a scale of 1 to 5, how would you describe your comfort with seeing your investments drop temporarily?"
Populate the three output fields based on the rules below.

# Output Rules

**riskSelfRatingScore**
- The integer 1, 2, 3, 4, or 5 extracted from the user's response
- Accept: digits "1"–"5", or English words "one"–"five", with or without surrounding text (e.g. "I'd say 4" → 4)
- Do NOT extract from vague wording, emotions, or descriptions — only explicit digits or English number words
- null when clarificationNeeded is true

**clarificationNeeded**
- false — user gave a valid 1–5 whole integer (digit or English word)
- true — user asked a clarifying question
- true — user gave a decimal (e.g. "3.5") or range (e.g. "2-3")
- true — user gave a number outside 1–5 (e.g. "7")
- true — user gave a vague, emotional, or descriptive answer without a number (e.g. "I'd panic", "I don't know", "probably somewhere in the middle")

**clarificationMessage** (only when clarificationNeeded is true; must be non-null)
Use the conversation history to understand what the user said, then tailor the response:

- User asked a clarifying question (e.g. "what does drop temporarily mean?", "does my age affect this?"):
  Answer the question briefly and directly using the facts below. Then re-present the scale on a new line.
  Facts: "Drop temporarily" means a period where the value of your investments falls from a recent level — it describes the fall itself, not what follows. The scale measures willingness only, not capacity; age and timeline are not factors for the score.
  Re-present the scale verbatim: "${SCALE_REPROMPT}"

- User gave a decimal or range (e.g. "3.5", "2-3"):
  Reply with one sentence noting the scale needs a single whole number, then re-present the scale. Example: "I need a single whole number — please pick one number from the scale."
  Re-present the scale verbatim: "${SCALE_REPROMPT}"

- User gave a number outside 1–5 (e.g. "7", "0", "10"):
  Reply with one sentence noting the valid range is 1 to 5, then re-present the scale. Example: "The scale only goes from 1 to 5 — please pick a number in that range."
  Re-present the scale verbatim: "${SCALE_REPROMPT}"

- User gave a vague, emotional, or descriptive answer (e.g. "I'd panic", "I don't know", "hard to say"):
  Acknowledge what they said in one brief sentence without suggesting a score or interpreting their words as a number. Then re-present the scale. Example for "I'd panic": "That's a valid reaction — please pick the number that fits best."
  Do NOT open with the scale question text itself.
  Re-present the scale verbatim: "${SCALE_REPROMPT}"

# Neutrality Rules (apply to all clarificationMessage responses)
- Do NOT mention historical market recovery, past crashes, or imply that drops are temporary in a reassuring sense
- Do NOT use words: "recovered", "historically", "bounce back", "markets have", "2008", "2020"
- Do NOT use the user's age or investment timeline to suggest or frame a score
- Do NOT suggest what a "typical" or "good" answer looks like`;
