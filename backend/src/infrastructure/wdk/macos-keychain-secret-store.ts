import { spawn } from "node:child_process";

import type { WalletSecretStore } from "../../application/ports/integrations.js";

interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
}

export interface SecretCommandRunner {
  run(args: readonly string[], stdin?: string): Promise<CommandResult>;
}

class MacOsSecurityCommandRunner implements SecretCommandRunner {
  public run(args: readonly string[], stdin?: string): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn("/usr/bin/security", [...args], {
        stdio: ["pipe", "pipe", "pipe"]
      });
      let stdout = "";
      child.stdout.setEncoding("utf8");
      child.stderr.resume();
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
      });
      child.on("error", reject);
      child.on("close", (exitCode) => {
        resolve({ exitCode: exitCode ?? 1, stdout });
      });
      child.stdin.end(stdin);
    });
  }
}

export interface MacOsKeychainSecretStoreOptions {
  readonly serviceName?: string;
  readonly commandRunner?: SecretCommandRunner;
}

export class MacOsKeychainSecretStore implements WalletSecretStore {
  readonly #serviceName: string;
  readonly #runner: SecretCommandRunner;

  public constructor(options: MacOsKeychainSecretStoreOptions = {}) {
    this.#serviceName = options.serviceName ?? "io.scoutpass.wallet";
    this.#runner = options.commandRunner ?? new MacOsSecurityCommandRunner();
  }

  public async get(secretId: string): Promise<string | undefined> {
    this.#assertPlatform();
    const result = await this.#runner.run([
      "find-generic-password",
      "-a",
      secretId,
      "-s",
      this.#serviceName,
      "-w"
    ]);
    if (result.exitCode === 44) {
      return undefined;
    }
    if (result.exitCode !== 0) {
      throw new Error("Wallet secret could not be read from macOS Keychain.");
    }
    return result.stdout.replace(/\r?\n$/, "");
  }

  public async set(secretId: string, value: string): Promise<void> {
    this.#assertPlatform();
    const secretHex = Buffer.from(value, "utf8").toString("hex");
    const command = [
      "add-generic-password",
      "-a",
      quoteSecurityArgument(secretId),
      "-s",
      quoteSecurityArgument(this.#serviceName),
      "-U",
      "-X",
      secretHex
    ].join(" ");
    const result = await this.#runner.run(["-i"], `${command}\n`);
    if (result.exitCode !== 0) {
      throw new Error("Wallet secret could not be stored in macOS Keychain.");
    }
  }

  public async delete(secretId: string): Promise<boolean> {
    this.#assertPlatform();
    const result = await this.#runner.run([
      "delete-generic-password",
      "-a",
      secretId,
      "-s",
      this.#serviceName
    ]);
    if (result.exitCode === 44) {
      return false;
    }
    if (result.exitCode !== 0) {
      throw new Error("Wallet secret could not be deleted from macOS Keychain.");
    }
    return true;
  }

  #assertPlatform(): void {
    if (process.platform !== "darwin") {
      throw new Error("macOS Keychain storage is only available on macOS.");
    }
  }
}

const quoteSecurityArgument = (value: string): string =>
  `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
