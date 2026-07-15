import { z } from "zod";

import { runtimeCommandSchema, runtimeEventSchema } from "../contracts/runtime-messages.js";
import { idSchema, isoDateTimeSchema } from "../domain/models/common.js";

export const pearWorkerRequestSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("runtime.command"),
      command: runtimeCommandSchema
    })
    .strict(),
  z
    .object({
      type: z.literal("runtime.event"),
      event: runtimeEventSchema
    })
    .strict(),
  z
    .object({
      type: z.literal("worker.shutdown")
    })
    .strict()
]);

export const pearWorkerResponseSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("worker.ready"),
      runtime: z.literal("pear-bare"),
      protocolVersion: z.literal("1.0.0"),
      journalLength: z.number().int().nonnegative()
    })
    .strict(),
  z
    .object({
      type: z.literal("runtime.command.accepted"),
      requestId: idSchema,
      commandType: z.string().min(3).max(100),
      journalLength: z.number().int().positive()
    })
    .strict(),
  z
    .object({
      type: z.literal("runtime.event.recorded"),
      requestId: idSchema,
      eventType: z.string().min(3).max(100),
      journalLength: z.number().int().positive()
    })
    .strict(),
  z
    .object({
      type: z.literal("runtime.message.rejected"),
      requestId: idSchema.optional(),
      message: z.string().min(1).max(200)
    })
    .strict(),
  z
    .object({
      type: z.literal("worker.closed")
    })
    .strict()
]);

export const pearAuditRecordSchema = z
  .object({
    kind: z.enum(["command", "event"]),
    requestId: idSchema,
    messageType: z.string().min(3).max(100),
    timestamp: isoDateTimeSchema
  })
  .strict();

export type PearWorkerRequest = z.infer<typeof pearWorkerRequestSchema>;
export type PearWorkerResponse = z.infer<typeof pearWorkerResponseSchema>;
export type PearAuditRecord = z.infer<typeof pearAuditRecordSchema>;
