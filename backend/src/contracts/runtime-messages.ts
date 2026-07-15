import { z } from "zod";

import { idSchema, isoDateTimeSchema, nonEmptyTextSchema } from "../domain/models/common.js";
import {
  invitationStatusSchema,
  scoutPrivateNoteSchema,
  tryoutInvitationSchema
} from "../domain/models/invitation.js";
import { playerProfileSchema } from "../domain/models/player-profile.js";
import { storedScoutReportSchema } from "../domain/models/scout-report.js";
import { sharedPlayerPackageSchema, shareSelectionSchema } from "../domain/models/sharing.js";
import { scoutPassEventSchema } from "../domain/models/events.js";
import {
  paymentProposalSchema,
  paymentReferenceSchema,
  walletPublicMetadataSchema
} from "../domain/models/wallet.js";

const requestFields = {
  requestId: idSchema,
  sentAt: isoDateTimeSchema
};

export const localDataCountsSchema = z
  .object({
    profiles: z.number().int().nonnegative(),
    reports: z.number().int().nonnegative(),
    relationships: z.number().int().nonnegative(),
    receivedPackages: z.number().int().nonnegative(),
    invitations: z.number().int().nonnegative(),
    scoutPrivateNotes: z.number().int().nonnegative(),
    wallets: z.number().int().nonnegative(),
    payments: z.number().int().nonnegative(),
    relationshipEvents: z.number().int().nonnegative()
  })
  .strict();

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
      type: z.literal("connection.invite.create"),
      payload: z.object({ relationshipId: idSchema }).strict()
    })
    .strict(),
  z
    .object({
      ...requestFields,
      type: z.literal("connection.connect"),
      payload: z.object({ inviteCode: nonEmptyTextSchema }).strict()
    })
    .strict(),
  z
    .object({
      ...requestFields,
      type: z.literal("connection.test_event.send"),
      payload: z.object({ relationshipId: idSchema }).strict()
    })
    .strict(),
  z
    .object({
      ...requestFields,
      type: z.literal("share.send"),
      payload: z
        .object({
          relationshipId: idSchema,
          package: sharedPlayerPackageSchema,
          serializedPayload: nonEmptyTextSchema,
          payloadBytes: z
            .number()
            .int()
            .positive()
            .max(64 * 1024),
          playerApproved: z.literal(true)
        })
        .strict()
    })
    .strict(),
  z
    .object({
      ...requestFields,
      type: z.literal("invitation.send"),
      payload: tryoutInvitationSchema
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
    .strict(),
  z
    .object({
      ...requestFields,
      type: z.literal("scout.note.save"),
      payload: scoutPrivateNoteSchema
    })
    .strict(),
  z
    .object({
      ...requestFields,
      type: z.literal("wallet.initialize"),
      payload: z.object({ ownerRole: z.enum(["player", "scout"]) }).strict()
    })
    .strict(),
  z
    .object({
      ...requestFields,
      type: z.literal("wallet.balance.get"),
      payload: z.object({ address: z.string().regex(/^0x[a-fA-F0-9]{40}$/) }).strict()
    })
    .strict(),
  z
    .object({
      ...requestFields,
      type: z.literal("wallet.address.share"),
      payload: z
        .object({
          relationshipId: idSchema,
          wallet: walletPublicMetadataSchema,
          playerApproved: z.literal(true)
        })
        .strict()
    })
    .strict(),
  z
    .object({
      ...requestFields,
      type: z.literal("payment.review"),
      payload: z.object({ invitationId: idSchema }).strict()
    })
    .strict(),
  z
    .object({
      ...requestFields,
      type: z.literal("payment.confirm"),
      payload: z
        .object({
          proposalId: idSchema,
          userConfirmed: z.literal(true)
        })
        .strict()
    })
    .strict(),
  z
    .object({
      ...requestFields,
      type: z.literal("payment.reject"),
      payload: z.object({ proposalId: idSchema }).strict()
    })
    .strict(),
  z
    .object({
      ...requestFields,
      type: z.literal("payment.status.get"),
      payload: z.object({ paymentId: idSchema }).strict()
    })
    .strict(),
  z.object({ ...requestFields, type: z.literal("workspace.snapshot.get") }).strict(),
  z.object({ ...requestFields, type: z.literal("settings.data.preview") }).strict(),
  z
    .object({
      ...requestFields,
      type: z.literal("settings.data.clear"),
      payload: z.object({ userConfirmed: z.literal(true) }).strict()
    })
    .strict(),
  z.object({ ...requestFields, type: z.literal("settings.debug.export") }).strict()
]);

