import { z } from "zod";

import { REPORT_DISCLAIMER } from "../../domain/constants.js";
import { scoutReportContentSchema, type ScoutReport } from "../../domain/models/scout-report.js";

export class InvalidScoutReportOutputError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InvalidScoutReportOutputError";
  }
}

export const SCOUT_REPORT_JSON_SCHEMA = {
  type: "object",
  properties: {
    playerSummary: { type: "string" },
    positionalProfile: { type: "string" },
    strengths: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: { $ref: "#/$defs/reportItem" }
    },
    developmentAreas: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: { $ref: "#/$defs/reportItem" }
    },
    playingStyle: { type: "string" },
    suitableSystems: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: { type: "string" }
    },
    scoutQuestions: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: { type: "string" }
    },
    dataLimitations: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: { type: "string" }
    },
    generatedAt: { type: "string" },
    modelInfo: { type: "string" }
  },
  required: [
    "playerSummary",
    "positionalProfile",
    "strengths",
    "developmentAreas",
    "playingStyle",
    "suitableSystems",
    "scoutQuestions",
    "dataLimitations",
    "generatedAt",
    "modelInfo"
  ],
  additionalProperties: false,
  $defs: {
    reportItem: {
      type: "object",
      properties: {
        title: { type: "string" },
        explanation: { type: "string" },
        evidence: {
          type: "array",
          minItems: 1,
          maxItems: 12,
          items: { type: "string" }
        },
        confidence: { enum: ["low", "medium", "high"] }
      },
      required: ["title", "explanation", "evidence", "confidence"],
      additionalProperties: false
    }
  }
} as const;

export const stripJsonCodeFence = (text: string): string => {
  const trimmed = text.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return (match?.[1] ?? trimmed).trim();
};

export const parseScoutReportJson = (rawText: string): ScoutReport => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonCodeFence(rawText));
  } catch (error) {
    throw new InvalidScoutReportOutputError("QVAC returned text that is not valid JSON.", {
      cause: error
    });
  }

  const result = scoutReportContentSchema.safeParse(parsed);
  if (!result.success) {
    throw new InvalidScoutReportOutputError(z.prettifyError(result.error), {
      cause: result.error
    });
  }

  return result.data;
};

export const normalizeGeneratedReportMetadata = (
  report: ScoutReport,
  modelInfo: string,
  now = new Date()
): ScoutReport =>
  scoutReportContentSchema.parse({
    ...report,
    generatedAt: now.toISOString(),
    modelInfo,
    dataLimitations: report.dataLimitations.some((item) =>
      item.toLowerCase().includes("self-entered")
    )
      ? report.dataLimitations
      : [...report.dataLimitations, REPORT_DISCLAIMER]
  });
