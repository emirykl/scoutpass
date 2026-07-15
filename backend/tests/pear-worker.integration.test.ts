import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { PearRuntimeHost } from "../src/runtime/pear-runtime-host.js";
import { createInvitation } from "./fixtures.js";

const runSmoke = process.env.SCOUTPASS_PEAR_WORKER_SMOKE === "1";
const describeSmoke = runSmoke ? describe : describe.skip;
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describeSmoke("Pear Bare worker IPC and Corestore journal", () => {
  it("validates commands and persists sanitized command/event records", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "scoutpass-pear-worker-"));
    temporaryDirectories.push(dataDir);
    const workerPath = resolve(process.cwd(), "dist/runtime/pear-worker.js");
    const command = {
      requestId: "request_worker_smoke_001",
      sentAt: "2026-07-15T00:00:00.000Z",
      type: "invitation.send" as const,
      payload: createInvitation()
    };
    const event = {
      requestId: command.requestId,
      occurredAt: "2026-07-15T00:00:01.000Z",
      type: "runtime.status" as const,
      payload: {
        status: "ready" as const,
        qvac: "not_checked" as const,
        pears: "not_started" as const,
        wallet: "not_initialized" as const
      }
    };

    const firstHost = new PearRuntimeHost({ dataDir, workerPath });
    const firstReady = await firstHost.start();
    expect(firstReady).toMatchObject({ type: "worker.ready", journalLength: 0 });
    await firstHost.acceptCommand(command);
    await firstHost.recordEvent(event);
    await firstHost.close();

    const secondHost = new PearRuntimeHost({ dataDir, workerPath });
    const secondReady = await secondHost.start();
    expect(secondReady).toMatchObject({ type: "worker.ready", journalLength: 2 });
    await secondHost.close();
  });
});
