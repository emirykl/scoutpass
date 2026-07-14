import type { PlayerProfile } from "../../domain/models/player-profile.js";
import type { ScoutReport } from "../../domain/models/scout-report.js";
import type { SharedPlayerPackage, ShareSelection } from "../../domain/models/sharing.js";
import { createSharedPackage } from "./create-shared-package.js";

export const MAX_SHARED_PACKAGE_BYTES = 62 * 1024;

export interface PreparedPlayerShare {
  readonly package: SharedPlayerPackage;
  readonly serializedPayload: string;
  readonly payloadBytes: number;
}

export interface PreparePlayerShareInput {
  readonly player: PlayerProfile;
  readonly report: ScoutReport;
  readonly selection: ShareSelection;
  readonly playerPublicKey: string;
  readonly now?: Date;
  readonly expiresAt?: string;
}

export class SharedPackageTooLargeError extends Error {
  public constructor(public readonly payloadBytes: number) {
    super(`Shared player package is ${payloadBytes} bytes and exceeds the allowed limit.`);
    this.name = "SharedPackageTooLargeError";
  }
}

export const preparePlayerShare = (input: PreparePlayerShareInput): PreparedPlayerShare => {
  const playerPackage = createSharedPackage(input);
  const serializedPayload = JSON.stringify(playerPackage);
  const payloadBytes = new TextEncoder().encode(serializedPayload).byteLength;
  if (payloadBytes > MAX_SHARED_PACKAGE_BYTES) {
    throw new SharedPackageTooLargeError(payloadBytes);
  }

  return {
    package: playerPackage,
    serializedPayload,
    payloadBytes
  };
};
