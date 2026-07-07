import { TimelineBucketEnum } from "#schemas/pipeline.schemas";

const {
  "under 3 years": under3,
  "3–5 years": t3to5,
  "5–10 years": t5to10,
  "10+ years": t10plus,
} = TimelineBucketEnum.enum;

export const TIMELINE_BUCKETS = TimelineBucketEnum.options
  .map((o) => `\`${o}\``)
  .join(", ");
export const TIMELINE_BUCKET_LIST = TimelineBucketEnum.options
  .map((o, i) => `${i + 1}. ${o}`)
  .join("\n");
export const TIMELINE_BOUNDARY_EXAMPLES = `"3 years" → "${under3}" (not "${t3to5}"), "5 years" → "${t3to5}" (not "${t5to10}"), "10 years" → "${t5to10}" (not "${t10plus}" — "${t10plus}" means strictly more than 10 years)`;
