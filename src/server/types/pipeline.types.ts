import { z } from "zod";

import type { UserProfileSchema } from "#schemas/pipeline.schema";

export type UserProfile = z.infer<typeof UserProfileSchema>;
