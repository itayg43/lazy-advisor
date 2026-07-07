import { z } from "zod";

import { MAX_AMOUNT } from "#constants/validation.constants";
import {
  AskWithClassifyBaseSchema,
  ClassifyErroredReasonEnum,
} from "#pipeline/ask-with-classify";
import { ClarifyUnresolvedReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";

const AmountSchema = z.number().int().positive().max(MAX_AMOUNT);

export const AmountClassifySchema = AskWithClassifyBaseSchema.extend({
  amount: AmountSchema.nullable(),
});

export const AmountClassifyResolvedSchema = AmountClassifySchema.extend({
  amount: AmountSchema,
});

export const AmountPhaseResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: PipelineStatusEnum.extract(["completed"]),
    amount: AmountSchema,
  }),
  z.object({
    status: PipelineStatusEnum.extract(["unresolved"]),
    reason: ClarifyUnresolvedReasonEnum.extract(["amount"]),
  }),
  z.object({
    status: PipelineStatusEnum.extract(["errored"]),
    reason: ClassifyErroredReasonEnum.extract([
      "classify_resolved_output_invalid",
      "classify_message_missing",
    ]),
  }),
]);
