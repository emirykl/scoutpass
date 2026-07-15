import { createRequire } from "node:module";
import { join } from "node:path";
import type { Duplex } from "node:stream";

import type { RuntimeCommand, RuntimeEvent } from "../contracts/runtime-messages.js";
import {
  pearWorkerResponseSchema,
  type PearWorkerRequest,
  type PearWorkerResponse
} from "./pear-worker-protocol.js";

export interface PearRuntimeHostOptions {
  readonly dataDir: string;
  readonly workerPath?: string;
  readonly requestTimeoutMs?: number;
}

interface PearRuntimeStatic {
  run(path: string, args?: readonly string[]): Duplex;
}

interface PendingRequest {
  readonly resolve: (response: PearWorkerResponse) => void;
  readonly reject: (error: Error) => void;
  readonly timeout: NodeJS.Timeout;
  readonly expectedType:
    "worker.ready" | "worker.closed" | "runtime.command.accepted" | "runtime.event.recorded";
}

export class PearRuntimeHost {
  readonly #dataDir: string;
  readonly #workerPath: string;
  readonly #requestTimeoutMs: number;
  readonly #pending = new Map<string, PendingRequest>();
  #worker: Duplex | undefined;
  #buffered = "";
  #ready: Promise<PearWorkerResponse> | undefined;

  public constructor(options: PearRuntimeHostOptions) {
    this.#dataDir = options.dataDir;
    this.#workerPath = options.workerPath ?? join(import.meta.dirname, "pear-worker.js");
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
  }

  public async start(): Promise<PearWorkerResponse> {
    if (this.#ready !== undefined) return this.#ready;

    const require = createRequire(import.meta.url);
    const PearRuntime = require("pear-runtime") as PearRuntimeStatic;
    this.#worker = PearRuntime.run(this.#workerPath, [join(this.#dataDir, "corestore")]);
    this.#worker.setEncoding("utf8");
    this.#worker.on("data", (chunk: string) => this.#onData(chunk));
    this.#worker.on("error", (error) => this.#rejectAll(error));
    this.#worker.on("close", () => this.#rejectAll(new Error("Pear worker IPC closed.")));
    this.#ready = this.#waitFor("worker.ready", "worker.ready");
    return this.#ready;
  }

  public async acceptCommand(command: RuntimeCommand): Promise<void> {
    await this.start();
    const response = await this.#sendAndWait(
      { type: "runtime.command", command },
      command.requestId,
      "runtime.command.accepted"
    );
    if (response.type !== "runtime.command.accepted" || response.commandType !== command.type) {
      throw new Error("Pear worker returned an unexpected command acknowledgement.");
    }
  }

  public async recordEvent(event: RuntimeEvent): Promise<void> {
    await this.start();
    const response = await this.#sendAndWait(
      { type: "runtime.event", event },
      event.requestId,
      "runtime.event.recorded"
    );
    if (response.type !== "runtime.event.recorded" || response.eventType !== event.type) {
      throw new Error("Pear worker returned an unexpected event acknowledgement.");
    }
  }

  public async close(): Promise<void> {
    const worker = this.#worker;
    if (worker !== undefined && !worker.destroyed) {
      const closed = this.#waitFor("worker.closed", "worker.closed");
      worker.write(`${JSON.stringify({ type: "worker.shutdown" } satisfies PearWorkerRequest)}\n`);
      await closed.catch(() => undefined);
    }
    this.#rejectAll(new Error("Pear runtime host is closing."));
    worker?.destroy();
    this.#worker = undefined;
    this.#ready = undefined;
    this.#buffered = "";
  }

  #sendAndWait(
    request: PearWorkerRequest,
    requestId: string,
    expectedType: PendingRequest["expectedType"]
  ): Promise<PearWorkerResponse> {
    const worker = this.#worker;
    if (worker === undefined) throw new Error("Pear worker is not running.");
    if (this.#pending.has(requestId)) throw new Error("Duplicate Pear worker request ID.");

    const response = new Promise<PearWorkerResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(requestId);
        reject(new Error("Pear worker IPC timed out."));
      }, this.#requestTimeoutMs);
      this.#pending.set(requestId, { resolve, reject, timeout, expectedType });
    });
    worker.write(`${JSON.stringify(request)}\n`);
    return response;
  }

  #waitFor(key: string, expectedType: PendingRequest["expectedType"]) {
    return new Promise<PearWorkerResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(key);
        reject(new Error("Pear worker did not become ready."));
      }, this.#requestTimeoutMs);
      this.#pending.set(key, {
        resolve,
        reject,
        timeout,
        expectedType
      });
    });
  }

  #onData(chunk: string): void {
    this.#buffered += chunk;
    const lines = this.#buffered.split("\n");
    this.#buffered = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim().length === 0) continue;
      let candidate: unknown;
      try {
        candidate = JSON.parse(line);
      } catch {
        continue;
      }
      const parsed = pearWorkerResponseSchema.safeParse(candidate);
      if (!parsed.success) continue;
      const response = parsed.data;
      const key =
        response.type === "worker.ready"
          ? "worker.ready"
          : response.type === "worker.closed"
            ? "worker.closed"
            : response.requestId;
      if (key === undefined) continue;
      const pending = this.#pending.get(key);
      if (pending === undefined) continue;
      if (response.type === "runtime.message.rejected") {
        clearTimeout(pending.timeout);
        this.#pending.delete(key);
        pending.reject(new Error(response.message));
        continue;
      }
      if (response.type !== pending.expectedType) continue;
      clearTimeout(pending.timeout);
      this.#pending.delete(key);
      pending.resolve(response);
    }
  }

  #rejectAll(error: Error): void {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.#pending.clear();
  }
}
