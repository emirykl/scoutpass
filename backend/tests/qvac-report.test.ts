import { describe, expect, it } from "vitest";

import { buildScoutReportPrompt } from "../src/infrastructure/qvac/scout-report-prompt.js";
import {
  InvalidScoutReportOutputError,
  normalizeGeneratedReportMetadata,
  parseAndNormalizeGeneratedReport,
  parseScoutReportJson,
  stripJsonCodeFence
} from "../src/infrastructure/qvac/scout-report-json.js";
import { createPlayer, createReport, NOW } from "./fixtures.js";

describe("QVAC scouting report parsing", () => {
  it("builds a local-only prompt with ethical scouting limits", () => {
    const prompt = buildScoutReportPrompt(createPlayer());
    expect(prompt).toContain("Return ONLY valid JSON");
    expect(prompt).toContain("Do not claim that the player will become professional");
    expect(prompt).toContain("self-entered");
    expect(prompt).toContain("Right Winger");
  });

  it("parses valid JSON and markdown fenced JSON", () => {
    const report = createReport();
    const json = JSON.stringify(report);
    expect(parseScoutReportJson(json)).toEqual(report);
    expect(parseScoutReportJson(`\`\`\`json\n${json}\n\`\`\``)).toEqual(report);
    expect(stripJsonCodeFence(`\`\`\`json\n${json}\n\`\`\``)).toBe(json);
  });

  it("rejects malformed and schema-invalid output", () => {
    expect(() => parseScoutReportJson("{not-json")).toThrow(InvalidScoutReportOutputError);
    expect(() => parseScoutReportJson(JSON.stringify({ playerSummary: "too short" }))).toThrow(
      InvalidScoutReportOutputError
    );
  });

  it("normalizes generated metadata from the local model boundary", () => {
    const normalized = normalizeGeneratedReportMetadata(
      { ...createReport(), generatedAt: "2020-01-01T00:00:00.000Z", modelInfo: "model" },
      "QVAC installed model",
      NOW
    );

    expect(normalized.generatedAt).toBe(NOW.toISOString());
    expect(normalized.modelInfo).toBe("QVAC installed model");

    const generated = parseAndNormalizeGeneratedReport(
      JSON.stringify({ ...createReport(), generatedAt: "not-a-date", modelInfo: "invented" }),
      "QVAC QWEN3",
      NOW
    );
    expect(generated.generatedAt).toBe(NOW.toISOString());
    expect(generated.modelInfo).toBe("QVAC QWEN3");
  });
});
