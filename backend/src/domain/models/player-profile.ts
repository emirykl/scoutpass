import { z } from "zod";

import {
  idSchema,
  isoDateTimeSchema,
  nonEmptyTextSchema,
  nonNegativeIntegerSchema,
  nonNegativeNumberSchema,
  percentageSchema,
  shortTextSchema
} from "./common.js";

export const positionGroupSchema = z.enum(["goalkeeper", "defender", "midfielder", "forward"]);
export type PositionGroup = z.infer<typeof positionGroupSchema>;

export const dominantFootSchema = z.enum(["left", "right", "both"]);
export const availabilitySchema = z.enum(["available", "limited", "unavailable"]);

export const footballInformationSchema = z
  .object({
    fullName: shortTextSchema,
    age: z.number().int().min(18).max(60),
    country: shortTextSchema,
    city: shortTextSchema,
    currentTeam: shortTextSchema,
    primaryPosition: shortTextSchema,
    secondaryPosition: shortTextSchema.optional(),
    positionGroup: positionGroupSchema,
    dominantFoot: dominantFootSchema,
    heightCm: z.number().int().min(120).max(230),
    preferredPlayingStyle: nonEmptyTextSchema,
    careerObjective: nonEmptyTextSchema
  })
  .strict();

export const contactInformationSchema = z
  .object({
    email: z.email().max(254).optional(),
    phone: z.string().trim().min(7).max(32).optional()
  })
  .strict()
  .refine((contact) => contact.email !== undefined || contact.phone !== undefined, {
    message: "At least one contact method is required when contact information is provided."
  });

export const commonPerformanceSchema = z
  .object({
    matchesPlayed: nonNegativeIntegerSchema.max(200),
    minutesPlayed: nonNegativeIntegerSchema.max(20_000),
    goals: nonNegativeIntegerSchema.max(500),
    assists: nonNegativeIntegerSchema.max(500),
    passCompletionPercentage: percentageSchema.optional(),
    tacklesPerMatch: nonNegativeNumberSchema.max(30).optional(),
    interceptionsPerMatch: nonNegativeNumberSchema.max(30).optional(),
    shotsOnTarget: nonNegativeIntegerSchema.max(2_000).optional(),
    cleanSheets: nonNegativeIntegerSchema.max(200).optional(),
    yellowCards: nonNegativeIntegerSchema.max(100),
    redCards: nonNegativeIntegerSchema.max(30),
    availability: availabilitySchema,
    trainingFrequencyPerWeek: z.number().int().min(0).max(14)
  })
  .strict()
  .refine((performance) => performance.minutesPlayed <= performance.matchesPlayed * 130, {
    message: "Minutes played are not plausible for the number of matches.",
    path: ["minutesPlayed"]
  });

const goalkeeperMetricsSchema = z
  .object({
    positionGroup: z.literal("goalkeeper"),
    saves: nonNegativeIntegerSchema.max(2_000),
    savePercentage: percentageSchema,
    cleanSheets: nonNegativeIntegerSchema.max(200),
    crossesClaimed: nonNegativeIntegerSchema.max(1_000),
    distributionAccuracy: percentageSchema
  })
  .strict();

const defenderMetricsSchema = z
  .object({
    positionGroup: z.literal("defender"),
    tacklesPerMatch: nonNegativeNumberSchema.max(30),
    interceptionsPerMatch: nonNegativeNumberSchema.max(30),
    clearancesPerMatch: nonNegativeNumberSchema.max(50),
    aerialDuelsWonPercentage: percentageSchema,
    passingAccuracy: percentageSchema
  })
  .strict();

const midfielderMetricsSchema = z
  .object({
    positionGroup: z.literal("midfielder"),
    passCompletionPercentage: percentageSchema,
    keyPassesPerMatch: nonNegativeNumberSchema.max(30),
    assists: nonNegativeIntegerSchema.max(500),
    ballRecoveriesPerMatch: nonNegativeNumberSchema.max(50),
    chancesCreated: nonNegativeIntegerSchema.max(2_000)
  })
  .strict();

const forwardMetricsSchema = z
  .object({
    positionGroup: z.literal("forward"),
    goals: nonNegativeIntegerSchema.max(500),
    shots: nonNegativeIntegerSchema.max(3_000),
    shotsOnTarget: nonNegativeIntegerSchema.max(2_000),
    assists: nonNegativeIntegerSchema.max(500),
    successfulDribblesPerMatch: nonNegativeNumberSchema.max(30)
  })
  .strict()
  .refine((metrics) => metrics.shotsOnTarget <= metrics.shots, {
    message: "Shots on target cannot exceed total shots.",
    path: ["shotsOnTarget"]
  });

export const positionMetricsSchema = z.discriminatedUnion("positionGroup", [
  goalkeeperMetricsSchema,
  defenderMetricsSchema,
  midfielderMetricsSchema,
  forwardMetricsSchema
]);

export const performanceInformationSchema = z
  .object({
    common: commonPerformanceSchema,
    positionSpecific: positionMetricsSchema
  })
  .strict();

export const qualitativeInformationSchema = z
  .object({
    strongestQualities: nonEmptyTextSchema,
    developmentGoals: nonEmptyTextSchema,
    coachFeedback: nonEmptyTextSchema,
    preferredFormation: shortTextSchema,
    matchExperience: nonEmptyTextSchema,
    personalStatement: nonEmptyTextSchema
  })
  .strict();

export const playerProfileSchema = z
  .object({
    id: idSchema,
    football: footballInformationSchema,
    contact: contactInformationSchema.optional(),
    performance: performanceInformationSchema,
    qualitative: qualitativeInformationSchema,
    selfReported: z.literal(true),
    isDemo: z.boolean(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema
  })
  .strict()
  .refine(
    (profile) =>
      profile.football.positionGroup === profile.performance.positionSpecific.positionGroup,
    {
      message: "Football position group must match position-specific performance data.",
      path: ["performance", "positionSpecific", "positionGroup"]
    }
  );

export type FootballInformation = z.infer<typeof footballInformationSchema>;
export type ContactInformation = z.infer<typeof contactInformationSchema>;
export type CommonPerformance = z.infer<typeof commonPerformanceSchema>;
export type PositionMetrics = z.infer<typeof positionMetricsSchema>;
export type PerformanceInformation = z.infer<typeof performanceInformationSchema>;
export type QualitativeInformation = z.infer<typeof qualitativeInformationSchema>;
export type PlayerProfile = z.infer<typeof playerProfileSchema>;
