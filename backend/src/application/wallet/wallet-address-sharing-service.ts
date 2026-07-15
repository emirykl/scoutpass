import { PROTOCOL_VERSION } from "../../domain/constants.js";
import { createId } from "../../domain/identity.js";
import type { ScoutPassEvent, WalletAddressSharedEvent } from "../../domain/models/events.js";
import type { WalletPublicMetadata } from "../../domain/models/wallet.js";
import { walletPublicMetadataSchema } from "../../domain/models/wallet.js";
import type { ScoutingConnectionService } from "../connections/scouting-connection-service.js";
import type { WalletMetadataRepository } from "../ports/repositories.js";

export interface WalletAddressSharingServiceOptions {
  readonly connectionService: ScoutingConnectionService;
  readonly wallets: WalletMetadataRepository;
  readonly senderPublicKey: string;
  readonly now?: () => Date;
}

export class WalletAddressSharingService {
  readonly #connectionService: ScoutingConnectionService;
  readonly #wallets: WalletMetadataRepository;
  readonly #senderPublicKey: string;
  readonly #now: () => Date;
  readonly #listeners = new Set<(wallet: WalletPublicMetadata) => void>();
  readonly #unsubscribe: () => void;

  public constructor(options: WalletAddressSharingServiceOptions) {
    this.#connectionService = options.connectionService;
    this.#wallets = options.wallets;
    this.#senderPublicKey = options.senderPublicKey;
    this.#now = options.now ?? (() => new Date());
    this.#unsubscribe = this.#connectionService.onIncomingEvent(async (event) => {
      await this.#handleIncomingEvent(event);
    });
  }

  public async shareAddress(
    relationshipId: string,
    wallet: WalletPublicMetadata,
    playerApproved: boolean
  ): Promise<WalletAddressSharedEvent> {
    if (!playerApproved || wallet.ownerRole !== "player") {
      throw new Error("Player approval is required before sharing a receive address.");
    }
    const publicWallet = walletPublicMetadataSchema.parse(wallet);
    const event: WalletAddressSharedEvent = {
      id: createId("event_wallet_address"),
      type: "wallet.address_shared",
      senderPublicKey: this.#senderPublicKey,
      createdAt: this.#now().toISOString(),
      protocolVersion: PROTOCOL_VERSION,
      payload: { wallet: publicWallet }
    };
    await this.#connectionService.sendEvent(relationshipId, event);
    return event;
  }

  public onAddressReceived(listener: (wallet: WalletPublicMetadata) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  public dispose(): void {
    this.#unsubscribe();
    this.#listeners.clear();
  }

  async #handleIncomingEvent(event: ScoutPassEvent): Promise<void> {
    if (event.type !== "wallet.address_shared") return;
    const wallet = walletPublicMetadataSchema.parse(event.payload.wallet);
    await this.#wallets.save(wallet);
    for (const listener of this.#listeners) listener(structuredClone(wallet));
  }
}
