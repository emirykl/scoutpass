const readyMessage = `${JSON.stringify({
  type: "worker.ready",
  runtime: "pear-bare",
  protocolVersion: "1.0.0"
})}\n`;

const bare = globalThis as typeof globalThis & {
  Bare?: {
    IPC?: {
      write(data: string): void;
      on(event: "data", listener: (data: Uint8Array) => void): void;
    };
  };
};

bare.Bare?.IPC?.write(readyMessage);

export const PEAR_WORKER_READY_MESSAGE = readyMessage;
