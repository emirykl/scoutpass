import { describe, expect, it } from "vitest";

import { ScoutingConnectionService } from "../src/application/connections/scouting-connection-service.js";
import { TryoutInvitationService } from "../src/application/invitations/tryout-invitation-service.js";
import { WalletAddressSharingService } from "../src/application/wallet/wallet-address-sharing-service.js";
import {
  preparePlayerShare,
  ProfileSharingService
} from "../src/application/share/profile-sharing-service.js";
import type {
  PeerConnection,
  PeerConnectionStatus,
  PeerTransport
} from "../src/application/ports/integrations.js";
import type {
  RelationshipEventLogRepository,
  InvitationRepository,
  SharedPackageRepository,
  WalletMetadataRepository
} from "../src/application/ports/repositories.js";
import type { ScoutPassEvent } from "../src/domain/models/events.js";
import type { TryoutInvitation } from "../src/domain/models/invitation.js";
import type { SharedPlayerPackage } from "../src/domain/models/sharing.js";
import { DEFAULT_SHARE_SELECTION } from "../src/domain/models/sharing.js";
import type { WalletPublicMetadata } from "../src/domain/models/wallet.js";
import { createInvitation, createPlayer, createReport, NOW, PUBLIC_KEY } from "./fixtures.js";

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
    private readonly deliver: (event: ScoutPassEvent) => Promise<void>
  ) {}

  public send(event: ScoutPassEvent): Promise<void> {
    return this.deliver(event);
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
    this.connection = new LinkedConnection(
      relationshipId,
      (event) => this.peer?.emit(event) ?? Promise.resolve()
    );
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
    this.connection = new LinkedConnection(relationshipId, (event) => peer.emit(event));
    this.#connectionListener?.(this.connection);
    this.#statusListener?.("connected");
  }
}

class InMemoryPackageRepository implements SharedPackageRepository {
  readonly #packages = new Map<string, SharedPlayerPackage>();

  public get(id: string): Promise<SharedPlayerPackage | undefined> {
    const value = this.#packages.get(id);
    return Promise.resolve(value === undefined ? undefined : structuredClone(value));
  }

