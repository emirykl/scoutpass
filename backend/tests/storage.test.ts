import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { EventDeduplicator } from "../src/domain/services/event-deduplicator.js";
import {
  JsonFileStore,
  StorageCorruptionError,
  UnsupportedStorageVersionError
} from "../src/infrastructure/storage/json-file-store.js";
import {
  createJsonRepositories,
  JsonEventIdStore
} from "../src/infrastructure/storage/json-repositories.js";
import { resolveInstanceDataFile } from "../src/infrastructure/storage/instance-storage-path.js";
import { PROTOCOL_VERSION } from "../src/domain/constants.js";
import type { ProfileReceivedEvent } from "../src/domain/models/events.js";
import { createPlayer, NOW, PUBLIC_KEY } from "./fixtures.js";

const directories: string[] = [];

const createDataFile = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "scoutpass-test-"));
  directories.push(directory);
  return join(directory, "player", "data.json");
};

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("local JSON storage", () => {
  it("resolves isolated data files for player and scout instances", () => {
    expect(resolveInstanceDataFile("/tmp/scoutpass", "player")).not.toBe(
      resolveInstanceDataFile("/tmp/scoutpass", "scout")
    );
  });

  it("restores persisted data after a new store instance starts", async () => {
    const filePath = await createDataFile();
    const firstRepositories = createJsonRepositories(new JsonFileStore(filePath));
    await firstRepositories.profiles.save(createPlayer());

    const secondRepositories = createJsonRepositories(new JsonFileStore(filePath));
    await expect(secondRepositories.profiles.get("player_demo_emir_yenikale")).resolves.toEqual(
      createPlayer()
    );

    const fileStats = await stat(filePath);
    expect(typeof fileStats.mode).toBe("number");
  });

  it("uses a persistent event ID store for deduplication", async () => {
    const filePath = await createDataFile();
    const first = new EventDeduplicator(new JsonEventIdStore(new JsonFileStore(filePath)));
    await expect(first.accept("event_demo_001")).resolves.toBe(true);

    const second = new EventDeduplicator(new JsonEventIdStore(new JsonFileStore(filePath)));
    await expect(second.accept("event_demo_001")).resolves.toBe(false);
  });

  it("stores relationship events as an append-only deduplicated history", async () => {
    const filePath = await createDataFile();
    const repositories = createJsonRepositories(new JsonFileStore(filePath));
    const event: ProfileReceivedEvent = {
      id: "event_demo_profile_received",
      type: "profile.received",
      senderPublicKey: PUBLIC_KEY,
      createdAt: NOW.toISOString(),
      protocolVersion: PROTOCOL_VERSION,
      payload: {
        packageId: "package_demo_001",
        receivedAt: NOW.toISOString()
      }
    };

    await expect(
      repositories.relationshipEvents.append("relationship_demo_001", event)
    ).resolves.toBe(true);
    await expect(
      repositories.relationshipEvents.append("relationship_demo_001", event)
    ).resolves.toBe(false);
    await expect(repositories.relationshipEvents.list("relationship_demo_001")).resolves.toEqual([
      event
    ]);
  });

  it("fails clearly when JSON data is corrupted", async () => {
    const filePath = await createDataFile();
    await writeFile(filePath, "{not-json", { encoding: "utf8", flag: "w" }).catch(async () => {
      const store = new JsonFileStore(filePath);
      await store.update(() => undefined);
      await writeFile(filePath, "{not-json", "utf8");
    });
    await expect(new JsonFileStore(filePath).read()).rejects.toBeInstanceOf(StorageCorruptionError);
  });

  it("rejects unregistered schema versions instead of guessing a migration", async () => {
    const filePath = await createDataFile();
    const store = new JsonFileStore(filePath);
    await store.update(() => undefined);
    const state = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
    state.schemaVersion = "0.0.1";
    await writeFile(filePath, JSON.stringify(state), "utf8");
    await expect(new JsonFileStore(filePath).read()).rejects.toBeInstanceOf(
      UnsupportedStorageVersionError
    );
  });

  it("rejects wallet metadata containing a seed phrase", async () => {
    const filePath = await createDataFile();
    const repositories = createJsonRepositories(new JsonFileStore(filePath));
    const unsafeWallet = {
      id: "wallet_demo_001",
      ownerRole: "player",
      network: "Ethereum Sepolia",
      chainId: 11155111,
      address: `0x${"1".repeat(40)}`,
      testnetOnly: true,
      seedPhrase: "never store this",
      createdAt: "2026-07-14T10:00:00.000Z",
      updatedAt: "2026-07-14T10:00:00.000Z"
    };

    await expect(repositories.wallets.save(unsafeWallet as never)).rejects.toThrow();
  });
});
