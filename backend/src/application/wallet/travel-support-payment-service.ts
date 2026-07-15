import { PROTOCOL_VERSION, TESTNET_CONFIG } from "../../domain/constants.js";
import { createId } from "../../domain/identity.js";
import type {
  ScoutPassEvent,
  TravelSupportProposedEvent,
  TravelSupportSentEvent
} from "../../domain/models/events.js";
import type { TryoutInvitation } from "../../domain/models/invitation.js";
import type {
  PaymentProposal,
  PaymentReference,
  WalletPublicMetadata
} from "../../domain/models/wallet.js";
import {
  paymentProposalSchema,
  paymentReferenceSchema,
  walletPublicMetadataSchema
} from "../../domain/models/wallet.js";
import type { ScoutingConnectionService } from "../connections/scouting-connection-service.js";
import type { WalletGateway } from "../ports/integrations.js";
import type {
  InvitationRepository,
  PaymentReferenceRepository,
  RelationshipEventLogRepository
} from "../ports/repositories.js";

export class TravelSupportPaymentError extends Error {
  public constructor(
    public readonly code:
      | "invitation_not_accepted"
      | "address_not_verified"
      | "duplicate_payment"
      | "payment_not_found"
      | "confirmation_required"
      | "invalid_payment_state"
      | "wallet_operation_failed",
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "TravelSupportPaymentError";
  }
}

export interface TravelSupportPaymentServiceOptions {
  readonly gateway: WalletGateway;
  readonly connectionService: ScoutingConnectionService;
  readonly invitations: InvitationRepository;
  readonly payments: PaymentReferenceRepository;
  readonly relationshipEvents: RelationshipEventLogRepository;
  readonly senderPublicKey: string;
  readonly now?: () => Date;
}

export class TravelSupportPaymentService {
  readonly #gateway: WalletGateway;
  readonly #connectionService: ScoutingConnectionService;
  readonly #invitations: InvitationRepository;
  readonly #payments: PaymentReferenceRepository;
  readonly #relationshipEvents: RelationshipEventLogRepository;
  readonly #senderPublicKey: string;
  readonly #now: () => Date;
  readonly #listeners = new Set<(payment: PaymentReference) => void>();
  readonly #unsubscribe: () => void;

