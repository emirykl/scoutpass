import { z } from "zod";

import { TESTNET_CONFIG } from "../constants.js";
import { idSchema, isoDateTimeSchema } from "./common.js";
import { moneyAmountSchema, paymentAssetSchema } from "./invitation.js";

export const paymentStatusSchema = z.enum([
  "proposed",
  "pending",
  "confirmed",
  "rejected",
  "failed"
]);

export const walletPublicMetadataSchema = z
  .object({
    id: idSchema,
    ownerRole: z.enum(["player", "scout"]),
    network: z.literal(TESTNET_CONFIG.network),
    chainId: z.literal(TESTNET_CONFIG.chainId),
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    testnetOnly: z.literal(true),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema
  })
  .strict();

export const paymentProposalSchema = z
  .object({
    id: idSchema,
    invitationId: idSchema,
    relationshipId: idSchema,
    destinationAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    network: z.literal(TESTNET_CONFIG.network),
    tokenAddress: z.literal(TESTNET_CONFIG.tokenAddress),
    asset: paymentAssetSchema,
    amount: moneyAmountSchema,
    feeBaseUnits: z.string().regex(/^\d+$/),
    status: paymentStatusSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema
  })
  .strict();

export const paymentReferenceSchema = paymentProposalSchema
  .extend({
    transactionId: z
      .string()
      .regex(/^0x[a-fA-F0-9]{64}$/)
      .optional(),
    failureReason: z.string().trim().min(1).max(500).optional()
  })
  .strict();

export type WalletPublicMetadata = z.infer<typeof walletPublicMetadataSchema>;
export type PaymentProposal = z.infer<typeof paymentProposalSchema>;
export type PaymentReference = z.infer<typeof paymentReferenceSchema>;
