import { resolve } from "node:path";

import { SelfCustodialWalletService } from "../application/wallet/self-custodial-wallet-service.js";
import { MacOsKeychainSecretStore } from "../infrastructure/wdk/macos-keychain-secret-store.js";
import { WdkEvmWalletGateway } from "../infrastructure/wdk/wdk-evm-wallet-gateway.js";
import { JsonFileStore } from "../infrastructure/storage/json-file-store.js";
import { createJsonRepositories } from "../infrastructure/storage/json-repositories.js";
import { resolveInstanceDataFile } from "../infrastructure/storage/instance-storage-path.js";

const role = process.argv[2];
if (role !== "player" && role !== "scout") {
  throw new Error("Wallet role must be either player or scout.");
}

const dataDirectory = resolve(process.env.SCOUTPASS_DATA_DIR ?? ".scoutpass/data");
const repositories = createJsonRepositories(
  new JsonFileStore(resolveInstanceDataFile(dataDirectory, role))
);
const gateway = new WdkEvmWalletGateway({
  secretStore: new MacOsKeychainSecretStore(),
  rpcUrl: process.env.SCOUTPASS_SEPOLIA_RPC_URL ?? "https://sepolia.drpc.org"
});
const walletService = new SelfCustodialWalletService({
  gateway,
  wallets: repositories.wallets
});

try {
  const wallet = await walletService.initialize(role);
  const balance = await walletService.refreshBalance(wallet);
  process.stdout.write(
    `${JSON.stringify(
      {
        role,
        network: wallet.network,
        address: wallet.address,
        testUsdtBalance: balance,
        testnetOnly: wallet.testnetOnly
      },
      null,
      2
    )}\n`
  );
} finally {
  await walletService.dispose();
}
