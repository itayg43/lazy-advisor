import { zodTextFormat } from "openai/helpers/zod";

import { createLogger } from "#lib/logger";
import { buildProfileSummary } from "#pipeline/lib/build-profile-summary";
import { AllocationPlanSchema } from "#schemas/pipeline.schema";
import { callOpenAIParsed } from "#services/openai";
import type { AllocationPlan, UserProfile } from "#types/pipeline.types";

const logger = createLogger("researchAllocation");

const ALLOCATION_SYSTEM_PROMPT = `# Role and Objective
You are the allocation phase of an investment advisor pipeline. Given a user profile, produce a target asset allocation plan as a list of slices that sum to exactly 100%.

# Output Rules
- Slices must sum to exactly 100%.
- Each category name must be specific and descriptive enough to guide a product search (e.g., "Global equities (MSCI World)" not "stocks"; "Israeli government bonds" not "bonds").
- If investmentPreferences lists specific instruments with a percentage split, create a dedicated slice for each at the stated percentage. Distribute any remaining percentage across standard categories appropriate to the risk profile.
- If investmentPreferences lists a single instrument, create a dedicated slice for it and distribute the remaining percentage across standard categories.

# Context
- קרן כספית (Israeli money market fund) is a valid allocation category and a common bond alternative for Israeli investors.
- Emergency fund and age affect the need for bonds in the portfolio: a young investor (age ≤ 50) who already has an emergency fund has a liquidity buffer outside the portfolio — bonds can be reduced or eliminated entirely. An older investor (age > 50) needs bonds for sequence-of-returns protection regardless of emergency fund status.

# Example

## Young investor with specific preferences and percentage split
Profile:
- Age: 32, risk: moderate, hasEmergencyFund: true, investmentPreferences: "80% S&P 500, 20% TLV-125"

Output:
- U.S. equities (S&P 500): 80%
- Israeli equities (TLV-125): 20%

Reasoning: preferences specify two instruments with an 80/20 split — each gets a dedicated slice at the stated percentage. Young with emergency fund and clear preferences → full equity allocation is appropriate.`;

export const buildAllocationPlan = async (
  profile: UserProfile,
): Promise<AllocationPlan> => {
  const profileSummary = buildProfileSummary(profile);

  const { id, usage, output } = await callOpenAIParsed<AllocationPlan>({
    model: "gpt-5.4-nano",
    instructions: ALLOCATION_SYSTEM_PROMPT,
    input: `Build an allocation plan for the following investor profile:\n\n${profileSummary}`,
    text: {
      format: zodTextFormat(AllocationPlanSchema, "AllocationPlanSchema"),
    },
    reasoning: {
      effort: "low",
    },
  });

  logger.info("Allocation complete", {
    responseId: id,
    usage,
  });
  logger.debug("Allocation plan", {
    plan: output,
  });

  return output;
};