  public constructor(options: TravelSupportPaymentServiceOptions) {
    this.#gateway = options.gateway;
    this.#connectionService = options.connectionService;
    this.#invitations = options.invitations;
    this.#payments = options.payments;
    this.#relationshipEvents = options.relationshipEvents;
    this.#senderPublicKey = options.senderPublicKey;
    this.#now = options.now ?? (() => new Date());
    this.#unsubscribe = this.#connectionService.onIncomingEvent(async (event, relationshipId) => {
      await this.#handleIncomingEvent(event, relationshipId);
    });
  }

  public async review(invitationId: string): Promise<PaymentProposal> {
    const invitation = await this.#requireAcceptedInvitation(invitationId);
    const existing = (await this.#payments.list()).find(
      (payment) => payment.invitationId === invitationId
    );
    if (existing !== undefined) {
      throw new TravelSupportPaymentError(
        "duplicate_payment",
        "A travel support payment already exists for this invitation."
      );
    }

    const wallet = await this.#requireVerifiedPlayerWallet(invitation.relationshipId);
    const now = this.#now().toISOString();
    const draft = paymentProposalSchema.parse({
      id: createId("payment"),
      invitationId: invitation.id,
      relationshipId: invitation.relationshipId,
      destinationAddress: wallet.address,
      network: TESTNET_CONFIG.network,
      tokenAddress: TESTNET_CONFIG.tokenAddress,
      asset: TESTNET_CONFIG.asset,
      amount: invitation.travelSupportAmount,
      feeBaseUnits: "0",
      status: "proposed",
      createdAt: now,
      updatedAt: now
    });
    const quote = await this.#gateway.quoteTransfer(draft).catch((error: unknown) => {
      throw new TravelSupportPaymentError(
        "wallet_operation_failed",
        "The Sepolia network fee could not be estimated.",
        { cause: error }
      );
    });
    const proposal = paymentProposalSchema.parse({ ...draft, ...quote });
    await this.#payments.save(proposal);

    const event: TravelSupportProposedEvent = {
      id: createId("event_travel_proposed"),
      type: "travel_support.proposed",
      senderPublicKey: this.#senderPublicKey,
      createdAt: now,
      protocolVersion: PROTOCOL_VERSION,
      payload: { proposal }
    };
    await this.#connectionService.sendEvent(invitation.relationshipId, event);
    this.#emit(proposal);
    return proposal;
  }

  public async confirmAndSend(
    proposalId: string,
    userConfirmed: boolean
  ): Promise<PaymentReference> {
    if (!userConfirmed) {
      throw new TravelSupportPaymentError(
        "confirmation_required",
        "Confirm and sign is required before a transaction can be created."
      );
    }
    const proposal = await this.#requirePayment(proposalId);
    if (proposal.status !== "proposed") {
      throw new TravelSupportPaymentError(
        "invalid_payment_state",
        "Only a reviewed payment proposal can be signed."
      );
    }
    const invitation = await this.#requireAcceptedInvitation(proposal.invitationId);
    const wallet = await this.#requireVerifiedPlayerWallet(invitation.relationshipId);
    if (
      proposal.relationshipId !== invitation.relationshipId ||
      proposal.destinationAddress.toLowerCase() !== wallet.address.toLowerCase()
    ) {
      throw new TravelSupportPaymentError(
        "address_not_verified",
        "The reviewed player address no longer matches this invitation."
      );
    }

    let payment: PaymentReference;
    try {
      payment = paymentReferenceSchema.parse(await this.#gateway.confirmAndSend(proposal));
    } catch (error) {
      const failureMessage = mapWalletFailure(error);
      const failed = paymentReferenceSchema.parse({
        ...proposal,
        status: "failed",
        failureReason: failureMessage,
        updatedAt: this.#now().toISOString()
      });
      await this.#payments.save(failed);
      this.#emit(failed);
      throw new TravelSupportPaymentError("wallet_operation_failed", failureMessage, {
        cause: error
      });
    }

    await this.#payments.save(payment);
    await this.#sendPaymentEvent(payment);
    this.#emit(payment);
    return payment;
  }

  public async reject(proposalId: string): Promise<PaymentReference> {
    const proposal = await this.#requirePayment(proposalId);
    if (proposal.status !== "proposed") {
      throw new TravelSupportPaymentError(
        "invalid_payment_state",
        "Only an unsigned payment proposal can be rejected."
      );
    }
    const rejected = paymentReferenceSchema.parse({
      ...proposal,
      status: "rejected",
      updatedAt: this.#now().toISOString()
    });
    await this.#payments.save(rejected);
    this.#emit(rejected);
    return rejected;
  }

  public async refreshStatus(paymentId: string): Promise<PaymentReference> {
    const payment = await this.#requirePayment(paymentId);
    if (payment.status !== "pending") return payment;
    const refreshed = paymentReferenceSchema.parse(await this.#gateway.getTransferStatus(payment));
    await this.#payments.save(refreshed);
    if (refreshed.status !== payment.status) await this.#sendPaymentEvent(refreshed);
    this.#emit(refreshed);
    return refreshed;
  }

  public onPaymentChanged(listener: (payment: PaymentReference) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  public dispose(): void {
    this.#unsubscribe();
    this.#listeners.clear();
  }

  async #requireAcceptedInvitation(invitationId: string): Promise<TryoutInvitation> {
    const invitation = await this.#invitations.get(invitationId);
    if (
      invitation === undefined ||
      invitation.status !== "accepted" ||
      invitation.travelSupportAmount === undefined ||
      invitation.paymentAsset !== TESTNET_CONFIG.asset
    ) {
      throw new TravelSupportPaymentError(
        "invitation_not_accepted",
        "Travel support requires an accepted invitation with an spUSD amount."
      );
    }
    return invitation;
  }

  async #requireVerifiedPlayerWallet(relationshipId: string): Promise<WalletPublicMetadata> {
    const events = await this.#relationshipEvents.list(relationshipId);
    const shared = events.findLast(
      (event): event is Extract<ScoutPassEvent, { type: "wallet.address_shared" }> =>
        event.type === "wallet.address_shared" &&
        event.payload.relationshipId === relationshipId &&
        event.payload.wallet.ownerRole === "player"
    );
    if (shared === undefined) {
      throw new TravelSupportPaymentError(
        "address_not_verified",
        "The player must share a receive address through this scouting connection first."
      );
    }
    return walletPublicMetadataSchema.parse(shared.payload.wallet);
  }

  async #requirePayment(paymentId: string): Promise<PaymentReference> {
    const payment = await this.#payments.get(paymentId);
    if (payment === undefined) {
      throw new TravelSupportPaymentError(
        "payment_not_found",
        "Travel support payment was not found in local storage."
      );
    }
    return paymentReferenceSchema.parse(payment);
  }

  async #sendPaymentEvent(payment: PaymentReference): Promise<void> {
    const event: TravelSupportSentEvent = {
      id: createId("event_travel_sent"),
      type: "travel_support.sent",
      senderPublicKey: this.#senderPublicKey,
      createdAt: this.#now().toISOString(),
      protocolVersion: PROTOCOL_VERSION,
      payload: { payment }
    };
    await this.#connectionService.sendEvent(payment.relationshipId, event);
  }

  async #handleIncomingEvent(event: ScoutPassEvent, relationshipId: string): Promise<void> {
    if (event.type === "travel_support.proposed") {
      const proposal = paymentProposalSchema.parse(event.payload.proposal);
      if (proposal.relationshipId !== relationshipId) {
        throw new TravelSupportPaymentError(
          "address_not_verified",
          "Payment proposal does not match the active scouting relationship."
        );
      }
      await this.#payments.save(proposal);
      this.#emit(proposal);
      return;
    }
    if (event.type !== "travel_support.sent") return;
    const payment = paymentReferenceSchema.parse(event.payload.payment);
    if (payment.relationshipId !== relationshipId || payment.transactionId === undefined) {
      throw new TravelSupportPaymentError(
        "address_not_verified",
        "Payment result does not match the active scouting relationship."
      );
    }
    const invitation = await this.#invitations.get(payment.invitationId);
    if (invitation === undefined || invitation.relationshipId !== relationshipId) {
      throw new TravelSupportPaymentError(
        "invitation_not_accepted",
        "Payment result does not match a local invitation."
      );
    }
    await this.#payments.save(payment);
    this.#emit(payment);
  }

  #emit(payment: PaymentReference): void {
    for (const listener of this.#listeners) listener(structuredClone(payment));
  }
}

const mapWalletFailure = (error: unknown): string => {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("insufficient") || message.includes("balance")) {
    return "Insufficient spUSD or Sepolia ETH balance for this transaction.";
  }
  if (message.includes("timeout") || message.includes("timed out") || message.includes("abort")) {
    return "The Sepolia transaction request timed out. Its status was not assumed successful.";
  }
  if (
    message.includes("rpc") ||
    message.includes("provider") ||
    message.includes("network") ||
    message.includes("indexer")
  ) {
    return "The Sepolia RPC or indexer could not complete the transaction request.";
  }
  return "The WDK testnet transaction could not be sent.";
};
