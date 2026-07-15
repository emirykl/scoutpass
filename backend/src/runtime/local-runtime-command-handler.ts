import { createId } from "../domain/identity.js";
import { REPORT_DISCLAIMER } from "../domain/constants.js";
import type {
  LocalReportGenerator,
  PeerConnectionStatus
} from "../application/ports/integrations.js";
import type { ScoutPassRepositories } from "../application/ports/repositories.js";
import type { ScoutingConnectionService } from "../application/connections/scouting-connection-service.js";
import type { ProfileSharingService } from "../application/share/profile-sharing-service.js";
import { preparePlayerShare } from "../application/share/prepare-player-share.js";
import type { TryoutInvitationService } from "../application/invitations/tryout-invitation-service.js";
import type { SelfCustodialWalletService } from "../application/wallet/self-custodial-wallet-service.js";
import type { WalletAddressSharingService } from "../application/wallet/wallet-address-sharing-service.js";
import { mapErrorToUserFacingFailure } from "../application/errors/user-facing-error.js";
import type { RuntimeCommand, RuntimeEvent } from "../contracts/runtime-messages.js";
import { storedScoutReportSchema } from "../domain/models/scout-report.js";
import type { PhaseSevenEightCommandHandler } from "./phase-seven-eight-command-handler.js";

interface ConnectionOperations {
  readonly service: ScoutingConnectionService;
  getStatus(): PeerConnectionStatus;
  ensureRelationship(relationshipId: string, inviteCode?: string): Promise<void>;
}

export interface LocalRuntimeCommandHandlerOptions {
  readonly repositories: ScoutPassRepositories;
  readonly reportGenerator: LocalReportGenerator;
  readonly connection: ConnectionOperations;
  readonly sharing: ProfileSharingService;
  readonly invitations: TryoutInvitationService;
  readonly wallet: SelfCustodialWalletService;
  readonly walletSharing: WalletAddressSharingService;
  readonly phaseSevenEight: PhaseSevenEightCommandHandler;
  readonly now?: () => Date;
}

export class LocalRuntimeCommandHandler {
  readonly #repositories: ScoutPassRepositories;
  readonly #reportGenerator: LocalReportGenerator;
  readonly #connection: ConnectionOperations;
  readonly #sharing: ProfileSharingService;
  readonly #invitations: TryoutInvitationService;
  readonly #wallet: SelfCustodialWalletService;
  readonly #walletSharing: WalletAddressSharingService;
  readonly #phaseSevenEight: PhaseSevenEightCommandHandler;
  readonly #now: () => Date;
  #walletStatus: "not_initialized" | "ready" | "error" = "not_initialized";

  public constructor(options: LocalRuntimeCommandHandlerOptions) {
    this.#repositories = options.repositories;
    this.#reportGenerator = options.reportGenerator;
    this.#connection = options.connection;
    this.#sharing = options.sharing;
    this.#invitations = options.invitations;
    this.#wallet = options.wallet;
    this.#walletSharing = options.walletSharing;
    this.#phaseSevenEight = options.phaseSevenEight;
    this.#now = options.now ?? (() => new Date());
  }

