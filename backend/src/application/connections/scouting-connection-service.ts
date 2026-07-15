import { randomUUID } from "node:crypto";

import { PROTOCOL_VERSION } from "../../domain/constants.js";
import type { ProfileReceivedEvent, ScoutPassEvent } from "../../domain/models/events.js";
import { assertEventIsFresh } from "../../domain/services/event-freshness.js";
import type { PeerConnection, PeerTransport } from "../ports/integrations.js";
import type { RelationshipEventLogRepository } from "../ports/repositories.js";

export interface ScoutingConnectionServiceOptions {
  readonly transport: PeerTransport;
  readonly eventLog: RelationshipEventLogRepository;
  readonly senderPublicKey: string;
  readonly now?: () => Date;
}

export class ScoutingConnectionService {
  readonly #transport: PeerTransport;
  readonly #eventLog: RelationshipEventLogRepository;
  readonly #senderPublicKey: string;
  readonly #now: () => Date;
  #connection: PeerConnection | undefined;
  readonly #incomingEventListeners = new Set<
    (event: ScoutPassEvent, relationshipId: string) => Promise<void>
  >();

  public constructor(options: ScoutingConnectionServiceOptions) {
    this.#transport = options.transport;
    this.#eventLog = options.eventLog;
    this.#senderPublicKey = options.senderPublicKey;
    this.#now = options.now ?? (() => new Date());

    this.#transport.onEvent(async (event) => {
      await this.handleIncomingEvent(event);
    });
    this.#transport.onConnection?.((connection) => {
      this.#connection = connection;
    });
  }

  public async createInvite(relationshipId: string): Promise<string> {
    return this.#transport.createInvite(relationshipId);
  }

  public async connect(inviteCode: string): Promise<PeerConnection> {
    this.#connection = await this.#transport.connect(inviteCode);
    return this.#connection;
  }

  public async sendTestEvent(relationshipId: string): Promise<ProfileReceivedEvent> {
    const event: ProfileReceivedEvent = {
      id: `event_test_${randomUUID()}`,
      type: "profile.received",
      senderPublicKey: this.#senderPublicKey,
      createdAt: this.#now().toISOString(),
      protocolVersion: PROTOCOL_VERSION,
      payload: {
        packageId: "package_test_connection",
        receivedAt: this.#now().toISOString()
      }
    };

    await this.sendEvent(relationshipId, event);
    return event;
  }

  public async sendEvent(relationshipId: string, event: ScoutPassEvent): Promise<void> {
    if (this.#connection === undefined) {
      throw new Error("Cannot send an event before the Pears connection is established.");
    }
    if (this.#connection.relationshipId !== relationshipId) {
      throw new Error("The active Pears connection belongs to a different relationship.");
    }

    await this.#connection.send(event);
    await this.#eventLog.append(relationshipId, event);
  }

  public onIncomingEvent(
    listener: (event: ScoutPassEvent, relationshipId: string) => Promise<void>
  ): () => void {
    this.#incomingEventListeners.add(listener);
    return () => this.#incomingEventListeners.delete(listener);
  }

  public listEvents(relationshipId: string): Promise<readonly ScoutPassEvent[]> {
    return this.#eventLog.list(relationshipId);
  }

  public async handleIncomingEvent(event: ScoutPassEvent): Promise<boolean> {
    assertEventIsFresh(event, { now: this.#now() });
    const relationshipId = inferRelationshipId(event, this.#connection?.relationshipId);
    const appended = await this.#eventLog.append(relationshipId, event);
    if (appended) {
      for (const listener of this.#incomingEventListeners) {
        await listener(event, relationshipId);
      }
    }
    return appended;
  }
}

const inferRelationshipId = (event: ScoutPassEvent, fallbackRelationshipId?: string): string => {
  switch (event.type) {
    case "player.profile_shared":
      return fallbackRelationshipId ?? "relationship_from_profile_share";
    case "profile.received":
      return fallbackRelationshipId ?? "relationship_from_profile_received";
    case "tryout.invitation":
      return event.payload.invitation.relationshipId;
    case "invitation.response":
      return fallbackRelationshipId ?? "relationship_from_invitation_response";
    case "wallet.address_shared":
      return fallbackRelationshipId ?? "relationship_from_wallet_address";
    case "travel_support.proposed":
      return event.payload.proposal.relationshipId;
    case "travel_support.sent":
      return event.payload.payment.relationshipId;
  }
};
