import { z } from "zod";

import { idSchema, isoDateTimeSchema, nonEmptyTextSchema, shortTextSchema } from "./common.js";

export const confidenceSchema = z.enum(["low", "medium", "high"]);

export const reportItemSchema = z
  .object({
    title: shortTextSchema,
    explanation: nonEmptyTextSchema,
    evidence: z.array(nonEmptyTextSchema).min(1).max(12),
    confidence: confidenceSchema
  })
  .strict();

export const scoutReportContentSchema = z
  .object({
    playerSummary: nonEmptyTextSchema,
    positionalProfile: nonEmptyTextSchema,
    strengths: z.array(reportItemSchema).min(1).max(12),
    developmentAreas: z.array(reportItemSchema).min(1).max(12),
    playingStyle: nonEmptyTextSchema,
    suitableSystems: z.array(shortTextSchema).min(1).max(12),
    scoutQuestions: z.array(nonEmptyTextSchema).min(1).max(20),
    dataLimitations: z.array(nonEmptyTextSchema).min(1).max(20),
    generatedAt: isoDateTimeSchema,
    modelInfo: shortTextSchema
  })
  .strict();

export const storedScoutReportSchema = z
  .object({
    id: idSchema,
    playerId: idSchema,
    content: scoutReportContentSchema,
    disclaimer: nonEmptyTextSchema,
    editedByPlayer: z.boolean(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema
  })
  .strict();

export type ReportItem = z.infer<typeof reportItemSchema>;
export type ScoutReport = z.infer<typeof scoutReportContentSchema>;
export type StoredScoutReport = z.infer<typeof storedScoutReportSchema>;
