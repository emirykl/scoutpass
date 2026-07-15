import { describe, expect, it } from "vitest";

import { runtimeCommandSchema, runtimeEventSchema } from "../src/contracts/runtime-messages.js";
import { preparePlayerShare } from "../src/application/share/prepare-player-share.js";
import { DEFAULT_SHARE_SELECTION } from "../src/domain/models/sharing.js";
import { createInvitation, createPlayer, createReport, NOW, PUBLIC_KEY } from "./fixtures.js";

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
    const report = {
      ...createReport(),
      playerSummary: "A".repeat(2_000)
    };
    const prepared = preparePlayerShare({
      player: createPlayer(),
      report,
      selection: DEFAULT_SHARE_SELECTION,
      playerPublicKey: PUBLIC_KEY,
      now: NOW
    });
    expect(prepared.serializedPayload.length).toBeGreaterThan(2_000);
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

  it("validates invitation and WDK wallet commands", () => {
    const invitation = createInvitation();
    expect(
      runtimeCommandSchema.safeParse({
        requestId: "request_invitation_001",
        sentAt: NOW.toISOString(),
        type: "invitation.send",
        payload: invitation
      }).success
    ).toBe(true);

    const wallet = {
      id: "wallet_player_ethereum_sepolia",
      ownerRole: "player",
      network: "Ethereum Sepolia",
      chainId: 11155111,
      address: `0x${"1".repeat(40)}`,
      testnetOnly: true,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString()
    };
    expect(
      runtimeCommandSchema.safeParse({
        requestId: "request_wallet_001",
        sentAt: NOW.toISOString(),
        type: "wallet.address.share",
        payload: {
          relationshipId: "relationship_demo_001",
          wallet,
          playerApproved: true
        }
      }).success
    ).toBe(true);
    expect(
      runtimeEventSchema.safeParse({
        requestId: "request_wallet_001",
        occurredAt: NOW.toISOString(),
        type: "wallet.updated",
        payload: { wallet, balance: "0" }
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
