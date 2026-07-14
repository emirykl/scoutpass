import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { ZodError } from "zod";

import { SCHEMA_VERSION } from "../../domain/constants.js";
import {
  createEmptyLocalDataState,
  type LocalDataState,
  localDataStateSchema
} from "./local-data-state.js";

export class StorageCorruptionError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StorageCorruptionError";
  }
}

export class UnsupportedStorageVersionError extends Error {
  public constructor(version: unknown) {
    super(`Unsupported local data schema version: ${String(version)}.`);
    this.name = "UnsupportedStorageVersionError";
  }
}

type Migration = (input: unknown) => unknown;

const MIGRATIONS: Readonly<Record<string, Migration>> = {};

const migrateToCurrentVersion = (input: unknown): unknown => {
  if (typeof input !== "object" || input === null || !("schemaVersion" in input)) {
    throw new UnsupportedStorageVersionError(undefined);
  }

  let candidate: unknown = input;
  let version = String(input.schemaVersion);
  const visited = new Set<string>();

  while (version !== SCHEMA_VERSION) {
    if (visited.has(version)) {
      throw new UnsupportedStorageVersionError(version);
    }
    visited.add(version);

    const migration = MIGRATIONS[version];
    if (migration === undefined) {
      throw new UnsupportedStorageVersionError(version);
    }
    candidate = migration(candidate);
    if (typeof candidate !== "object" || candidate === null || !("schemaVersion" in candidate)) {
      throw new UnsupportedStorageVersionError(undefined);
    }
    version = String(candidate.schemaVersion);
  }

  return candidate;
};

export class JsonFileStore {
  #state: LocalDataState | undefined;
  #writeQueue: Promise<void> = Promise.resolve();

  public constructor(private readonly filePath: string) {}

  public async read(): Promise<LocalDataState> {
    if (this.#state === undefined) {
      this.#state = await this.#load();
    }
    return structuredClone(this.#state);
  }

  public async update(mutator: (draft: LocalDataState) => void): Promise<LocalDataState> {
    let result: LocalDataState | undefined;

    this.#writeQueue = this.#writeQueue.then(async () => {
      const current = await this.read();
      mutator(current);
      current.updatedAt = new Date().toISOString();
      const validated = localDataStateSchema.parse(current);
      await this.#atomicWrite(validated);
      this.#state = validated;
      result = structuredClone(validated);
    });

    await this.#writeQueue;
    if (result === undefined) {
      throw new Error("Local data update completed without a result.");
    }
    return result;
  }

  public clearMemoryCache(): void {
    this.#state = undefined;
  }

  async #load(): Promise<LocalDataState> {
    let contents: string;
    try {
      contents = await readFile(this.filePath, "utf8");
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return createEmptyLocalDataState();
      }
      throw error;
    }

    try {
      const parsed: unknown = JSON.parse(contents);
      return localDataStateSchema.parse(migrateToCurrentVersion(parsed));
    } catch (error) {
      if (error instanceof UnsupportedStorageVersionError) {
        throw error;
      }
      const detail = error instanceof ZodError ? error.message : "Invalid JSON.";
      throw new StorageCorruptionError(`ScoutPass local data is corrupted. ${detail}`, {
        cause: error
      });
    }
  }

  async #atomicWrite(state: LocalDataState): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp-${process.pid}`;

    try {
      await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600
      });
      await rename(temporaryPath, this.filePath);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }
}

const isNodeError = (error: unknown): error is NodeJS.ErrnoException =>
  error instanceof Error && "code" in error;
