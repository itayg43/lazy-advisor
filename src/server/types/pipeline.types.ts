import { z } from "zod";

import type { UserProfileSchema } from "#server/schemas/pipeline.schema";

export type UserProfile = z.infer<typeof UserProfileSchema>;
