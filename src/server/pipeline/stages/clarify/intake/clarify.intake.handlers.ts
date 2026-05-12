import { GoalClassificationEnum } from "#pipeline/stages/clarify/intake/clarify.intake.schemas";
import type {
  IntakePhaseOutput,
  RedirectingClassification,
} from "#pipeline/stages/clarify/intake/clarify.intake.types";
import { handleContradictoryRisk } from "#pipeline/stages/clarify/intake/contradictory/clarify.contradictory";
import { handleOutOfScopeRedirect } from "#pipeline/stages/clarify/intake/out-of-scope/clarify.out-of-scope";
import { handleUnrealisticExpectations } from "#pipeline/stages/clarify/intake/unrealistic/clarify.unrealistic";
import type { Responder } from "#pipeline/tools/ask-user.tool";

type IntakeHandler = (goal: string, responder: Responder) => Promise<IntakePhaseOutput>;

export const INTAKE_HANDLERS: Record<RedirectingClassification, IntakeHandler> = {
  [GoalClassificationEnum.enum.out_of_scope]: handleOutOfScopeRedirect,
  [GoalClassificationEnum.enum.unrealistic]: handleUnrealisticExpectations,
  [GoalClassificationEnum.enum.contradictory]: handleContradictoryRisk,
};
