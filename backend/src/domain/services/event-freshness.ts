import type { ScoutPassEvent } from "../models/events.js";

export class EventFreshnessError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EventFreshnessError";
  }
}

export interface EventFreshnessOptions {
  readonly now?: Date;
  readonly maxAgeMs?: number;
  readonly maxFutureSkewMs?: number;
}

export const assertEventIsFresh = (
  event: Pick<ScoutPassEvent, "createdAt">,
  options: EventFreshnessOptions = {}
): void => {
  const now = (options.now ?? new Date()).getTime();
  const createdAt = Date.parse(event.createdAt);
  const maxAgeMs = options.maxAgeMs ?? 7 * 24 * 60 * 60 * 1_000;
  const maxFutureSkewMs = options.maxFutureSkewMs ?? 5 * 60 * 1_000;

  if (createdAt < now - maxAgeMs) {
    throw new EventFreshnessError("P2P event is too old and may be a replay.");
  }
  if (createdAt > now + maxFutureSkewMs) {
    throw new EventFreshnessError("P2P event timestamp is too far in the future.");
  }
};
