import { describe, expect, it } from "vitest";

import { PROTOCOL_VERSION, SCHEMA_VERSION, TESTNET_CONFIG } from "../src/domain/constants.js";
import { scoutPassEventSchema } from "../src/domain/models/events.js";
import { assertEventIsFresh, EventFreshnessError } from "../src/domain/services/event-freshness.js";
import {
  EventDeduplicator,
  InMemoryEventIdStore
} from "../src/domain/services/event-deduplicator.js";
import { createSharedPackage } from "../src/application/share/create-shared-package.js";
import { DEFAULT_SHARE_SELECTION } from "../src/domain/models/sharing.js";
import { createInvitation, createPlayer, createReport, NOW, PUBLIC_KEY } from "./fixtures.js";

const base = {
  id: "event_demo_001",
  senderPublicKey: PUBLIC_KEY,
  createdAt: NOW.toISOString(),
  protocolVersion: PROTOCOL_VERSION
};

describe("P2P event validation", () => {
  it("accepts each known event type", () => {
    const sharedPackage = createSharedPackage({
      player: createPlayer(),
      report: createReport(),
      selection: DEFAULT_SHARE_SELECTION,
      playerPublicKey: PUBLIC_KEY,
      now: NOW
    });
    const payment = {
      id: "payment_demo_001",
      invitationId: "invitation_demo_001",
      relationshipId: "relationship_demo_001",
      destinationAddress: `0x${"1".repeat(40)}`,
      network: TESTNET_CONFIG.network,
      tokenAddress: TESTNET_CONFIG.tokenAddress,
      asset: "USD₮" as const,
      amount: "25.50",
      feeBaseUnits: "21000000000000",
      status: "confirmed" as const,
      transactionId: `0x${"2".repeat(64)}`,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString()
    };
    const proposal = {
      id: payment.id,
      invitationId: payment.invitationId,
      relationshipId: payment.relationshipId,
      destinationAddress: payment.destinationAddress,
      network: payment.network,
      tokenAddress: payment.tokenAddress,
      asset: payment.asset,
      amount: payment.amount,
      feeBaseUnits: payment.feeBaseUnits,
      status: "proposed" as const,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    };
    const events = [
      {
        ...base,
        type: "player.profile_shared",
        payload: { package: sharedPackage }
      },
      {
        ...base,
        id: "event_demo_002",
        type: "profile.received",
        payload: { packageId: "package_demo_001", receivedAt: NOW.toISOString() }
      },
      {
        ...base,
        id: "event_demo_003",
        type: "tryout.invitation",
        payload: { invitation: createInvitation() }
      },
      {
        ...base,
        id: "event_demo_004",
        type: "invitation.response",
        payload: { invitationId: "invitation_demo_001", response: "accepted" }
      },
      {
        ...base,
        id: "event_demo_005",
        type: "wallet.address_shared",
        payload: {
          relationshipId: "relationship_demo_001",
          wallet: {
            id: "wallet_player_demo",
            ownerRole: "player",
            network: TESTNET_CONFIG.network,
            chainId: TESTNET_CONFIG.chainId,
            address: `0x${"1".repeat(40)}`,
            testnetOnly: true,
            createdAt: NOW.toISOString(),
            updatedAt: NOW.toISOString()
          }
        }
      },
      {
        ...base,
        id: "event_demo_006",
        type: "travel_support.proposed",
        payload: { proposal }
      },
      {
        ...base,
        id: "event_demo_007",
        type: "travel_support.sent",
        payload: { payment }
      }
    ];

    for (const event of events) {
      expect(scoutPassEventSchema.safeParse(event).success).toBe(true);
    }
  });

  it("rejects unknown types and incompatible protocol versions", () => {
    expect(
      scoutPassEventSchema.safeParse({ ...base, type: "remote.code", payload: {} }).success
    ).toBe(false);
    expect(
      scoutPassEventSchema.safeParse({
        ...base,
        protocolVersion: "99.0.0",
        type: "profile.received",
        payload: { packageId: "package_demo_001", receivedAt: NOW.toISOString() }
      }).success
    ).toBe(false);
  });

  it("rejects duplicate event IDs", async () => {
    const deduplicator = new EventDeduplicator(new InMemoryEventIdStore());
    await expect(deduplicator.accept("event_demo_001")).resolves.toBe(true);
    await expect(deduplicator.accept("event_demo_001")).resolves.toBe(false);
  });

  it("keeps schema and protocol versions explicit", () => {
    expect(SCHEMA_VERSION).toBe("1.0.0");
    expect(PROTOCOL_VERSION).toBe("1.0.0");
  });

  it("rejects stale replay candidates and implausible future timestamps", () => {
    expect(() =>
      assertEventIsFresh(
        { createdAt: "2026-07-01T10:00:00.000Z" },
        { now: NOW, maxAgeMs: 24 * 60 * 60 * 1_000 }
      )
    ).toThrow(EventFreshnessError);
    expect(() =>
      assertEventIsFresh(
        { createdAt: "2026-07-14T11:00:00.000Z" },
        { now: NOW, maxFutureSkewMs: 5 * 60 * 1_000 }
      )
    ).toThrow(EventFreshnessError);
  });
});
