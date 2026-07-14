import { createHash, randomBytes } from "node:crypto";

import { z } from "zod";

import { PROTOCOL_VERSION } from "../domain/constants.js";
import { idSchema } from "../domain/models/common.js";
import { scoutPassEventSchema, type ScoutPassEvent } from "../domain/models/events.js";

export const MAX_P2P_PAYLOAD_BYTES = 64 * 1024;
const FRAME_HEADER_BYTES = 4;

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

export const encodeScoutPassEventFrame = (event: ScoutPassEvent): Uint8Array => {
  const payload = encodeScoutPassEvent(event);
  const frame = new Uint8Array(FRAME_HEADER_BYTES + payload.byteLength);
  new DataView(frame.buffer).setUint32(0, payload.byteLength, false);
  frame.set(payload, FRAME_HEADER_BYTES);
  return frame;
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

export class ScoutPassEventFrameDecoder {
  #buffer: Uint8Array<ArrayBufferLike> = new Uint8Array(0);

  public push(chunk: Uint8Array): ScoutPassEvent[] {
    this.#buffer = concatenate(this.#buffer, chunk);
    const events: ScoutPassEvent[] = [];

    while (this.#buffer.byteLength >= FRAME_HEADER_BYTES) {
      const length = new DataView(
        this.#buffer.buffer,
        this.#buffer.byteOffset,
        this.#buffer.byteLength
      ).getUint32(0, false);

      if (length > MAX_P2P_PAYLOAD_BYTES) {
        this.#buffer = new Uint8Array(0);
        throw new PeerPayloadValidationError("P2P event frame exceeds the payload size limit.");
      }

      const frameLength = FRAME_HEADER_BYTES + length;
      if (this.#buffer.byteLength < frameLength) {
        break;
      }

      const payload = this.#buffer.slice(FRAME_HEADER_BYTES, frameLength);
      events.push(decodeScoutPassEvent(payload));
      this.#buffer = this.#buffer.slice(frameLength);
    }

    return events;
  }
}

const concatenate = (
  left: Uint8Array<ArrayBufferLike>,
  right: Uint8Array<ArrayBufferLike>
): Uint8Array<ArrayBufferLike> => {
  const result = new Uint8Array(left.byteLength + right.byteLength);
  result.set(left, 0);
  result.set(right, left.byteLength);
  return result;
};