  public list(): Promise<readonly SharedPlayerPackage[]> {
    return Promise.resolve([...this.#packages.values()].map((value) => structuredClone(value)));
  }

  public save(entity: SharedPlayerPackage): Promise<void> {
    this.#packages.set(entity.packageId, structuredClone(entity));
    return Promise.resolve();
  }

  public delete(id: string): Promise<boolean> {
    return Promise.resolve(this.#packages.delete(id));
  }
}

class InMemoryInvitationRepository implements InvitationRepository {
  readonly #invitations = new Map<string, TryoutInvitation>();

  public get(id: string): Promise<TryoutInvitation | undefined> {
    const value = this.#invitations.get(id);
    return Promise.resolve(value === undefined ? undefined : structuredClone(value));
  }

  public list(): Promise<readonly TryoutInvitation[]> {
    return Promise.resolve([...this.#invitations.values()].map((value) => structuredClone(value)));
  }

  public save(entity: TryoutInvitation): Promise<void> {
    this.#invitations.set(entity.id, structuredClone(entity));
    return Promise.resolve();
  }

  public delete(id: string): Promise<boolean> {
    return Promise.resolve(this.#invitations.delete(id));
  }
}

class InMemoryWalletRepository implements WalletMetadataRepository {
  readonly #wallets = new Map<string, WalletPublicMetadata>();

  public get(id: string): Promise<WalletPublicMetadata | undefined> {
    const value = this.#wallets.get(id);
    return Promise.resolve(value === undefined ? undefined : structuredClone(value));
  }

  public list(): Promise<readonly WalletPublicMetadata[]> {
    return Promise.resolve([...this.#wallets.values()].map((value) => structuredClone(value)));
  }

  public save(entity: WalletPublicMetadata): Promise<void> {
    this.#wallets.set(entity.id, structuredClone(entity));
    return Promise.resolve();
  }

  public delete(id: string): Promise<boolean> {
    return Promise.resolve(this.#wallets.delete(id));
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

  it("requires approval, stores only one package, and acknowledges it once", async () => {
    const scoutTransport = new LinkedTransport();
    const playerTransport = new LinkedTransport();
    scoutTransport.peer = playerTransport;
    playerTransport.peer = scoutTransport;
    const scoutLog = new InMemoryEventLog();
    const playerLog = new InMemoryEventLog();
    const scoutConnection = new ScoutingConnectionService({
      transport: scoutTransport,
      eventLog: scoutLog,
      senderPublicKey: "b".repeat(64),
      now: () => NOW
    });
    const playerConnection = new ScoutingConnectionService({
      transport: playerTransport,
      eventLog: playerLog,
      senderPublicKey: PUBLIC_KEY,
      now: () => NOW
    });
    const scoutPackages = new InMemoryPackageRepository();
    const playerPackages = new InMemoryPackageRepository();
    const scoutSharing = new ProfileSharingService({
      connectionService: scoutConnection,
      receivedPackages: scoutPackages,
      senderPublicKey: "b".repeat(64),
      now: () => NOW
    });
    const playerSharing = new ProfileSharingService({
      connectionService: playerConnection,
      receivedPackages: playerPackages,
      senderPublicKey: PUBLIC_KEY,
      now: () => NOW
    });

    const invite = await scoutConnection.createInvite("relationship_demo_001");
    await playerConnection.connect(invite);
    const prepared = preparePlayerShare({
      player: createPlayer({ contact: { email: "private@example.test" } }),
      report: createReport(),
      selection: DEFAULT_SHARE_SELECTION,
      playerPublicKey: PUBLIC_KEY,
      now: NOW
    });

    await expect(
      playerSharing.sendPreparedShare("relationship_demo_001", prepared, false)
    ).rejects.toThrow("approval is required");
    await playerSharing.sendPreparedShare("relationship_demo_001", prepared, true);
    await playerSharing.sendPreparedShare("relationship_demo_001", prepared, true);

    expect(await scoutPackages.list()).toEqual([prepared.package]);
    expect(JSON.stringify((await scoutPackages.list())[0])).not.toContain("private@example.test");
    expect(
      (await scoutLog.list("relationship_demo_001")).filter(
        (event) =>
          event.type === "profile.received" &&
          event.payload.packageId === prepared.package.packageId
      )
    ).toHaveLength(1);

    scoutSharing.dispose();
    playerSharing.dispose();
  });

  it("delivers a tryout invitation and returns the accepted response over P2P", async () => {
    const scoutTransport = new LinkedTransport();
    const playerTransport = new LinkedTransport();
    scoutTransport.peer = playerTransport;
    playerTransport.peer = scoutTransport;
    const scoutLog = new InMemoryEventLog();
    const playerLog = new InMemoryEventLog();
    const scoutConnection = new ScoutingConnectionService({
      transport: scoutTransport,
      eventLog: scoutLog,
      senderPublicKey: "b".repeat(64),
      now: () => NOW
    });
    const playerConnection = new ScoutingConnectionService({
      transport: playerTransport,
      eventLog: playerLog,
      senderPublicKey: PUBLIC_KEY,
      now: () => NOW
    });
    const scoutInvitations = new InMemoryInvitationRepository();
    const playerInvitations = new InMemoryInvitationRepository();
    const scoutService = new TryoutInvitationService({
      connectionService: scoutConnection,
      invitations: scoutInvitations,
      senderPublicKey: "b".repeat(64),
      now: () => NOW
    });
    const playerService = new TryoutInvitationService({
      connectionService: playerConnection,
      invitations: playerInvitations,
      senderPublicKey: PUBLIC_KEY,
      now: () => NOW
    });

    const invite = await scoutConnection.createInvite("relationship_demo_001");
    await playerConnection.connect(invite);
    const draft = createInvitation();
    await scoutService.saveDraft(draft);
    await scoutService.sendDraft(draft);
    expect(await playerInvitations.get(draft.id)).toMatchObject({ status: "received" });

    await playerService.respond(draft.id, "accepted");
    const scoutInvitation = await scoutInvitations.get(draft.id);
    const playerInvitation = await playerInvitations.get(draft.id);
    expect(scoutInvitation).toMatchObject({ status: "accepted" });
    expect(playerInvitation).toMatchObject({ status: "accepted" });
    expect(scoutInvitation && scoutService.canStartTravelSupport(scoutInvitation)).toBe(true);
    expect(JSON.stringify(await scoutLog.list(draft.relationshipId))).not.toContain(
      "private scout assessment"
    );
    expect((await scoutLog.list(draft.relationshipId)).map((event) => event.type)).toEqual([
      "tryout.invitation",
      "invitation.response"
    ]);

    scoutService.dispose();
    playerService.dispose();
  });

  it("shares only approved public player wallet metadata", async () => {
    const scoutTransport = new LinkedTransport();
    const playerTransport = new LinkedTransport();
    scoutTransport.peer = playerTransport;
    playerTransport.peer = scoutTransport;
    const scoutConnection = new ScoutingConnectionService({
      transport: scoutTransport,
      eventLog: new InMemoryEventLog(),
      senderPublicKey: "b".repeat(64),
      now: () => NOW
    });
    const playerConnection = new ScoutingConnectionService({
      transport: playerTransport,
      eventLog: new InMemoryEventLog(),
      senderPublicKey: PUBLIC_KEY,
      now: () => NOW
    });
    const scoutWallets = new InMemoryWalletRepository();
    const playerWallets = new InMemoryWalletRepository();
    const scoutSharing = new WalletAddressSharingService({
      connectionService: scoutConnection,
      wallets: scoutWallets,
      senderPublicKey: "b".repeat(64),
      now: () => NOW
    });
    const playerSharing = new WalletAddressSharingService({
      connectionService: playerConnection,
      wallets: playerWallets,
      senderPublicKey: PUBLIC_KEY,
      now: () => NOW
    });
    const wallet: WalletPublicMetadata = {
      id: "wallet_player_ethereum_sepolia",
      ownerRole: "player",
      network: "Ethereum Sepolia",
      chainId: 11155111,
      address: `0x${"1".repeat(40)}`,
      testnetOnly: true,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString()
    };

    const invite = await scoutConnection.createInvite("relationship_demo_001");
    await playerConnection.connect(invite);
    await expect(
      playerSharing.shareAddress("relationship_demo_001", wallet, false)
    ).rejects.toThrow("approval is required");
    await playerSharing.shareAddress("relationship_demo_001", wallet, true);

    expect(await scoutWallets.get(wallet.id)).toEqual(wallet);
    expect(JSON.stringify(await scoutWallets.list())).not.toContain("seed");

    scoutSharing.dispose();
    playerSharing.dispose();
  });
});
