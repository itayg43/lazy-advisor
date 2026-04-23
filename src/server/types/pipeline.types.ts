import { z } from "zod";

import type { UserProfileSchema } from "#schemas/pipeline.schemas";

export type UserProfile = z.infer<typeof UserProfileSchema>;
