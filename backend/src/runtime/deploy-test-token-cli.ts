import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import WalletManagerEvm from "@tetherto/wdk-wallet-evm";
import solc from "solc";

import { MacOsKeychainSecretStore } from "../infrastructure/wdk/macos-keychain-secret-store.js";

const RPC_URL = process.env.SCOUTPASS_SEPOLIA_RPC_URL ?? "https://sepolia.drpc.org";
const CHAIN_ID = 11_155_111;
const EXPECTED_SCOUT_ADDRESS = "0x4c6F33A91FAe898D5F276e3e0b566596d3de9E28";
const CONTRACT_FILE = "ScoutPassTestUSD.sol";
const CONTRACT_NAME = "ScoutPassTestUSD";

interface SolcOutput {
  readonly contracts?: Record<
    string,
    Record<string, { readonly evm: { readonly bytecode: { readonly object: string } } }>
  >;
  readonly errors?: ReadonlyArray<{
    readonly severity: "error" | "warning";
    readonly formattedMessage: string;
  }>;
}

const sourcePath = resolve(import.meta.dirname, "../../../contracts", CONTRACT_FILE);
const source = await readFile(sourcePath, "utf8");
const compileSolidity = solc.compile as unknown as (input: string) => string;
const compilation = JSON.parse(
  compileSolidity(
    JSON.stringify({
      language: "Solidity",
      sources: { [CONTRACT_FILE]: { content: source } },
      settings: {
        optimizer: { enabled: true, runs: 200 },
        outputSelection: { "*": { "*": ["evm.bytecode.object"] } }
      }
    })
  )
) as SolcOutput;

const compilationErrors = compilation.errors?.filter((error) => error.severity === "error") ?? [];
if (compilationErrors.length > 0) {
  throw new Error(compilationErrors.map((error) => error.formattedMessage).join("\n"));
}

const bytecodeObject = compilation.contracts?.[CONTRACT_FILE]?.[CONTRACT_NAME]?.evm.bytecode.object;
if (!bytecodeObject) throw new Error("spUSD deployment bytecode was not generated.");
const deploymentData = `0x${bytecodeObject}`;

const secretStore = new MacOsKeychainSecretStore();
let seedPhrase = await secretStore.get("ethereum-sepolia:scout");
if (seedPhrase === undefined) throw new Error("The Scout WDK wallet is not initialized.");

const walletManager = new WalletManagerEvm(seedPhrase, {
  provider: RPC_URL,
  chainId: CHAIN_ID
});
// Drop our reference immediately; the WDK signer owns the remaining in-memory copy.
// eslint-disable-next-line no-useless-assignment
seedPhrase = "";

try {
  const account = await walletManager.getAccount(0);
  const address = await account.getAddress();
  if (address.toLowerCase() !== EXPECTED_SCOUT_ADDRESS.toLowerCase()) {
    throw new Error(`Refusing deployment from unexpected Scout address: ${address}`);
  }

  const transaction = { to: null, value: 0n, data: deploymentData } as const;
  const [ethBalance, quote] = await Promise.all([
    account.getBalance(),
    account.quoteSendTransaction(transaction)
  ]);
  if (quote.fee > ethBalance) throw new Error("Scout wallet does not have enough Sepolia ETH.");

  process.stdout.write(
    `${JSON.stringify(
      {
        mode: process.argv.includes("--confirm") ? "deploy" : "estimate_only",
        network: "Ethereum Sepolia",
        chainId: CHAIN_ID,
        deployer: address,
        ethBalanceWei: ethBalance.toString(),
        estimatedFeeWei: quote.fee.toString(),
        token: { name: "ScoutPass Test USD", symbol: "spUSD", decimals: 6, supply: "1000" }
      },
      null,
      2
    )}\n`
  );

  if (!process.argv.includes("--confirm")) {
    process.stdout.write("Estimate complete. Re-run with --confirm to broadcast on Sepolia.\n");
    process.exitCode = 2;
  } else {
    const result = await account.sendTransaction(transaction);
    process.stdout.write(`Deployment transaction: ${result.hash}\n`);

    const deadline = Date.now() + 120_000;
    let receipt = await account.getTransactionReceipt(result.hash);
    while (receipt === null && Date.now() < deadline) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 2_000));
      receipt = await account.getTransactionReceipt(result.hash);
    }
    if (receipt === null)
      throw new Error("Deployment receipt was not available within two minutes.");
    if (receipt.status !== 1 || receipt.contractAddress === null) {
      throw new Error("The spUSD deployment transaction failed.");
    }

    const tokenBalance = await account.getTokenBalance(receipt.contractAddress);
    process.stdout.write(
      `${JSON.stringify(
        {
          status: "confirmed",
          transactionHash: result.hash,
          contractAddress: receipt.contractAddress,
          scoutTokenBalanceBaseUnits: tokenBalance.toString()
        },
        null,
        2
      )}\n`
    );
  }
} finally {
  walletManager.dispose();
}