export const workspaceSnapshotSchema = z
  .object({
    profiles: z.array(playerProfileSchema),
    reports: z.array(storedScoutReportSchema),
    receivedPackages: z.array(sharedPlayerPackageSchema),
    invitations: z.array(tryoutInvitationSchema),
    wallets: z.array(walletPublicMetadataSchema),
    payments: z.array(paymentReferenceSchema),
    activityEvents: z.array(scoutPassEventSchema)
  })
  .strict();

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
      type: z.literal("workspace.snapshot"),
      payload: workspaceSnapshotSchema
    })
    .strict(),
  z
    .object({
      requestId: idSchema,
      occurredAt: isoDateTimeSchema,
      type: z.literal("settings.data.previewed"),
      payload: z
        .object({
          counts: localDataCountsSchema,
          cleared: z.boolean()
        })
        .strict()
    })
    .strict(),
  z
    .object({
      requestId: idSchema,
      occurredAt: isoDateTimeSchema,
      type: z.literal("settings.debug.exported"),
      payload: z
        .object({
          content: z
            .string()
            .min(2)
            .max(64 * 1024)
        })
        .strict()
    })
    .strict(),
  z
    .object({
      requestId: idSchema,
      occurredAt: isoDateTimeSchema,
      type: z.literal("payment.updated"),
      payload: z
        .object({
          payment: z.union([paymentProposalSchema, paymentReferenceSchema])
        })
        .strict()
    })
    .strict(),
  z
    .object({
      requestId: idSchema,
      occurredAt: isoDateTimeSchema,
      type: z.literal("report.updated"),
      payload: z.object({ report: storedScoutReportSchema }).strict()
    })
    .strict(),
  z
    .object({
      requestId: idSchema,
      occurredAt: isoDateTimeSchema,
      type: z.literal("share.prepared"),
      payload: z
        .object({
          package: sharedPlayerPackageSchema,
          serializedPayload: nonEmptyTextSchema,
          payloadBytes: z
            .number()
            .int()
            .positive()
            .max(64 * 1024)
        })
        .strict()
    })
    .strict(),
  z
    .object({
      requestId: idSchema,
      occurredAt: isoDateTimeSchema,
      type: z.literal("share.sent"),
      payload: z.object({ packageId: idSchema }).strict()
    })
    .strict(),
  z
    .object({
      requestId: idSchema,
      occurredAt: isoDateTimeSchema,
      type: z.literal("share.received"),
      payload: z.object({ package: sharedPlayerPackageSchema }).strict()
    })
    .strict(),
  z
    .object({
      requestId: idSchema,
      occurredAt: isoDateTimeSchema,
      type: z.literal("invitation.updated"),
      payload: z.object({ invitation: tryoutInvitationSchema }).strict()
    })
    .strict(),
  z
    .object({
      requestId: idSchema,
      occurredAt: isoDateTimeSchema,
      type: z.literal("scout.note.saved"),
      payload: z.object({ noteId: idSchema }).strict()
    })
    .strict(),
  z
    .object({
      requestId: idSchema,
      occurredAt: isoDateTimeSchema,
      type: z.literal("wallet.updated"),
      payload: z
        .object({
          wallet: walletPublicMetadataSchema,
          balance: z
            .string()
            .regex(/^\d+(?:\.\d{1,6})?$/)
            .optional()
        })
        .strict()
    })
    .strict(),
  z
    .object({
      requestId: idSchema,
      occurredAt: isoDateTimeSchema,
      type: z.literal("wallet.address.received"),
      payload: z.object({ wallet: walletPublicMetadataSchema }).strict()
    })
    .strict(),
  z
    .object({
      requestId: idSchema,
      occurredAt: isoDateTimeSchema,
      type: z.literal("connection.invite.created"),
      payload: z.object({ inviteCode: nonEmptyTextSchema }).strict()
    })
    .strict(),
  z
    .object({
      requestId: idSchema,
      occurredAt: isoDateTimeSchema,
      type: z.literal("connection.status"),
      payload: z
        .object({
          status: z.enum([
            "idle",
            "invite_ready",
            "connecting",
            "connected",
            "disconnected",
            "timeout",
            "peer_not_found",
            "reconnecting",
            "error"
          ])
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
export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>;
