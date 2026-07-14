import { createRequire } from "node:module";
import { join } from "node:path";
import type { Duplex } from "node:stream";

export interface PearRuntimeHostOptions {
  readonly dataDir: string;
  readonly workerPath?: string;
  readonly appName?: string;
  readonly version?: string;
  readonly upgrade?: string;
}

interface PearRuntimeLike {
  ready(): Promise<void>;
  close(): Promise<void>;
  run(path: string, args?: readonly string[]): Duplex;
}

type PearRuntimeConstructor = new (options: {
  dir: string;
  name: string;
  version: string;
  upgrade: string;
  updates: boolean;
}) => PearRuntimeLike;

export class PearRuntimeHost {
  readonly #pear: PearRuntimeLike;
  readonly #workerPath: string;
  #worker: Duplex | undefined;

  public constructor(options: PearRuntimeHostOptions) {
    const require = createRequire(import.meta.url);
    const PearRuntime = require("pear-runtime") as PearRuntimeConstructor;
    this.#pear = new PearRuntime({
      dir: options.dataDir,
      name: options.appName ?? "ScoutPass",
      version: options.version ?? "0.1.0",
      upgrade: options.upgrade ?? "scoutpass-local-dev",
      updates: false
    });
    this.#workerPath = options.workerPath ?? join(import.meta.dirname, "pear-worker.js");
  }

  public async start(): Promise<Duplex> {
    await this.#pear.ready();
    this.#worker = this.#pear.run(this.#workerPath);
    return this.#worker;
  }

  public async close(): Promise<void> {
    this.#worker?.destroy();
    this.#worker = undefined;
    await this.#pear.close();
  }
}
