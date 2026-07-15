import Corestore from "corestore";
import b4a from "b4a";

import { PROTOCOL_VERSION } from "../domain/constants.js";
import {
  pearAuditRecordSchema,
  pearWorkerRequestSchema,
  type PearAuditRecord,
  type PearWorkerResponse
} from "./pear-worker-protocol.js";

const MAX_IPC_MESSAGE_BYTES = 256 * 1024;

interface BareIpc {
  write(data: string): void;
  on(event: "data", listener: (data: Uint8Array) => void): void;
  on(event: "close", listener: () => void): void;
}

const bare = globalThis as typeof globalThis & {
  Bare?: {
    argv?: readonly string[];
    IPC?: BareIpc;
  };
};

const ipc = bare.Bare?.IPC;

const writeMessage = (message: PearWorkerResponse): void => {
  ipc?.write(`${JSON.stringify(message)}\n`);
};

const startWorker = async (): Promise<void> => {
  if (ipc === undefined) return;

  const storagePath = bare.Bare?.argv?.[2];
  if (storagePath === undefined || storagePath.length === 0) {
    writeMessage({ type: "runtime.message.rejected", message: "Worker storage path is missing." });
    return;
  }

  const store = new Corestore(storagePath);
  await store.ready();
  const journal = store.get<PearAuditRecord>({
    name: "scoutpass-runtime-audit-v1",
    valueEncoding: "json"
  });
  await journal.ready();

  writeMessage({
    type: "worker.ready",
    runtime: "pear-bare",
    protocolVersion: PROTOCOL_VERSION,
    journalLength: journal.length
  });

  let buffered = b4a.alloc(0);
  let queue = Promise.resolve();
  let closed = false;

  ipc.on("data", (data) => {
    buffered = b4a.concat([buffered, data]);
    if (buffered.byteLength > MAX_IPC_MESSAGE_BYTES) {
      buffered = b4a.alloc(0);
      writeMessage({ type: "runtime.message.rejected", message: "IPC message is too large." });
      return;
    }

    let newlineIndex = b4a.indexOf(buffered, 10);
    while (newlineIndex !== -1) {
      const line = b4a.toString(buffered.subarray(0, newlineIndex));
      buffered = buffered.subarray(newlineIndex + 1);
      if (line.trim().length > 0) {
        queue = queue
          .then(async () => {
            let candidate: unknown;
            try {
              candidate = JSON.parse(line);
            } catch {
              writeMessage({
                type: "runtime.message.rejected",
                message: "IPC message is invalid."
              });
              return;
            }

            const parsed = pearWorkerRequestSchema.safeParse(candidate);
            if (!parsed.success) {
              const requestId = readRequestId(candidate);
              writeMessage({
                type: "runtime.message.rejected",
                ...(requestId === undefined ? {} : { requestId }),
                message: "IPC message failed validation."
              });
              return;
            }

            if (parsed.data.type === "worker.shutdown") {
              closed = true;
              await journal.close();
              await store.close();
              writeMessage({ type: "worker.closed" });
              return;
            }

            if (parsed.data.type === "runtime.command") {
              const record = pearAuditRecordSchema.parse({
                kind: "command",
                requestId: parsed.data.command.requestId,
                messageType: parsed.data.command.type,
                timestamp: parsed.data.command.sentAt
              });
              await journal.append(record);
              writeMessage({
                type: "runtime.command.accepted",
                requestId: record.requestId,
                commandType: record.messageType,
                journalLength: journal.length
              });
              return;
            }

            const record = pearAuditRecordSchema.parse({
              kind: "event",
              requestId: parsed.data.event.requestId,
              messageType: parsed.data.event.type,
              timestamp: parsed.data.event.occurredAt
            });
            await journal.append(record);
            writeMessage({
              type: "runtime.event.recorded",
              requestId: record.requestId,
              eventType: record.messageType,
              journalLength: journal.length
            });
          })
          .catch(() => {
            writeMessage({ type: "runtime.message.rejected", message: "Worker journal failed." });
          });
      }
      newlineIndex = b4a.indexOf(buffered, 10);
    }
  });

  ipc.on("close", () => {
    void queue.finally(async () => {
      if (closed) return;
      await journal.close();
      await store.close();
    });
  });
};

const readRequestId = (candidate: unknown): string | undefined => {
  if (typeof candidate !== "object" || candidate === null) return undefined;
  const container = candidate as { command?: unknown; event?: unknown };
  const payload = container.command ?? container.event;
  if (typeof payload !== "object" || payload === null || !("requestId" in payload))
    return undefined;
  const requestId = (payload as { requestId?: unknown }).requestId;
  return typeof requestId === "string" ? requestId : undefined;
};

void startWorker().catch(() => {
  writeMessage({ type: "runtime.message.rejected", message: "Worker failed to start." });
});
