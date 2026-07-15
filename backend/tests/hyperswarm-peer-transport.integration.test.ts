import { createRequire } from "node:module";

import { afterEach, describe, expect, it } from "vitest";

import { ScoutingConnectionService } from "../src/application/connections/scouting-connection-service.js";
import { TryoutInvitationService } from "../src/application/invitations/tryout-invitation-service.js";
import {
  preparePlayerShare,
  ProfileSharingService
} from "../src/application/share/profile-sharing-service.js";
import { WalletAddressSharingService } from "../src/application/wallet/wallet-address-sharing-service.js";
import type { PeerConnectionStatus } from "../src/application/ports/integrations.js";
import type {
  RelationshipEventLogRepository,
  Repository
} from "../src/application/ports/repositories.js";
import type { ScoutPassEvent } from "../src/domain/models/events.js";
import type { TryoutInvitation } from "../src/domain/models/invitation.js";
import type { SharedPlayerPackage } from "../src/domain/models/sharing.js";
import { DEFAULT_SHARE_SELECTION } from "../src/domain/models/sharing.js";
import type { WalletPublicMetadata } from "../src/domain/models/wallet.js";
import { HyperswarmPeerTransport } from "../src/infrastructure/pears/hyperswarm-peer-transport.js";
import { createInvitation, createPlayer, createReport, PUBLIC_KEY } from "./fixtures.js";

interface DhtLike {
  destroy(): Promise<void>;
}

interface TestnetLike {
  createNode(): DhtLike;
  destroy(): Promise<void>;
}

type CreateTestnet = (size?: number) => Promise<TestnetLike>;

class InMemoryEventLog implements RelationshipEventLogRepository {
  readonly #events = new Map<string, ScoutPassEvent[]>();
  readonly #seen = new Set<string>();

  public append(relationshipId: string, event: ScoutPassEvent): Promise<boolean> {
    if (this.#seen.has(event.id)) {
      return Promise.resolve(false);
    }
    this.#seen.add(event.id);
    this.#events.set(relationshipId, [...(this.#events.get(relationshipId) ?? []), event]);
    return Promise.resolve(true);
  }

