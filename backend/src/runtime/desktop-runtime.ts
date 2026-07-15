import { createHash, randomUUID } from "node:crypto";

import type { AppRole } from "../domain/models/common.js";
import type { RuntimeCommand, RuntimeEvent } from "../contracts/runtime-messages.js";
import { createJsonRepositories } from "../infrastructure/storage/json-repositories.js";
import { JsonFileStore } from "../infrastructure/storage/json-file-store.js";
import { resolveInstanceDataFile } from "../infrastructure/storage/instance-storage-path.js";
import { HyperswarmPeerTransport } from "../infrastructure/pears/hyperswarm-peer-transport.js";
import { QvacLocalReportGenerator } from "../infrastructure/qvac/qvac-local-report-generator.js";
import { MacOsKeychainSecretStore } from "../infrastructure/wdk/macos-keychain-secret-store.js";
import { WdkEvmWalletGateway } from "../infrastructure/wdk/wdk-evm-wallet-gateway.js";
import { ScoutingConnectionService } from "../application/connections/scouting-connection-service.js";
import { ProfileSharingService } from "../application/share/profile-sharing-service.js";
import { TryoutInvitationService } from "../application/invitations/tryout-invitation-service.js";
import { SelfCustodialWalletService } from "../application/wallet/self-custodial-wallet-service.js";
import { WalletAddressSharingService } from "../application/wallet/wallet-address-sharing-service.js";
import { TravelSupportPaymentService } from "../application/wallet/travel-support-payment-service.js";
import { LocalDataMaintenanceService } from "../application/settings/local-data-maintenance-service.js";
import { createRelationshipTopic, parseInviteCode } from "../protocol/peer-wire.js";
import { PhaseSevenEightCommandHandler } from "./phase-seven-eight-command-handler.js";
import { LocalRuntimeCommandHandler } from "./local-runtime-command-handler.js";

const DEFAULT_SEPOLIA_RPC_URL = "https://sepolia.drpc.org";

export interface DesktopRuntimeOptions {
  readonly dataDir: string;
  readonly role: AppRole;
  readonly now?: () => Date;
}

export interface DesktopRuntime {
  handle(command: RuntimeCommand): Promise<RuntimeEvent>;
  onEvent(listener: (event: RuntimeEvent) => void): () => void;
  dispose(): Promise<void>;
}

export const createDesktopRuntime = (options: DesktopRuntimeOptions): DesktopRuntime => {
  const now = options.now ?? (() => new Date());
  const store = new JsonFileStore(resolveInstanceDataFile(options.dataDir, options.role));
  const repositories = createJsonRepositories(store);
  const transport = new HyperswarmPeerTransport();
  const senderPublicKey = createHash("sha256")
    .update(`scoutpass:${options.role}:${options.dataDir}`)
    .digest("hex");
  const connectionService = new ScoutingConnectionService({
    transport,
    eventLog: repositories.relationshipEvents,
    senderPublicKey,
    now
  });
  const sharing = new ProfileSharingService({
    connectionService,
    receivedPackages: repositories.receivedPackages,
    senderPublicKey,
    now
  });
  const invitations = new TryoutInvitationService({
    connectionService,
    invitations: repositories.invitations,
    senderPublicKey,
    now
  });
  const gateway = new WdkEvmWalletGateway({
    secretStore: new MacOsKeychainSecretStore(),
    rpcUrl: process.env.SCOUTPASS_SEPOLIA_RPC_URL ?? DEFAULT_SEPOLIA_RPC_URL,
    now
  });
  const wallet = new SelfCustodialWalletService({
    gateway,
    wallets: repositories.wallets,
    now
  });
  const walletSharing = new WalletAddressSharingService({
    connectionService,
    wallets: repositories.wallets,
    senderPublicKey,
    now
  });
  const payments = new TravelSupportPaymentService({
    gateway,
    connectionService,
    invitations: repositories.invitations,
    payments: repositories.payments,
    relationshipEvents: repositories.relationshipEvents,
    senderPublicKey,
    now
  });
  const reportGenerator = new QvacLocalReportGenerator({ now });
  const maintenance = new LocalDataMaintenanceService(store);
  const phaseSevenEight = new PhaseSevenEightCommandHandler({
    payments,
    maintenance,
    repositories,
    now
  });

  let activeRelationshipId: string | undefined;
  const ensureRelationship = async (requestedId: string, inviteCode?: string): Promise<void> => {
    const invite = inviteCode === undefined ? undefined : parseInviteCode(inviteCode);
    const relationshipId = invite?.relationshipId ?? requestedId;
    activeRelationshipId = relationshipId;
    const existing = await repositories.relationships.get(relationshipId);
    const timestamp = now().toISOString();
    await repositories.relationships.save({
      id: relationshipId,
      localRole: options.role,
      localPublicKey: senderPublicKey,
      ...(existing?.remotePublicKey === undefined
        ? {}
        : { remotePublicKey: existing.remotePublicKey }),
      topicId:
        invite?.topicHex ??
        existing?.topicId ??
        createRelationshipTopic(relationshipId).toString("hex"),
      status: "connecting",
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    });
  };

  const handler = new LocalRuntimeCommandHandler({
    repositories,
    reportGenerator,
    connection: {
      service: connectionService,
      getStatus: () => transport.getStatus(),
      ensureRelationship
    },
    sharing,
    invitations,
    wallet,
    walletSharing,
    phaseSevenEight,
    now
  });

  const listeners = new Set<(event: RuntimeEvent) => void>();
  const emit = (event: RuntimeEvent): void => {
    for (const listener of listeners) listener(structuredClone(event));
  };
  const event = <T extends RuntimeEvent["type"]>(
    type: T,
    payload: Extract<RuntimeEvent, { type: T }>["payload"]
  ): Extract<RuntimeEvent, { type: T }> =>
    ({
      requestId: `request_background_${randomUUID()}`,
      occurredAt: now().toISOString(),
      type,
      payload
    }) as Extract<RuntimeEvent, { type: T }>;

  const unsubscribers = [
    transport.onStatus((status) => {
      emit(event("connection.status", { status }));
      if (activeRelationshipId === undefined) return;
      void repositories.relationships.get(activeRelationshipId).then(async (relationship) => {
        if (relationship === undefined) return;
        const relationshipStatus =
          status === "connected"
            ? "connected"
            : status === "disconnected" || status === "reconnecting"
              ? "disconnected"
              : "connecting";
        await repositories.relationships.save({
          ...relationship,
          status: relationshipStatus,
          updatedAt: now().toISOString()
        });
      });
    }),
    sharing.onPackageReceived((playerPackage) => {
      emit(event("share.received", { package: playerPackage }));
    }),
    invitations.onInvitationChanged((invitation) => {
      emit(event("invitation.updated", { invitation }));
    }),
    payments.onPaymentChanged((payment) => {
      emit(event("payment.updated", { payment }));
    }),
    walletSharing.onAddressReceived((receivedWallet) => {
      emit(event("wallet.address.received", { wallet: receivedWallet }));
    })
  ];

  return {
    handle: (command) => handler.handle(command),
    onEvent: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: async () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
      listeners.clear();
      sharing.dispose();
      invitations.dispose();
      walletSharing.dispose();
      payments.dispose();
      await Promise.all([reportGenerator.dispose(), transport.dispose(), wallet.dispose()]);
    }
  };
};
