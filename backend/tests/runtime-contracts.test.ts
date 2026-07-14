import { describe, expect, it } from "vitest";

import { runtimeCommandSchema, runtimeEventSchema } from "../src/contracts/runtime-messages.js";
import { preparePlayerShare } from "../src/application/share/prepare-player-share.js";
import { DEFAULT_SHARE_SELECTION } from "../src/domain/models/sharing.js";
import { createPlayer, createReport, NOW, PUBLIC_KEY } from "./fixtures.js";

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

  it("validates approved share commands and received package events", () => {
    const prepared = preparePlayerShare({
      player: createPlayer(),
      report: createReport(),
      selection: DEFAULT_SHARE_SELECTION,
      playerPublicKey: PUBLIC_KEY,
      now: NOW
    });
    expect(
      runtimeCommandSchema.safeParse({
        requestId: "request_share_001",
        sentAt: NOW.toISOString(),
        type: "share.send",
        payload: {
          relationshipId: "relationship_demo_001",
          package: prepared.package,
          serializedPayload: prepared.serializedPayload,
          payloadBytes: prepared.payloadBytes,
          playerApproved: true
        }
      }).success
    ).toBe(true);
    expect(
      runtimeEventSchema.safeParse({
        requestId: "request_share_001",
        occurredAt: NOW.toISOString(),
        type: "share.received",
        payload: { package: prepared.package }
      }).success
    ).toBe(true);
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
