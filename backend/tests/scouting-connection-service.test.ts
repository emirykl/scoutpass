import { describe, expect, it } from "vitest";

import { ScoutingConnectionService } from "../src/application/connections/scouting-connection-service.js";
import type {
  PeerConnection,
  PeerConnectionStatus,
  PeerTransport
} from "../src/application/ports/integrations.js";
import type { RelationshipEventLogRepository } from "../src/application/ports/repositories.js";
import type { ScoutPassEvent } from "../src/domain/models/events.js";
import { NOW, PUBLIC_KEY } from "./fixtures.js";

class InMemoryEventLog implements RelationshipEventLogRepository {
  readonly events = new Map<string, ScoutPassEvent[]>();
  readonly seen = new Set<string>();

  public append(relationshipId: string, event: ScoutPassEvent): Promise<boolean> {
    if (this.seen.has(event.id)) {
      return Promise.resolve(false);
    }
    this.seen.add(event.id);
    this.events.set(relationshipId, [...(this.events.get(relationshipId) ?? []), event]);
    return Promise.resolve(true);
  }

  public list(relationshipId: string): Promise<readonly ScoutPassEvent[]> {
    return Promise.resolve(this.events.get(relationshipId) ?? []);
  }
}

class LinkedConnection implements PeerConnection {
  public constructor(
    public readonly relationshipId: string,
    private readonly deliver: (event: ScoutPassEvent) => void
  ) {}

  public send(event: ScoutPassEvent): Promise<void> {
    this.deliver(event);
    return Promise.resolve();
  }

  public close(): Promise<void> {
    return Promise.resolve();
  }
}

class LinkedTransport implements PeerTransport {
  #eventListener: ((event: ScoutPassEvent) => Promise<void>) | undefined;
  #connectionListener: ((connection: PeerConnection) => void) | undefined;
  #statusListener: ((status: PeerConnectionStatus) => void) | undefined;
  public peer: LinkedTransport | undefined;
  public connection: LinkedConnection | undefined;

  public createInvite(relationshipId: string): Promise<string> {
    this.#statusListener?.("invite_ready");
    return Promise.resolve(`scoutpass:test:${relationshipId}`);
  }

  public connect(invite: string): Promise<PeerConnection> {
    const relationshipId = invite.split(":").at(-1) ?? "relationship_demo_001";
    this.connection = new LinkedConnection(relationshipId, (event) => {
      void this.peer?.emit(event);
    });
    this.peer?.acceptConnection(relationshipId, this);
    this.#connectionListener?.(this.connection);
    this.#statusListener?.("connected");
    return Promise.resolve(this.connection);
  }

  public onConnection(listener: (connection: PeerConnection) => void): () => void {
    this.#connectionListener = listener;
    return () => {
      this.#connectionListener = undefined;
    };
  }

  public onEvent(listener: (event: ScoutPassEvent) => Promise<void>): () => void {
    this.#eventListener = listener;
    return () => {
      this.#eventListener = undefined;
    };
  }

  public onStatus(listener: (status: PeerConnectionStatus) => void): () => void {
    this.#statusListener = listener;
    return () => {
      this.#statusListener = undefined;
    };
  }

  public dispose(): Promise<void> {
    return Promise.resolve();
  }

  public emit(event: ScoutPassEvent): Promise<void> {
    return this.#eventListener?.(event) ?? Promise.resolve();
  }

  private acceptConnection(relationshipId: string, peer: LinkedTransport): void {
    this.connection = new LinkedConnection(relationshipId, (event) => {
      void peer.emit(event);
    });
    this.#connectionListener?.(this.connection);
    this.#statusListener?.("connected");
  }
}

describe("scouting connection service", () => {
  it("sends validated test events both ways and stores deduplicated history", async () => {
    const scoutTransport = new LinkedTransport();
    const playerTransport = new LinkedTransport();
    scoutTransport.peer = playerTransport;
    playerTransport.peer = scoutTransport;

    const scoutLog = new InMemoryEventLog();
    const playerLog = new InMemoryEventLog();
    const scout = new ScoutingConnectionService({
      transport: scoutTransport,
      eventLog: scoutLog,
      senderPublicKey: PUBLIC_KEY,
      now: () => NOW
    });
    const player = new ScoutingConnectionService({
      transport: playerTransport,
      eventLog: playerLog,
      senderPublicKey: "b".repeat(64),
      now: () => NOW
    });

    const invite = await scout.createInvite("relationship_demo_001");
    await player.connect(invite);
    const playerEvent = await player.sendTestEvent("relationship_demo_001");
    const scoutEvent = await scout.sendTestEvent("relationship_demo_001");

    await expect(player.handleIncomingEvent(scoutEvent)).resolves.toBe(false);
    await expect(scoutLog.list("relationship_demo_001")).resolves.toEqual([
      playerEvent,
      scoutEvent
    ]);
    await expect(playerLog.list("relationship_demo_001")).resolves.toEqual([
      playerEvent,
      scoutEvent
    ]);
  });
});
