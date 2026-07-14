import { createHash, randomBytes } from "node:crypto";

import { z } from "zod";

import { PROTOCOL_VERSION } from "../domain/constants.js";
import { idSchema } from "../domain/models/common.js";
import { scoutPassEventSchema, type ScoutPassEvent } from "../domain/models/events.js";

export const MAX_P2P_PAYLOAD_BYTES = 64 * 1024;

export class PeerPayloadValidationError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PeerPayloadValidationError";
  }
}

export const scoutingInviteSchema = z
  .object({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    relationshipId: idSchema,
    topicHex: z.string().regex(/^[a-f0-9]{64}$/)
  })
  .strict();

export type ScoutingInvite = z.infer<typeof scoutingInviteSchema>;

export const createRelationshipTopic = (relationshipId: string, secret = randomBytes(32)): Buffer =>
  createHash("sha256")
    .update("scoutpass:relationship:v1")
    .update(relationshipId)
    .update(secret)
    .digest();

export const createInviteCode = (invite: ScoutingInvite): string => {
  const encoded = Buffer.from(JSON.stringify(scoutingInviteSchema.parse(invite)), "utf8").toString(
    "base64url"
  );
  return `scoutpass:${encoded}`;
};

export const parseInviteCode = (code: string): ScoutingInvite => {
  const prefix = "scoutpass:";
  if (!code.startsWith(prefix)) {
    throw new PeerPayloadValidationError("Invite code has an invalid prefix.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(code.slice(prefix.length), "base64url").toString("utf8"));
  } catch (error) {
    throw new PeerPayloadValidationError("Invite code is malformed.", { cause: error });
  }

  const result = scoutingInviteSchema.safeParse(parsed);
  if (!result.success) {
    throw new PeerPayloadValidationError(z.prettifyError(result.error), { cause: result.error });
  }
  return result.data;
};

export const encodeScoutPassEvent = (event: ScoutPassEvent): Uint8Array => {
  const validated = scoutPassEventSchema.parse(event);
  const bytes = new TextEncoder().encode(JSON.stringify(validated));
  if (bytes.byteLength > MAX_P2P_PAYLOAD_BYTES) {
    throw new PeerPayloadValidationError("P2P event exceeds the payload size limit.");
  }
  return bytes;
};

export const decodeScoutPassEvent = (payload: Uint8Array): ScoutPassEvent => {
  if (payload.byteLength > MAX_P2P_PAYLOAD_BYTES) {
    throw new PeerPayloadValidationError("P2P event exceeds the payload size limit.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(payload));
  } catch (error) {
    throw new PeerPayloadValidationError("P2P event is not valid UTF-8 JSON.", { cause: error });
  }

  const result = scoutPassEventSchema.safeParse(parsed);
  if (!result.success) {
    throw new PeerPayloadValidationError(z.prettifyError(result.error), { cause: result.error });
  }
  return result.data;
};
