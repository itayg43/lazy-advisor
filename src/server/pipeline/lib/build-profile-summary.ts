import type { UserProfile } from "#types/pipeline.types";

export const buildProfileSummary = (profile: UserProfile): string =>
  `- Age: ${profile.age}
- Investment amount: ${profile.amount.toLocaleString()}
- Plans to contribute periodically: ${profile.plansToContribute ? "yes" : "no"}
- Investment timeline: ${profile.timeline}
- Risk tolerance: ${profile.riskTolerance}
- Emergency fund: ${profile.hasEmergencyFund ? "yes" : "no"}
- Has debt: ${profile.hasDebt ? "yes" : "no"}
- Investment preferences: ${profile.investmentPreferences}`;
