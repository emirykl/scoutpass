import { describe, expect, it } from "vitest";

import { runtimeCommandSchema, runtimeEventSchema } from "../src/contracts/runtime-messages.js";
import { createPlayer, NOW } from "./fixtures.js";

describe("renderer to local runtime contracts", () => {
  it("validates typed commands", () => {
    expect(
      runtimeCommandSchema.safeParse({
        requestId: "request_demo_001",
        sentAt: NOW.toISOString(),
        type: "profile.save",
        payload: createPlayer()
      }).success
    ).toBe(true);
  });

  it("validates Pears connection commands and status events", () => {
    expect(
      runtimeCommandSchema.safeParse({
        requestId: "request_demo_002",
        sentAt: NOW.toISOString(),
        type: "connection.connect",
        payload: { inviteCode: "scoutpass:abc" }
      }).success
    ).toBe(true);

    expect(
      runtimeEventSchema.safeParse({
        requestId: "request_demo_002",
        occurredAt: NOW.toISOString(),
        type: "connection.status",
        payload: { status: "peer_not_found" }
      }).success
    ).toBe(true);
  });

  it("rejects unknown runtime messages", () => {
    expect(
      runtimeCommandSchema.safeParse({
        requestId: "request_demo_001",
        sentAt: NOW.toISOString(),
        type: "runtime.execute_code",
        payload: { code: "never" }
      }).success
    ).toBe(false);
  });

  it("validates sanitized runtime errors", () => {
    expect(
      runtimeEventSchema.safeParse({
        requestId: "request_demo_001",
        occurredAt: NOW.toISOString(),
        type: "operation.failed",
        payload: {
          code: "STORAGE_CORRUPTED",
          message: "Local data could not be read.",
          retryable: false
        }
      }).success
    ).toBe(true);
  });
});
