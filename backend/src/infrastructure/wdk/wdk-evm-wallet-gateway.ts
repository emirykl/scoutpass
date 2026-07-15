import WDK from "@tetherto/wdk";
import WalletManagerEvm, { type WalletAccountEvm } from "@tetherto/wdk-wallet-evm";

import type { WalletGateway, WalletSecretStore } from "../../application/ports/integrations.js";
import { TESTNET_CONFIG } from "../../domain/constants.js";
import type {
  PaymentProposal,
  PaymentReference,
  WalletPublicMetadata
} from "../../domain/models/wallet.js";
import { walletPublicMetadataSchema } from "../../domain/models/wallet.js";
import { paymentReferenceSchema } from "../../domain/models/wallet.js";
import { decimalAmountToBaseUnits } from "../../domain/services/payment-amount.js";

const BLOCKCHAIN_ID = "ethereum-sepolia";

export interface WdkEvmWalletGatewayOptions {
  readonly secretStore: WalletSecretStore;
  readonly rpcUrl: string;
  readonly now?: () => Date;
  readonly generateSeedPhrase?: () => string;
}

export class WalletInitializationError extends Error {
  public constructor(options?: ErrorOptions) {
    super("Self-custodial WDK wallet could not be initialized.", options);
    this.name = "WalletInitializationError";
  }
}

export class WalletBalanceQueryError extends Error {
  public constructor(options?: ErrorOptions) {
    super("spUSD balance could not be read from Ethereum Sepolia.", options);
    this.name = "WalletBalanceQueryError";
  }
}

export class WdkEvmWalletGateway implements WalletGateway {
  readonly #secretStore: WalletSecretStore;
  readonly #rpcUrl: string;
  readonly #now: () => Date;
  readonly #generateSeedPhrase: () => string;
  #walletManager: WalletManagerEvm | undefined;
  #account: WalletAccountEvm | undefined;
  #metadata: WalletPublicMetadata | undefined;

  public constructor(options: WdkEvmWalletGatewayOptions) {
    this.#secretStore = options.secretStore;
    this.#rpcUrl = options.rpcUrl;
    this.#now = options.now ?? (() => new Date());
    this.#generateSeedPhrase = options.generateSeedPhrase ?? (() => WDK.getRandomSeedPhrase(12));
  }

  public async initialize(ownerRole: "player" | "scout"): Promise<WalletPublicMetadata> {
    if (this.#metadata?.ownerRole === ownerRole) {
      return structuredClone(this.#metadata);
    }
    await this.dispose();

    const secretId = `${BLOCKCHAIN_ID}:${ownerRole}`;
    try {
      let seedPhrase = await this.#secretStore.get(secretId);
      if (seedPhrase === undefined) {
        seedPhrase = this.#generateSeedPhrase();
        if (!WDK.isValidSeed(seedPhrase)) {
          throw new Error("Generated wallet seed is invalid.");
        }
        await this.#secretStore.set(secretId, seedPhrase);
      } else if (!WDK.isValidSeed(seedPhrase)) {
        throw new Error("Stored wallet seed is invalid.");
      }

      const walletManager = new WalletManagerEvm(seedPhrase, {
        provider: this.#rpcUrl,
        chainId: TESTNET_CONFIG.chainId
      });
      seedPhrase = "";
      const account = await walletManager.getAccount(0);
      const address = await account.getAddress();
      const now = this.#now().toISOString();
      const metadata = walletPublicMetadataSchema.parse({
        id: `wallet_${ownerRole}_ethereum_sepolia`,
        ownerRole,
        network: TESTNET_CONFIG.network,
        chainId: TESTNET_CONFIG.chainId,
        address,
        testnetOnly: true,
        createdAt: now,
        updatedAt: now
      });

      this.#walletManager = walletManager;
      this.#account = account;
      this.#metadata = metadata;
      return structuredClone(metadata);
    } catch (error) {
      await this.dispose();
      throw new WalletInitializationError({ cause: error });
    }
  }

  public async getTokenBalance(address: string): Promise<string> {
    const account = this.#requireAccount(address);
    try {
      const balance = await account.getTokenBalance(TESTNET_CONFIG.tokenAddress);
      return formatBaseUnits(balance, TESTNET_CONFIG.decimals);
    } catch (error) {
      throw new WalletBalanceQueryError({ cause: error });
    }
  }

  public async quoteTransfer(
    proposal: PaymentProposal
  ): Promise<{ readonly feeBaseUnits: string }> {
    const account = this.#requireAccount();
    const quote = await account.quoteTransfer({
      token: proposal.tokenAddress,
      recipient: proposal.destinationAddress,
      amount: decimalAmountToBaseUnits(proposal.amount, TESTNET_CONFIG.decimals)
    });
    return { feeBaseUnits: quote.fee.toString() };
  }

  public async confirmAndSend(proposal: PaymentProposal): Promise<PaymentReference> {
    const account = this.#requireAccount();
    const result = await account.transfer({
      token: proposal.tokenAddress,
      recipient: proposal.destinationAddress,
      amount: decimalAmountToBaseUnits(proposal.amount, TESTNET_CONFIG.decimals)
    });
    return paymentReferenceSchema.parse({
      ...proposal,
      feeBaseUnits: result.fee.toString(),
      status: "pending",
      transactionId: result.hash,
      updatedAt: this.#now().toISOString()
    });
  }

  public async getTransferStatus(payment: PaymentReference): Promise<PaymentReference> {
    const account = this.#requireAccount();
    if (payment.transactionId === undefined) {
      throw new Error("Payment does not have a transaction identifier.");
    }
    const receipt = await account.getTransactionReceipt(payment.transactionId);
    if (receipt === null) return structuredClone(payment);

    const status = receipt.status === 1 ? "confirmed" : "failed";
    return paymentReferenceSchema.parse({
      ...payment,
      status,
      ...(status === "failed" ? { failureReason: "The testnet transaction reverted." } : {}),
      updatedAt: this.#now().toISOString()
    });
  }

  public dispose(): Promise<void> {
    this.#walletManager?.dispose();
    this.#walletManager = undefined;
    this.#account = undefined;
    this.#metadata = undefined;
    return Promise.resolve();
  }

  #requireAccount(address?: string): WalletAccountEvm {
    if (this.#account === undefined || this.#metadata === undefined) {
      throw new WalletInitializationError();
    }
    if (address !== undefined && address.toLowerCase() !== this.#metadata.address.toLowerCase()) {
      throw new Error("Balance address does not match the initialized self-custodial wallet.");
    }
    return this.#account;
  }
}

export const formatBaseUnits = (value: bigint, decimals: number): string => {
  const padded = value.toString().padStart(decimals + 1, "0");
  const integer = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return fraction.length === 0 ? integer : `${integer}.${fraction}`;
};
