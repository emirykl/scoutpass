import { z } from "zod";

import { idSchema, isoDateTimeSchema, nonEmptyTextSchema, shortTextSchema } from "./common.js";

export const invitationStatusSchema = z.enum([
  "draft",
  "sent",
  "received",
  "accepted",
  "declined",
  "clarification_requested",
  "expired",
  "travel_support_sent"
]);

export const paymentAssetSchema = z.literal("spUSD");
export const moneyAmountSchema = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/, {
  message: "Amount must be a non-negative decimal with at most 6 fractional digits."
});

export const tryoutInvitationSchema = z
  .object({
    id: idSchema,
    relationshipId: idSchema,
    clubName: shortTextSchema,
    scoutName: shortTextSchema,
    trialTitle: shortTextSchema,
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema,
    city: shortTextSchema,
    venue: shortTextSchema,
    positionEvaluated: shortTextSchema,
    instructions: nonEmptyTextSchema,
    contactDetails: nonEmptyTextSchema,
    travelSupportAmount: moneyAmountSchema.optional(),
    paymentAsset: paymentAssetSchema.optional(),
    expiresAt: isoDateTimeSchema,
    status: invitationStatusSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema
  })
  .strict()
  .superRefine((invitation, context) => {
    if (Date.parse(invitation.endsAt) <= Date.parse(invitation.startsAt)) {
      context.addIssue({
        code: "custom",
        message: "Tryout end must be after its start.",
        path: ["endsAt"]
      });
    }

    if (Date.parse(invitation.expiresAt) >= Date.parse(invitation.startsAt)) {
      context.addIssue({
        code: "custom",
        message: "Invitation must expire before the tryout starts.",
        path: ["expiresAt"]
      });
    }

    const hasAmount = invitation.travelSupportAmount !== undefined;
    const hasAsset = invitation.paymentAsset !== undefined;
    if (hasAmount !== hasAsset) {
      context.addIssue({
        code: "custom",
        message: "Travel support amount and asset must be provided together.",
        path: ["travelSupportAmount"]
      });
    }
  });

export const scoutPrivateNoteSchema = z
  .object({
    id: idSchema,
    relationshipId: idSchema,
    packageId: idSchema,
    note: nonEmptyTextSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema
  })
  .strict();

export type InvitationStatus = z.infer<typeof invitationStatusSchema>;
export type TryoutInvitation = z.infer<typeof tryoutInvitationSchema>;
export type ScoutPrivateNote = z.infer<typeof scoutPrivateNoteSchema>;
