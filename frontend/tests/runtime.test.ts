import { describe, expect, it } from "vitest";

import { getRuntimeInfo } from "@scoutpass/backend/runtime";
import { runtimeFailureError, toUserFacingMessage } from "../src/runtime/user-facing-errors.js";

describe("local runtime bridge", () => {
  it("exposes a ready local-first runtime", () => {
    expect(getRuntimeInfo()).toEqual({
      mode: "local-first",
      protocolVersion: "1.0.0",
      status: "ready"
    });
  });

  it("maps runtime failure codes without exposing runtime messages", () => {
    const error = runtimeFailureError(
      {
        code: "wallet_operation_failed",
        message: "seed phrase and private RPC URL",
        retryable: true
      },
      "Wallet failed."
    );
    expect(toUserFacingMessage(error, "fallback")).toBe(
      "The testnet wallet operation failed. Check balances and try again."
    );
    expect(toUserFacingMessage(new Error("private path"), "Safe fallback")).toBe("Safe fallback");
  });
});
