import { describe, expect, it } from "vitest";

import { PROTOCOL_VERSION } from "../src/domain/constants.js";
import type { ProfileReceivedEvent } from "../src/domain/models/events.js";
import {
  createInviteCode,
  createRelationshipTopic,
  decodeScoutPassEvent,
  encodeScoutPassEvent,
  MAX_P2P_PAYLOAD_BYTES,
  parseInviteCode,
  PeerPayloadValidationError
} from "../src/protocol/peer-wire.js";
import { NOW, PUBLIC_KEY } from "./fixtures.js";

const event: ProfileReceivedEvent = {
  id: "event_demo_wire_001",
  type: "profile.received",
  senderPublicKey: PUBLIC_KEY,
  createdAt: NOW.toISOString(),
  protocolVersion: PROTOCOL_VERSION,
  payload: {
    packageId: "package_demo_001",
    receivedAt: NOW.toISOString()
  }
};

describe("Pears wire protocol", () => {
  it("creates relationship-specific invite codes", () => {
    const topic = createRelationshipTopic("relationship_demo_001", Buffer.alloc(32, 1));
    const invite = createInviteCode({
      protocolVersion: PROTOCOL_VERSION,
      relationshipId: "relationship_demo_001",
      topicHex: topic.toString("hex")
    });

    expect(parseInviteCode(invite)).toEqual({
      protocolVersion: PROTOCOL_VERSION,
      relationshipId: "relationship_demo_001",
      topicHex: topic.toString("hex")
    });
  });

  it("round-trips validated events", () => {
    expect(decodeScoutPassEvent(encodeScoutPassEvent(event))).toEqual(event);
  });

  it("rejects unknown event types and malformed payloads", () => {
    const unknownType = new TextEncoder().encode(
      JSON.stringify({ ...event, type: "remote.code", payload: {} })
    );

    expect(() => decodeScoutPassEvent(unknownType)).toThrow(PeerPayloadValidationError);
    expect(() => decodeScoutPassEvent(new TextEncoder().encode("{not-json"))).toThrow(
      PeerPayloadValidationError
    );
  });

  it("rejects oversized payloads before parsing", () => {
    expect(() => decodeScoutPassEvent(new Uint8Array(MAX_P2P_PAYLOAD_BYTES + 1))).toThrow(
      PeerPayloadValidationError
    );
  });
});
