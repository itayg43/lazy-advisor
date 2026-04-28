import type { UserProfile } from "#types/pipeline.types";

export const buildProfileSummary = (profile: UserProfile): string =>
  `- Investment amount: ${profile.amount.toLocaleString()}
- Investment timeline: ${profile.timeline}
- Risk tolerance: ${profile.riskTolerance}
- Equity / buffer split: ${profile.equityPercentage}% / ${profile.bufferPercentage}%
- Plans to contribute periodically: ${profile.plansToContribute ? "yes" : "no"}`;
