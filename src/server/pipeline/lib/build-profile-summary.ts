import type { UserProfile } from "#server/types/pipeline.types";

export const buildProfileSummary = (profile: UserProfile): string =>
  `Goal: ${profile.goal}
Investment amount: ${profile.amount}
Age: ${profile.age}
Risk tolerance: ${profile.riskTolerance}
Timeline: ${profile.timeline}
Location: ${profile.location}
Knowledge level: ${profile.knowledgeLevel}
Brokerage: ${profile.brokerage}
Has emergency fund: ${profile.hasEmergencyFund ? "yes" : "no"}
Has outstanding debt: ${profile.hasDebt ? "yes" : "no"}
Monthly contribution: ${profile.monthlyContribution}`;
