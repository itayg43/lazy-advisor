import { createLogger } from "#lib/logger";
import {
  askWithClassify,
  isClassifyError,
  mapClassifyError,
} from "#pipeline/ask-with-classify";
import {
  RISK_CLASSIFY_INSTRUCTIONS,
  RISK_QUESTION,
} from "#pipeline/stages/clarify/risk/clarify.risk.prompts";
import {
  RiskClassifyResolvedSchema,
  RiskClassifySchema,
} from "#pipeline/stages/clarify/risk/clarify.risk.schemas";
import type {
  AskRiskResult,
  RiskPhaseResult,
} from "#pipeline/stages/clarify/risk/clarify.risk.types";
import { ClarifyUnresolvedReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { Responder } from "#pipeline/tools/ask-user.tool";
import { PipelineStatusEnum, RiskToleranceEnum } from "#schemas/pipeline.schemas";

const logger = createLogger("clarifyRisk");

const { conservative, moderate, aggressive } = RiskToleranceEnum.enum;

const mapScoreToBucket = (score: number) => {
  if (score <= 2) return conservative;
  if (score === 3) return moderate;

  return aggressive;
};

const askRisk = async (responder: Responder): Promise<AskRiskResult> => {
  try {
    const output = await askWithClassify({
      question: RISK_QUESTION,
      classifyInstructions: RISK_CLASSIFY_INSTRUCTIONS,
      schema: RiskClassifySchema,
      resolvedSchema: RiskClassifyResolvedSchema,
      responder,
      model: "gpt-5.4-nano",
      effort: "low",
      followUps: 2,
    });

    const result = {
      status: PipelineStatusEnum.enum.completed,
      selfRatingScore: output.selfRatingScore,
    } as const;

    logger.debug("askRisk output", { output: result });

    return result;
  } catch (error) {
    if (isClassifyError(error))
      return mapClassifyError(
        error,
        "askRisk",
        ClarifyUnresolvedReasonEnum.enum.risk_tolerance,
      );

    throw error;
  }
};

export const collectRisk = async (responder: Responder): Promise<RiskPhaseResult> => {
  logger.info("Starting risk phase");

  const riskResult = await askRisk(responder);
  if (riskResult.status !== PipelineStatusEnum.enum.completed) return riskResult;

  const result = {
    status: PipelineStatusEnum.enum.completed,
    selfRatingScore: riskResult.selfRatingScore,
    riskTolerance: mapScoreToBucket(riskResult.selfRatingScore),
  } as const;

  logger.debug("Risk output", { output: result });

  return result;
};
