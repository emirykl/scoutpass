import { describe, expect, it } from "vitest";

import { createSharedPackage } from "../src/application/share/create-shared-package.js";
import {
  DEFAULT_SHARE_SELECTION,
  sharedPlayerPackageSchema
} from "../src/domain/models/sharing.js";
import { createPlayer, createReport, NOW, PUBLIC_KEY } from "./fixtures.js";

describe("selective share package", () => {
  it("shares only the three default sections", () => {
    const shared = createSharedPackage({
      player: createPlayer({ contact: { email: "private@example.test" } }),
      report: createReport(),
      selection: DEFAULT_SHARE_SELECTION,
      playerPublicKey: PUBLIC_KEY,
      now: NOW
    });

    expect(Object.keys(shared.selectedProfileFields)).toEqual(["football"]);
    expect(Object.keys(shared.selectedReportSections).sort()).toEqual([
      "playerSummary",
      "strengths"
    ]);
    expect(JSON.stringify(shared)).not.toContain("private@example.test");
    expect(JSON.stringify(shared)).not.toContain("coachFeedback");
    expect(sharedPlayerPackageSchema.safeParse(shared).success).toBe(true);
  });

  it("includes explicitly selected contact, statistics, and coach notes", () => {
    const shared = createSharedPackage({
      player: createPlayer({ contact: { email: "share@example.test" } }),
      report: createReport(),
      selection: {
        ...DEFAULT_SHARE_SELECTION,
        contactInformation: true,
        statistics: true,
        coachNotes: true
      },
      playerPublicKey: PUBLIC_KEY,
      now: NOW
    });

    expect(shared.selectedProfileFields).toHaveProperty("contact.email", "share@example.test");
    expect(shared.selectedProfileFields).toHaveProperty("performance");
    expect(shared.selectedProfileFields).toHaveProperty("coachFeedback");
  });
});
