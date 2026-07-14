import { describe, expect, it } from "vitest";

import { sanitizeLogValue } from "../src/infrastructure/logging/sanitized-logger.js";

describe("sanitized logger", () => {
  it("redacts nested wallet secret fields", () => {
    expect(
      sanitizeLogValue({
        wallet: {
          address: "0xpublic",
          seedPhrase: "secret words",
          privateKey: "0xprivate"
        }
      })
    ).toEqual({
      wallet: {
        address: "0xpublic",
        seedPhrase: "[REDACTED]",
        privateKey: "[REDACTED]"
      }
    });
  });
});
