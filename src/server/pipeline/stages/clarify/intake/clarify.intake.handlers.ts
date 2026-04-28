import { handleContradictoryRisk } from "#pipeline/stages/clarify/intake/contradictory/clarify.contradictory";
import { handleOutOfScopeRedirect } from "#pipeline/stages/clarify/intake/out-of-scope/clarify.out-of-scope";
import { handleUnrealisticExpectations } from "#pipeline/stages/clarify/intake/unrealistic/clarify.unrealistic";
import { GoalClassification } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { IntakePhaseOutput } from "#pipeline/stages/clarify/shared/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";

type IntakeHandler = (
  goal: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
) => Promise<IntakePhaseOutput>;

export const INTAKE_HANDLERS: Partial<
  Record<(typeof GoalClassification.options)[number], IntakeHandler>
> = {
  [GoalClassification.enum.out_of_scope]: handleOutOfScopeRedirect,
  [GoalClassification.enum.unrealistic]: handleUnrealisticExpectations,
  [GoalClassification.enum.contradictory]: handleContradictoryRisk,
};
