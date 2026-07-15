import { describe, expect, it } from "vitest";

import { mapErrorToUserFacingFailure } from "../src/application/errors/user-facing-error.js";
import { TravelSupportPaymentError } from "../src/application/wallet/travel-support-payment-service.js";

describe("user-facing error mapping", () => {
  it("does not expose unknown technical or secret-bearing messages", () => {
    const failure = mapErrorToUserFacingFailure(
      new Error("RPC failed with seed phrase: alpha beta gamma and /Users/private/path")
    );

    expect(failure).toEqual({
      code: "local_operation_failed",
      message: "The local operation could not be completed safely.",
      retryable: false
    });
    expect(JSON.stringify(failure)).not.toContain("alpha beta gamma");
    expect(JSON.stringify(failure)).not.toContain("/Users/private/path");
  });

  it("maps domain errors by stable code instead of their original message", () => {
    const failure = mapErrorToUserFacingFailure(
      new TravelSupportPaymentError("duplicate_payment", "internal invitation identifier leaked")
    );

    expect(failure.code).toBe("duplicate_payment");
    expect(failure.message).toBe("A travel support payment already exists for this invitation.");
    expect(failure.message).not.toContain("identifier");
  });
});
