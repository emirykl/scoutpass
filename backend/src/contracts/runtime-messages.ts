import { z } from "zod";

import { idSchema, isoDateTimeSchema, nonEmptyTextSchema } from "../domain/models/common.js";
import { invitationStatusSchema } from "../domain/models/invitation.js";
import { playerProfileSchema } from "../domain/models/player-profile.js";
import { shareSelectionSchema } from "../domain/models/sharing.js";

const requestFields = {
  requestId: idSchema,
  sentAt: isoDateTimeSchema
};

export const runtimeCommandSchema = z.discriminatedUnion("type", [
  z.object({ ...requestFields, type: z.literal("runtime.status.get") }).strict(),
  z
    .object({ ...requestFields, type: z.literal("profile.save"), payload: playerProfileSchema })
    .strict(),
  z
    .object({
      ...requestFields,
      type: z.literal("report.generate"),
      payload: z.object({ playerId: idSchema }).strict()
    })
    .strict(),
  z
    .object({
      ...requestFields,
      type: z.literal("share.prepare"),
      payload: z
        .object({
          playerId: idSchema,
          reportId: idSchema,
          relationshipId: idSchema,
          selection: shareSelectionSchema
        })
        .strict()
    })
    .strict(),
  z
    .object({
      ...requestFields,
      type: z.literal("invitation.respond"),
      payload: z
        .object({
          invitationId: idSchema,
          response: z.enum(["accepted", "declined", "clarification_requested"]),
          message: nonEmptyTextSchema.optional()
        })
        .strict()
    })
    .strict()
]);

export const runtimeEventSchema = z.discriminatedUnion("type", [
  z
    .object({
      requestId: idSchema,
      occurredAt: isoDateTimeSchema,
      type: z.literal("runtime.status"),
      payload: z
        .object({
          status: z.enum(["ready", "degraded", "stopped"]),
          qvac: z.enum(["not_checked", "unavailable", "ready"]),
          pears: z.enum(["not_started", "disconnected", "connected"]),
          wallet: z.enum(["not_initialized", "ready", "error"])
        })
        .strict()
    })
    .strict(),
  z
    .object({
      requestId: idSchema,
      occurredAt: isoDateTimeSchema,
      type: z.literal("operation.succeeded"),
      payload: z
        .object({
          entityId: idSchema.optional(),
          invitationStatus: invitationStatusSchema.optional()
        })
        .strict()
    })
    .strict(),
  z
    .object({
      requestId: idSchema,
      occurredAt: isoDateTimeSchema,
      type: z.literal("operation.failed"),
      payload: z
        .object({
          code: z.string().trim().min(3).max(80),
          message: nonEmptyTextSchema,
          retryable: z.boolean()
        })
        .strict()
    })
    .strict()
]);

export type RuntimeCommand = z.infer<typeof runtimeCommandSchema>;
export type RuntimeEvent = z.infer<typeof runtimeEventSchema>;
