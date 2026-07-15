import { describe, expect, it } from "vitest";
import WDK from "@tetherto/wdk";

import type { WalletSecretStore } from "../src/application/ports/integrations.js";
import type { WalletMetadataRepository } from "../src/application/ports/repositories.js";
import { SelfCustodialWalletService } from "../src/application/wallet/self-custodial-wallet-service.js";
import type { WalletPublicMetadata } from "../src/domain/models/wallet.js";
import {
  MacOsKeychainSecretStore,
  type SecretCommandRunner
} from "../src/infrastructure/wdk/macos-keychain-secret-store.js";
import {
  formatBaseUnits,
  WdkEvmWalletGateway
} from "../src/infrastructure/wdk/wdk-evm-wallet-gateway.js";
import { NOW } from "./fixtures.js";

const PLAYER_SEED = WDK.getRandomSeedPhrase(12);
const SCOUT_SEED = WDK.getRandomSeedPhrase(12);

class InMemorySecretStore implements WalletSecretStore {
  readonly values = new Map<string, string>();

  public get(secretId: string): Promise<string | undefined> {
    return Promise.resolve(this.values.get(secretId));
  }

  public set(secretId: string, value: string): Promise<void> {
    this.values.set(secretId, value);
    return Promise.resolve();
  }

  public delete(secretId: string): Promise<boolean> {
    return Promise.resolve(this.values.delete(secretId));
  }
}

class RecordingCommandRunner implements SecretCommandRunner {
  readonly calls: Array<{ readonly args: readonly string[]; readonly stdin?: string }> = [];
  public result = { exitCode: 0, stdout: "" };

  public run(
    args: readonly string[],
    stdin?: string
  ): Promise<{ exitCode: number; stdout: string }> {
    this.calls.push({ args, ...(stdin === undefined ? {} : { stdin }) });
    return Promise.resolve(this.result);
  }
}

class InMemoryWalletRepository implements WalletMetadataRepository {
  readonly wallets = new Map<string, WalletPublicMetadata>();

  public get(id: string): Promise<WalletPublicMetadata | undefined> {
    const value = this.wallets.get(id);
    return Promise.resolve(value === undefined ? undefined : structuredClone(value));
  }

  public list(): Promise<readonly WalletPublicMetadata[]> {
    return Promise.resolve([...this.wallets.values()].map((value) => structuredClone(value)));
  }

  public save(entity: WalletPublicMetadata): Promise<void> {
    this.wallets.set(entity.id, structuredClone(entity));
    return Promise.resolve();
  }

  public delete(id: string): Promise<boolean> {
    return Promise.resolve(this.wallets.delete(id));
  }
}

describe("WDK self-custodial wallet", () => {
  it("derives separate role addresses and restores the same address from secure storage", async () => {
    const secrets = new InMemorySecretStore();
    const wallets = new InMemoryWalletRepository();
    const seeds = [PLAYER_SEED, SCOUT_SEED];
    const createGateway = () =>
      new WdkEvmWalletGateway({
        secretStore: secrets,
        rpcUrl: "https://sepolia.drpc.org",
        now: () => NOW,
        generateSeedPhrase: () => seeds.shift() ?? PLAYER_SEED
      });

    const first = new SelfCustodialWalletService({
      gateway: createGateway(),
      wallets,
      now: () => NOW
    });
    const player = await first.initialize("player");
    const scout = await first.initialize("scout");
    await first.dispose();

    const restarted = new SelfCustodialWalletService({
      gateway: createGateway(),
      wallets,
      now: () => NOW
    });
    const restoredPlayer = await restarted.initialize("player");
    await restarted.dispose();

    expect(player.address).not.toBe(scout.address);
    expect(restoredPlayer.address).toBe(player.address);
    expect(player).toMatchObject({
      network: "Ethereum Sepolia",
      chainId: 11155111,
      testnetOnly: true
    });
    expect(JSON.stringify(player)).not.toContain(PLAYER_SEED);
    expect(secrets.values.size).toBe(2);
    expect(await wallets.get(player.id)).toEqual(restoredPlayer);
  });

  it("passes a new seed through stdin instead of process arguments", async () => {
    const runner = new RecordingCommandRunner();
    const store = new MacOsKeychainSecretStore({
      serviceName: "io.scoutpass.wallet.test",
      commandRunner: runner
    });

    await store.set("ethereum-sepolia:player", PLAYER_SEED);
    const call = runner.calls[0];
    expect(call).toBeDefined();
    expect(call?.args.join(" ")).not.toContain(PLAYER_SEED);
    expect(call?.args).toEqual(["-i"]);
    expect(call?.stdin).not.toContain(PLAYER_SEED);
    expect(call?.stdin).toContain(Buffer.from(PLAYER_SEED, "utf8").toString("hex"));

    runner.result = { exitCode: 0, stdout: `${PLAYER_SEED}\n` };
    await expect(store.get("ethereum-sepolia:player")).resolves.toBe(PLAYER_SEED);
  });

  it("formats six-decimal USD₮ balances without floating point arithmetic", () => {
    expect(formatBaseUnits(25_500_000n, 6)).toBe("25.5");
    expect(formatBaseUnits(1n, 6)).toBe("0.000001");
    expect(formatBaseUnits(0n, 6)).toBe("0");
  });

  it.runIf(process.env.SCOUTPASS_WDK_NETWORK_SMOKE === "1")(
    "reads a real test USD₮ balance from Ethereum Sepolia",
    async () => {
      const secrets = new InMemorySecretStore();
      const gateway = new WdkEvmWalletGateway({
        secretStore: secrets,
        rpcUrl: process.env.SCOUTPASS_SEPOLIA_RPC_URL ?? "https://sepolia.drpc.org",
        generateSeedPhrase: () => PLAYER_SEED
      });
      const wallet = await gateway.initialize("player");
      await expect(gateway.getTokenBalance(wallet.address)).resolves.toMatch(/^\d+(?:\.\d{1,6})?$/);
      await gateway.dispose();
    },
    30_000
  );

  it.runIf(process.env.SCOUTPASS_KEYCHAIN_SMOKE === "1")(
    "restores the same WDK wallet from the real macOS Keychain after restart",
    async () => {
      const serviceName = `io.scoutpass.wallet.smoke.${process.pid}`;
      const secretId = "ethereum-sepolia:player";
      const store = new MacOsKeychainSecretStore({ serviceName });
      try {
        const first = new WdkEvmWalletGateway({
          secretStore: store,
          rpcUrl: "https://sepolia.drpc.org",
          generateSeedPhrase: () => PLAYER_SEED
        });
        const firstWallet = await first.initialize("player");
        await first.dispose();

        const restarted = new WdkEvmWalletGateway({
          secretStore: store,
          rpcUrl: "https://sepolia.drpc.org",
          generateSeedPhrase: () => SCOUT_SEED
        });
        const restoredWallet = await restarted.initialize("player");
        await restarted.dispose();
        expect(restoredWallet.address).toBe(firstWallet.address);
      } finally {
        await store.delete(secretId);
      }
      await expect(store.get(secretId)).resolves.toBeUndefined();
    },
    30_000
  );
});
