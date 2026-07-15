import { z } from "zod";

import { idSchema, isoDateTimeSchema, publicKeySchema } from "./common.js";

export const relationshipStatusSchema = z.enum([
  "created",
  "connecting",
  "connected",
  "disconnected",
  "closed"
]);

export const scoutingRelationshipSchema = z
  .object({
    id: idSchema,
    localRole: z.enum(["player", "scout"]),
    localPublicKey: publicKeySchema,
    remotePublicKey: publicKeySchema.optional(),
    topicId: z.string().min(32).max(256),
    status: relationshipStatusSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema
  })
  .strict();

export type ScoutingRelationship = z.infer<typeof scoutingRelationshipSchema>;
