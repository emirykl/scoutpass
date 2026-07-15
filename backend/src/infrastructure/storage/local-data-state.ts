import { z } from "zod";

import { SCHEMA_VERSION } from "../../domain/constants.js";
import { isoDateTimeSchema } from "../../domain/models/common.js";
import { scoutPrivateNoteSchema, tryoutInvitationSchema } from "../../domain/models/invitation.js";
import { playerProfileSchema } from "../../domain/models/player-profile.js";
import { scoutingRelationshipSchema } from "../../domain/models/relationship.js";
import { storedScoutReportSchema } from "../../domain/models/scout-report.js";
import { sharedPlayerPackageSchema, sharePreferenceSchema } from "../../domain/models/sharing.js";
import { paymentReferenceSchema, walletPublicMetadataSchema } from "../../domain/models/wallet.js";
import { scoutPassEventSchema } from "../../domain/models/events.js";

export const localDataStateSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    updatedAt: isoDateTimeSchema,
    profiles: z.record(z.string(), playerProfileSchema),
    reports: z.record(z.string(), storedScoutReportSchema),
    sharePreferences: z.record(z.string(), sharePreferenceSchema),
    relationships: z.record(z.string(), scoutingRelationshipSchema),
    receivedPackages: z.record(z.string(), sharedPlayerPackageSchema),
    invitations: z.record(z.string(), tryoutInvitationSchema),
    scoutPrivateNotes: z.record(z.string(), scoutPrivateNoteSchema).default({}),
    wallets: z.record(z.string(), walletPublicMetadataSchema),
    payments: z.record(z.string(), paymentReferenceSchema),
    relationshipEvents: z.record(z.string(), z.array(scoutPassEventSchema)),
    processedEventIds: z.array(z.string().min(3).max(128))
  })
  .strict();

export type LocalDataState = z.infer<typeof localDataStateSchema>;
export type CollectionName = Exclude<
  keyof LocalDataState,
  "schemaVersion" | "updatedAt" | "processedEventIds"
>;

export const createEmptyLocalDataState = (now = new Date()): LocalDataState => ({
  schemaVersion: SCHEMA_VERSION,
  updatedAt: now.toISOString(),
  profiles: {},
  reports: {},
  sharePreferences: {},
  relationships: {},
  receivedPackages: {},
  invitations: {},
  scoutPrivateNotes: {},
  wallets: {},
  payments: {},
  relationshipEvents: {},
  processedEventIds: []
});
