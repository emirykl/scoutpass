import { z } from "zod";

import { SCHEMA_VERSION } from "../constants.js";
import { idSchema, isoDateTimeSchema, publicKeySchema } from "./common.js";
import { scoutReportContentSchema } from "./scout-report.js";

export const shareSelectionSchema = z
  .object({
    basicFootballProfile: z.boolean(),
    contactInformation: z.boolean(),
    statistics: z.boolean(),
    playerSummary: z.boolean(),
    strengths: z.boolean(),
    developmentAreas: z.boolean(),
    playingStyle: z.boolean(),
    coachNotes: z.boolean(),
    scoutQuestions: z.boolean()
  })
  .strict();

export const DEFAULT_SHARE_SELECTION: ShareSelection = {
  basicFootballProfile: true,
  contactInformation: false,
  statistics: false,
  playerSummary: true,
  strengths: true,
  developmentAreas: false,
  playingStyle: false,
  coachNotes: false,
  scoutQuestions: false
};

export const sharePreferenceSchema = z
  .object({
    id: idSchema,
    relationshipId: idSchema,
    selection: shareSelectionSchema,
    updatedAt: isoDateTimeSchema
  })
  .strict();

export const sharedPlayerPackageSchema = z
  .object({
    packageId: idSchema,
    playerPublicKey: publicKeySchema,
    selectedProfileFields: z.record(z.string(), z.unknown()),
    selectedReportSections: scoutReportContentSchema.partial(),
    createdAt: isoDateTimeSchema,
    expiresAt: isoDateTimeSchema.optional(),
    schemaVersion: z.literal(SCHEMA_VERSION)
  })
  .strict();

export type ShareSelection = z.infer<typeof shareSelectionSchema>;
export type SharePreference = z.infer<typeof sharePreferenceSchema>;
export type SharedPlayerPackage = z.infer<typeof sharedPlayerPackageSchema>;
