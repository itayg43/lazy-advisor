import type { UserProfile } from "#types/pipeline.types";

export const buildProfileSummary = (profile: UserProfile): string =>
  `- Age: ${profile.age}
- Location: ${profile.location}
- Investment amount: ${profile.amount.toLocaleString()}
- Monthly contribution: ${profile.monthlyContribution.toLocaleString()}
- Investment timeline: ${profile.timeline}
- Risk tolerance: ${profile.riskTolerance}
- Knowledge level: ${profile.knowledgeLevel}
- Emergency fund: ${profile.hasEmergencyFund ? "yes" : "no"}
- Has debt: ${profile.hasDebt ? "yes" : "no"}
- Brokerage: ${profile.brokerage}
- Investment preferences: ${profile.investmentPreferences}`;