  public list(relationshipId: string): Promise<readonly ScoutPassEvent[]> {
    return Promise.resolve(structuredClone(this.#events.get(relationshipId) ?? []));
  }
}

class InMemoryPackageRepository implements Repository<SharedPlayerPackage> {
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

class InMemoryInvitationRepository implements Repository<TryoutInvitation> {
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

class InMemoryWalletRepository implements Repository<WalletPublicMetadata> {
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

const transports: HyperswarmPeerTransport[] = [];
let testnet: TestnetLike | undefined;

afterEach(async () => {
  await Promise.all(transports.splice(0).map(async (transport) => transport.dispose()));
  await testnet?.destroy();
  testnet = undefined;
});

describe("real Hyperswarm player-scout flow", () => {
  it.runIf(process.env.SCOUTPASS_P2P_SMOKE === "1")(
    "connects, reconnects, and transfers profile, invitation, response, and wallet events",
    async () => {
      const require = createRequire(import.meta.url);
      const createTestnet = require("hyperdht/testnet") as CreateTestnet;
      testnet = await createTestnet(3);

      const scoutTransport = new HyperswarmPeerTransport({
        dht: testnet.createNode(),
        connectionTimeoutMs: 15_000
      });
      const playerTransport = new HyperswarmPeerTransport({
        dht: testnet.createNode(),
        connectionTimeoutMs: 15_000
      });
      transports.push(scoutTransport, playerTransport);

      const scoutStatuses: PeerConnectionStatus[] = [];
      const playerStatuses: PeerConnectionStatus[] = [];
      let scoutConnectionCount = 0;
      let playerConnectionCount = 0;
      scoutTransport.onStatus((status) => scoutStatuses.push(status));
      playerTransport.onStatus((status) => playerStatuses.push(status));
      scoutTransport.onConnection(() => scoutConnectionCount++);
      playerTransport.onConnection(() => playerConnectionCount++);

      const relationshipId = "relationship_real_hyperswarm_001";
      const scoutLog = new InMemoryEventLog();
      const playerLog = new InMemoryEventLog();
      const scoutConnection = new ScoutingConnectionService({
        transport: scoutTransport,
        eventLog: scoutLog,
        senderPublicKey: "b".repeat(64)
      });
      const playerConnection = new ScoutingConnectionService({
        transport: playerTransport,
        eventLog: playerLog,
        senderPublicKey: PUBLIC_KEY
      });

      const invite = await scoutConnection.createInvite(relationshipId);
      const activePlayerConnection = await playerConnection.connect(invite);
      await waitFor(() => scoutConnectionCount === 1 && playerConnectionCount === 1);

      const playerTestEvent = await playerConnection.sendTestEvent(relationshipId);
      const scoutTestEvent = await scoutConnection.sendTestEvent(relationshipId);
      await waitFor(async () => (await scoutLog.list(relationshipId)).length === 2);
      await waitFor(async () => (await playerLog.list(relationshipId)).length === 2);
      expect((await scoutLog.list(relationshipId)).map((event) => event.id).sort()).toEqual(
        [playerTestEvent.id, scoutTestEvent.id].sort()
      );
      expect((await playerLog.list(relationshipId)).map((event) => event.id).sort()).toEqual(
        [playerTestEvent.id, scoutTestEvent.id].sort()
      );

      await activePlayerConnection.close();
      await waitFor(
        () => scoutStatuses.includes("reconnecting") && playerStatuses.includes("reconnecting")
      );
      await waitFor(() => scoutConnectionCount >= 2 && playerConnectionCount >= 2, 15_000);
      expect(scoutTransport.getStatus()).toBe("connected");
      expect(playerTransport.getStatus()).toBe("connected");

      const scoutPackages = new InMemoryPackageRepository();
      const playerPackages = new InMemoryPackageRepository();
      const scoutSharing = new ProfileSharingService({
        connectionService: scoutConnection,
        receivedPackages: scoutPackages,
        senderPublicKey: "b".repeat(64)
      });
      const playerSharing = new ProfileSharingService({
        connectionService: playerConnection,
        receivedPackages: playerPackages,
        senderPublicKey: PUBLIC_KEY
      });

      const prepared = preparePlayerShare({
        player: createPlayer({ contact: { email: "private@example.test" } }),
        report: createReport(),
        selection: DEFAULT_SHARE_SELECTION,
        playerPublicKey: PUBLIC_KEY
      });
      await expect(
        playerSharing.sendPreparedShare(relationshipId, prepared, false)
      ).rejects.toThrow("approval is required");

      await playerSharing.sendPreparedShare(relationshipId, prepared, true);
      await waitFor(async () => (await scoutPackages.list()).length === 1);
      await waitFor(async () => {
        const events = await playerLog.list(relationshipId);
        return events.some(
          (event) =>
            event.type === "profile.received" &&
            event.payload.packageId === prepared.package.packageId
        );
      });

      expect(await scoutPackages.get(prepared.package.packageId)).toEqual(prepared.package);
      expect(prepared.serializedPayload).not.toContain("private@example.test");
      expect(prepared.serializedPayload).not.toContain("coachFeedback");

      await playerSharing.sendPreparedShare(relationshipId, prepared, true);
      await waitFor(async () => {
        const events = await scoutLog.list(relationshipId);
        return events.filter((event) => event.type === "player.profile_shared").length === 2;
      });
      expect(await scoutPackages.list()).toHaveLength(1);
      expect(
        (await scoutLog.list(relationshipId)).filter(
          (event) =>
            event.type === "profile.received" &&
            event.payload.packageId === prepared.package.packageId
        )
      ).toHaveLength(1);

      const scoutInvitations = new InMemoryInvitationRepository();
      const playerInvitations = new InMemoryInvitationRepository();
      const scoutInvitationService = new TryoutInvitationService({
        connectionService: scoutConnection,
        invitations: scoutInvitations,
        senderPublicKey: "b".repeat(64)
      });
      const playerInvitationService = new TryoutInvitationService({
        connectionService: playerConnection,
        invitations: playerInvitations,
        senderPublicKey: PUBLIC_KEY
      });
      const now = Date.now();
      const draft = createInvitation({
        id: "invitation_real_hyperswarm_001",
        relationshipId,
        startsAt: new Date(now + 7 * 86_400_000).toISOString(),
        endsAt: new Date(now + 7 * 86_400_000 + 7_200_000).toISOString(),
        expiresAt: new Date(now + 3 * 86_400_000).toISOString(),
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString()
      });
      await scoutInvitationService.sendDraft(draft);
      await waitFor(async () => (await playerInvitations.get(draft.id))?.status === "received");
      await playerInvitationService.respond(draft.id, "accepted");
      await waitFor(async () => (await scoutInvitations.get(draft.id))?.status === "accepted");
      expect((await playerInvitations.get(draft.id))?.status).toBe("accepted");

      const scoutWallets = new InMemoryWalletRepository();
      const playerWallets = new InMemoryWalletRepository();
      const scoutWalletSharing = new WalletAddressSharingService({
        connectionService: scoutConnection,
        wallets: scoutWallets,
        senderPublicKey: "b".repeat(64)
      });
      const playerWalletSharing = new WalletAddressSharingService({
        connectionService: playerConnection,
        wallets: playerWallets,
        senderPublicKey: PUBLIC_KEY
      });
      const publicWallet: WalletPublicMetadata = {
        id: "wallet_player_hyperswarm_001",
        ownerRole: "player",
        network: "Ethereum Sepolia",
        chainId: 11155111,
        address: `0x${"1".repeat(40)}`,
        testnetOnly: true,
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString()
      };
      await playerWalletSharing.shareAddress(relationshipId, publicWallet, true);
      await waitFor(async () => (await scoutWallets.get(publicWallet.id)) !== undefined);
      expect(await scoutWallets.get(publicWallet.id)).toEqual(publicWallet);

      playerSharing.dispose();
      scoutSharing.dispose();
      playerInvitationService.dispose();
      scoutInvitationService.dispose();
      playerWalletSharing.dispose();
      scoutWalletSharing.dispose();
    },
    45_000
  );
});

const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 5_000
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Condition was not met within ${timeoutMs}ms.`);
};
