import type { UserProfile } from "#types/pipeline.types";

export const buildProfileSummary = (profile: UserProfile): string =>
  `- Age: ${profile.age}
- Investment amount: ${profile.amount.toLocaleString()}
- Investment timeline: ${profile.timeline}
- Emergency fund: ${profile.hasEmergencyFund ? "yes" : "no"}
- Has debt: ${profile.hasDebt ? "yes" : "no"}
- Risk tolerance: ${profile.riskTolerance}
- Equity / buffer split: ${profile.equityPercentage}% / ${profile.bufferPercentage}%
- Plans to contribute periodically: ${profile.plansToContribute ? "yes" : "no"}`;
