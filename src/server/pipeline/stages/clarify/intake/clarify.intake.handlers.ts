import { handleContradictoryRisk } from "#pipeline/stages/clarify/intake/contradictory/clarify.contradictory";
import { handleOutOfScopeRedirect } from "#pipeline/stages/clarify/intake/out-of-scope/clarify.out-of-scope";
import { handleUnrealisticExpectations } from "#pipeline/stages/clarify/intake/unrealistic/clarify.unrealistic";
import { GoalClassificationEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type {
  IntakePhaseOutput,
  RedirectingClassification,
} from "#pipeline/stages/clarify/shared/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";

type IntakeHandler = (
  goal: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
) => Promise<IntakePhaseOutput>;

export const INTAKE_HANDLERS: Record<RedirectingClassification, IntakeHandler> = {
  [GoalClassificationEnum.enum.out_of_scope]: handleOutOfScopeRedirect,
  [GoalClassificationEnum.enum.unrealistic]: handleUnrealisticExpectations,
  [GoalClassificationEnum.enum.contradictory]: handleContradictoryRisk,
};