  public async handle(command: RuntimeCommand): Promise<RuntimeEvent> {
    try {
      switch (command.type) {
        case "runtime.status.get":
          return this.#runtimeStatus(command.requestId);
        case "profile.save":
          await this.#repositories.profiles.save(command.payload);
          return this.#succeeded(command.requestId, command.payload.id);
        case "report.generate":
          return await this.#generateReport(command.requestId, command.payload.playerId);
        case "share.prepare":
          return await this.#prepareShare(command);
        case "connection.invite.create": {
          await this.#connection.ensureRelationship(command.payload.relationshipId);
          const inviteCode = await this.#connection.service.createInvite(
            command.payload.relationshipId
          );
          return this.#event(command.requestId, "connection.invite.created", { inviteCode });
        }
        case "connection.connect":
          await this.#connection.ensureRelationship(
            "relationship_pending",
            command.payload.inviteCode
          );
          await this.#connection.service.connect(command.payload.inviteCode);
          return this.#event(command.requestId, "connection.status", { status: "connected" });
        case "connection.test_event.send": {
          const sent = await this.#connection.service.sendTestEvent(command.payload.relationshipId);
          return this.#succeeded(command.requestId, sent.id);
        }
        case "share.send": {
          const sent = await this.#sharing.sendPreparedShare(
            command.payload.relationshipId,
            {
              package: command.payload.package,
              serializedPayload: command.payload.serializedPayload,
              payloadBytes: command.payload.payloadBytes
            },
            command.payload.playerApproved
          );
          return this.#event(command.requestId, "share.sent", {
            packageId: sent.payload.package.packageId
          });
        }
        case "invitation.send": {
          const sent = await this.#invitations.sendDraft(command.payload);
          return this.#event(command.requestId, "invitation.updated", {
            invitation: sent.payload.invitation
          });
        }
        case "invitation.respond": {
          await this.#invitations.respond(
            command.payload.invitationId,
            command.payload.response,
            command.payload.message
          );
          const invitation = await this.#repositories.invitations.get(command.payload.invitationId);
          if (invitation === undefined) throw new Error("Invitation response was not persisted.");
          return this.#event(command.requestId, "invitation.updated", { invitation });
        }
        case "scout.note.save":
          await this.#repositories.scoutPrivateNotes.save(command.payload);
          return this.#event(command.requestId, "scout.note.saved", {
            noteId: command.payload.id
          });
        case "wallet.initialize":
          return await this.#initializeWallet(command.requestId, command.payload.ownerRole);
        case "wallet.balance.get":
          return await this.#getWalletBalance(command.requestId, command.payload.address);
        case "wallet.address.share": {
          const sent = await this.#walletSharing.shareAddress(
            command.payload.relationshipId,
            command.payload.wallet,
            command.payload.playerApproved
          );
          return this.#succeeded(command.requestId, sent.id);
        }
        default: {
          const delegated = await this.#phaseSevenEight.handle(command);
          if (delegated !== undefined) return delegated;
          throw new Error(`Runtime command is not implemented: ${command.type}`);
        }
      }
    } catch (error) {
      if (command.type === "wallet.initialize" || command.type === "wallet.balance.get") {
        this.#walletStatus = "error";
      }
      const failure = mapErrorToUserFacingFailure(error);
      return this.#event(command.requestId, "operation.failed", {
        code: failure.code,
        message: failure.message,
        retryable: failure.retryable
      });
    }
  }

  async #runtimeStatus(requestId: string): Promise<RuntimeEvent> {
    const qvacStatus = await this.#reportGenerator.getStatus();
    const peerStatus = this.#connection.getStatus();
    return this.#event(requestId, "runtime.status", {
      status: "ready",
      qvac:
        qvacStatus === "ready" ? "ready" : qvacStatus === "error" ? "unavailable" : "not_checked",
      pears:
        peerStatus === "connected"
          ? "connected"
          : peerStatus === "idle"
            ? "not_started"
            : "disconnected",
      wallet: this.#walletStatus
    });
  }

  async #generateReport(requestId: string, playerId: string): Promise<RuntimeEvent> {
    const player = await this.#repositories.profiles.get(playerId);
    if (player === undefined) throw new Error("Player profile was not found in local storage.");
    const content = await this.#reportGenerator.generate(player);
    const now = this.#now().toISOString();
    const report = storedScoutReportSchema.parse({
      id: createId("report"),
      playerId,
      content,
      disclaimer: REPORT_DISCLAIMER,
      editedByPlayer: false,
      createdAt: now,
      updatedAt: now
    });
    await this.#repositories.reports.save(report);
    return this.#event(requestId, "report.updated", { report });
  }

  async #prepareShare(
    command: Extract<RuntimeCommand, { type: "share.prepare" }>
  ): Promise<RuntimeEvent> {
    const [player, report] = await Promise.all([
      this.#repositories.profiles.get(command.payload.playerId),
      this.#repositories.reports.get(command.payload.reportId)
    ]);
    if (player === undefined || report === undefined) {
      throw new Error("Player profile or report was not found in local storage.");
    }
    const prepared = preparePlayerShare({
      player,
      report: report.content,
      selection: command.payload.selection,
      playerPublicKey: "runtime-local-public-key-00000000000000000000000000000000",
      now: this.#now()
    });
    return this.#event(command.requestId, "share.prepared", prepared);
  }

  async #initializeWallet(requestId: string, ownerRole: "player" | "scout"): Promise<RuntimeEvent> {
    const wallet = await this.#wallet.initialize(ownerRole);
    const balance = await this.#wallet.refreshBalance(wallet);
    this.#walletStatus = "ready";
    return this.#event(requestId, "wallet.updated", { wallet, balance });
  }

  async #getWalletBalance(requestId: string, address: string): Promise<RuntimeEvent> {
    const wallet = (await this.#repositories.wallets.list()).find(
      (candidate) => candidate.address.toLowerCase() === address.toLowerCase()
    );
    if (wallet === undefined) throw new Error("Wallet metadata was not found in local storage.");
    const balance = await this.#wallet.refreshBalance(wallet);
    this.#walletStatus = "ready";
    return this.#event(requestId, "wallet.updated", { wallet, balance });
  }

  #succeeded(requestId: string, entityId?: string): RuntimeEvent {
    return this.#event(requestId, "operation.succeeded", {
      ...(entityId === undefined ? {} : { entityId })
    });
  }

  #event<T extends RuntimeEvent["type"]>(
    requestId: string,
    type: T,
    payload: Extract<RuntimeEvent, { type: T }>["payload"]
  ): Extract<RuntimeEvent, { type: T }> {
    return {
      requestId,
      occurredAt: this.#now().toISOString(),
      type,
      payload
    } as Extract<RuntimeEvent, { type: T }>;
  }
}
