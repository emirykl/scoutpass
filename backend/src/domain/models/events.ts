import { z } from "zod";

import { PROTOCOL_VERSION } from "../constants.js";
import { idSchema, isoDateTimeSchema, nonEmptyTextSchema, publicKeySchema } from "./common.js";
import { tryoutInvitationSchema } from "./invitation.js";
import { sharedPlayerPackageSchema } from "./sharing.js";
import { paymentProposalSchema, paymentReferenceSchema } from "./wallet.js";
import { walletPublicMetadataSchema } from "./wallet.js";

const baseEventFields = {
  id: idSchema,
  senderPublicKey: publicKeySchema,
  createdAt: isoDateTimeSchema,
  protocolVersion: z.literal(PROTOCOL_VERSION)
};

export const playerProfileSharedEventSchema = z
  .object({
    ...baseEventFields,
    type: z.literal("player.profile_shared"),
    payload: z.object({ package: sharedPlayerPackageSchema }).strict()
  })
  .strict();

export const profileReceivedEventSchema = z
  .object({
    ...baseEventFields,
    type: z.literal("profile.received"),
    payload: z
      .object({
        packageId: idSchema,
        receivedAt: isoDateTimeSchema
      })
      .strict()
  })
  .strict();

export const tryoutInvitationEventSchema = z
  .object({
    ...baseEventFields,
    type: z.literal("tryout.invitation"),
    payload: z.object({ invitation: tryoutInvitationSchema }).strict()
  })
  .strict();

export const invitationResponseEventSchema = z
  .object({
    ...baseEventFields,
    type: z.literal("invitation.response"),
    payload: z
      .object({
        invitationId: idSchema,
        response: z.enum(["accepted", "declined", "clarification_requested"]),
        message: nonEmptyTextSchema.optional()
      })
      .strict()
  })
  .strict();

export const travelSupportProposedEventSchema = z
  .object({
    ...baseEventFields,
    type: z.literal("travel_support.proposed"),
    payload: z.object({ proposal: paymentProposalSchema }).strict()
  })
  .strict();

export const walletAddressSharedEventSchema = z
  .object({
    ...baseEventFields,
    type: z.literal("wallet.address_shared"),
    payload: z
      .object({
        relationshipId: idSchema,
        wallet: walletPublicMetadataSchema
      })
      .strict()
  })
  .strict();

export const travelSupportSentEventSchema = z
  .object({
    ...baseEventFields,
    type: z.literal("travel_support.sent"),
    payload: z.object({ payment: paymentReferenceSchema }).strict()
  })
  .strict();

export const scoutPassEventSchema = z.discriminatedUnion("type", [
  playerProfileSharedEventSchema,
  profileReceivedEventSchema,
  tryoutInvitationEventSchema,
  invitationResponseEventSchema,
  walletAddressSharedEventSchema,
  travelSupportProposedEventSchema,
  travelSupportSentEventSchema
]);

export type PlayerProfileSharedEvent = z.infer<typeof playerProfileSharedEventSchema>;
export type ProfileReceivedEvent = z.infer<typeof profileReceivedEventSchema>;
export type TryoutInvitationEvent = z.infer<typeof tryoutInvitationEventSchema>;
export type InvitationResponseEvent = z.infer<typeof invitationResponseEventSchema>;
export type WalletAddressSharedEvent = z.infer<typeof walletAddressSharedEventSchema>;
export type TravelSupportProposedEvent = z.infer<typeof travelSupportProposedEventSchema>;
export type TravelSupportSentEvent = z.infer<typeof travelSupportSentEventSchema>;
export type ScoutPassEvent = z.infer<typeof scoutPassEventSchema>;
