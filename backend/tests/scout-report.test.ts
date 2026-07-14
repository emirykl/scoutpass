import { describe, expect, it } from "vitest";

import { scoutReportContentSchema } from "../src/domain/models/scout-report.js";
import { createReport } from "./fixtures.js";

describe("scout report schema", () => {
  it("accepts a complete structured report", () => {
    expect(scoutReportContentSchema.safeParse(createReport()).success).toBe(true);
  });

  it("rejects unknown confidence values and missing evidence", () => {
    const report = createReport();
    const invalid = {
      ...report,
      strengths: [{ ...report.strengths[0], confidence: "certain", evidence: [] }]
    };
    expect(scoutReportContentSchema.safeParse(invalid).success).toBe(false);
  });
});
