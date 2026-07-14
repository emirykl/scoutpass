import {
  runtimeCommandSchema,
  runtimeEventSchema,
  type RuntimeCommand,
  type RuntimeEvent
} from "@scoutpass/backend/contracts";

interface DesktopRuntimeApi {
  request(command: RuntimeCommand): Promise<unknown>;
  subscribe(listener: (event: unknown) => void): () => void;
}

declare global {
  interface Window {
    scoutpassRuntime?: DesktopRuntimeApi;
  }
}

export class DesktopRuntimeUnavailableError extends Error {
  public constructor() {
    super("ScoutPass desktop runtime is not available in this browser preview.");
    this.name = "DesktopRuntimeUnavailableError";
  }
}

export const isDesktopRuntimeAvailable = (): boolean => window.scoutpassRuntime !== undefined;

export const requestRuntime = async (command: RuntimeCommand): Promise<RuntimeEvent> => {
  const runtime = window.scoutpassRuntime;
  if (runtime === undefined) {
    throw new DesktopRuntimeUnavailableError();
  }

  const validatedCommand = runtimeCommandSchema.parse(command);
  return runtimeEventSchema.parse(await runtime.request(validatedCommand));
};

export const subscribeRuntimeEvents = (listener: (event: RuntimeEvent) => void): (() => void) => {
  const runtime = window.scoutpassRuntime;
  if (runtime === undefined) {
    return () => undefined;
  }

  return runtime.subscribe((candidate) => {
    const result = runtimeEventSchema.safeParse(candidate);
    if (result.success) {
      listener(result.data);
    }
  });
};

export const createRuntimeRequest = () => ({
  requestId: `request_${globalThis.crypto.randomUUID()}`,
  sentAt: new Date().toISOString()
});
