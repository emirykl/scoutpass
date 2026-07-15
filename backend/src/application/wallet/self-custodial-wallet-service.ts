import type { WalletGateway } from "../ports/integrations.js";
import type { WalletMetadataRepository } from "../ports/repositories.js";
import type { WalletPublicMetadata } from "../../domain/models/wallet.js";
import { walletPublicMetadataSchema } from "../../domain/models/wallet.js";

export interface SelfCustodialWalletServiceOptions {
  readonly gateway: WalletGateway;
  readonly wallets: WalletMetadataRepository;
  readonly now?: () => Date;
}

export class SelfCustodialWalletService {
  readonly #gateway: WalletGateway;
  readonly #wallets: WalletMetadataRepository;
  readonly #now: () => Date;

  public constructor(options: SelfCustodialWalletServiceOptions) {
    this.#gateway = options.gateway;
    this.#wallets = options.wallets;
    this.#now = options.now ?? (() => new Date());
  }

  public async initialize(ownerRole: "player" | "scout"): Promise<WalletPublicMetadata> {
    const initialized = walletPublicMetadataSchema.parse(await this.#gateway.initialize(ownerRole));
    const existing = await this.#wallets.get(initialized.id);
    if (
      existing !== undefined &&
      existing.address.toLowerCase() !== initialized.address.toLowerCase()
    ) {
      throw new Error("Secure wallet material does not match the stored public wallet metadata.");
    }

    const metadata = walletPublicMetadataSchema.parse({
      ...initialized,
      createdAt: existing?.createdAt ?? initialized.createdAt,
      updatedAt: this.#now().toISOString()
    });
    await this.#wallets.save(metadata);
    return metadata;
  }

  public refreshBalance(wallet: WalletPublicMetadata): Promise<string> {
    return this.#gateway.getTokenBalance(wallet.address);
  }

  public dispose(): Promise<void> {
    return this.#gateway.dispose();
  }
}
