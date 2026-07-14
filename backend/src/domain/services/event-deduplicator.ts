export interface EventIdStore {
  has(eventId: string): Promise<boolean>;
  add(eventId: string): Promise<void>;
}

export class EventDeduplicator {
  public constructor(private readonly store: EventIdStore) {}

  public async accept(eventId: string): Promise<boolean> {
    if (await this.store.has(eventId)) {
      return false;
    }

    await this.store.add(eventId);
    return true;
  }
}

export class InMemoryEventIdStore implements EventIdStore {
  readonly #ids = new Set<string>();

  public has(eventId: string): Promise<boolean> {
    return Promise.resolve(this.#ids.has(eventId));
  }

  public add(eventId: string): Promise<void> {
    this.#ids.add(eventId);
    return Promise.resolve();
  }
}
