import { PROTOCOL_VERSION } from "../../domain/constants.js";
import { createId } from "../../domain/identity.js";
import type {
  PlayerProfileSharedEvent,
  ProfileReceivedEvent,
  ScoutPassEvent
} from "../../domain/models/events.js";
import type { SharedPlayerPackage } from "../../domain/models/sharing.js";
import { sharedPlayerPackageSchema } from "../../domain/models/sharing.js";
import { encodeScoutPassEvent } from "../../protocol/peer-wire.js";
import type { SharedPackageRepository } from "../ports/repositories.js";
import type { ScoutingConnectionService } from "../connections/scouting-connection-service.js";
import {
  MAX_SHARED_PACKAGE_BYTES,
  type PreparedPlayerShare,
  SharedPackageTooLargeError
} from "./prepare-player-share.js";

export {
  MAX_SHARED_PACKAGE_BYTES,
  preparePlayerShare,
  type PreparedPlayerShare,
  type PreparePlayerShareInput,
  SharedPackageTooLargeError
} from "./prepare-player-share.js";

export interface ProfileSharingServiceOptions {
  readonly connectionService: ScoutingConnectionService;
  readonly receivedPackages: SharedPackageRepository;
  readonly senderPublicKey: string;
  readonly now?: () => Date;
}

export class ShareApprovalRequiredError extends Error {
  public constructor() {
    super("Player approval is required before sharing a profile package.");
    this.name = "ShareApprovalRequiredError";
  }
}

export class ProfileSharingService {
  readonly #connectionService: ScoutingConnectionService;
  readonly #receivedPackages: SharedPackageRepository;
  readonly #senderPublicKey: string;
  readonly #now: () => Date;
  readonly #receivedListeners = new Set<(playerPackage: SharedPlayerPackage) => void>();
  readonly #unsubscribe: () => void;

  public constructor(options: ProfileSharingServiceOptions) {
    this.#connectionService = options.connectionService;
    this.#receivedPackages = options.receivedPackages;
    this.#senderPublicKey = options.senderPublicKey;
    this.#now = options.now ?? (() => new Date());
    this.#unsubscribe = this.#connectionService.onIncomingEvent(async (event, relationshipId) => {
      await this.#handleIncomingEvent(event, relationshipId);
    });
  }

  public async sendPreparedShare(
    relationshipId: string,
    prepared: PreparedPlayerShare,
    playerApproved: boolean
  ): Promise<PlayerProfileSharedEvent> {
    if (!playerApproved) {
      throw new ShareApprovalRequiredError();
    }

    const playerPackage = sharedPlayerPackageSchema.parse(prepared.package);
    const actualSerializedPayload = JSON.stringify(playerPackage);
    const actualPayloadBytes = new TextEncoder().encode(actualSerializedPayload).byteLength;
    if (
      actualSerializedPayload !== prepared.serializedPayload ||
      actualPayloadBytes !== prepared.payloadBytes
    ) {
      throw new Error("The approved share preview no longer matches the package being sent.");
    }
    if (actualPayloadBytes > MAX_SHARED_PACKAGE_BYTES) {
      throw new SharedPackageTooLargeError(actualPayloadBytes);
    }

    const event: PlayerProfileSharedEvent = {
      id: createId("event_profile_shared"),
      type: "player.profile_shared",
      senderPublicKey: this.#senderPublicKey,
      createdAt: this.#now().toISOString(),
      protocolVersion: PROTOCOL_VERSION,
      payload: { package: playerPackage }
    };
    encodeScoutPassEvent(event);
    await this.#connectionService.sendEvent(relationshipId, event);
    return event;
  }

  public onPackageReceived(listener: (playerPackage: SharedPlayerPackage) => void): () => void {
    this.#receivedListeners.add(listener);
    return () => this.#receivedListeners.delete(listener);
  }

  public dispose(): void {
    this.#unsubscribe();
    this.#receivedListeners.clear();
  }

  async #handleIncomingEvent(event: ScoutPassEvent, relationshipId: string): Promise<void> {
    if (event.type !== "player.profile_shared") {
      return;
    }

    const playerPackage = sharedPlayerPackageSchema.parse(event.payload.package);
    const existingPackage = await this.#receivedPackages.get(playerPackage.packageId);
    if (existingPackage === undefined) {
      await this.#receivedPackages.save(playerPackage);
      for (const listener of this.#receivedListeners) {
        listener(structuredClone(playerPackage));
      }
    }

    const events = await this.#connectionService.listEvents(relationshipId);
    const alreadyAcknowledged = events.some(
      (storedEvent) =>
        storedEvent.type === "profile.received" &&
        storedEvent.payload.packageId === playerPackage.packageId
    );
    if (alreadyAcknowledged) {
      return;
    }

    const receipt: ProfileReceivedEvent = {
      id: createId("event_profile_received"),
      type: "profile.received",
      senderPublicKey: this.#senderPublicKey,
      createdAt: this.#now().toISOString(),
      protocolVersion: PROTOCOL_VERSION,
      payload: {
        packageId: playerPackage.packageId,
        receivedAt: this.#now().toISOString()
      }
    };
    await this.#connectionService.sendEvent(relationshipId, receipt);
  }
}
