import type {
  RelationshipEventLogRepository,
  Repository,
  ScoutPassRepositories
} from "../../application/ports/repositories.js";
import type { ScoutPassEvent } from "../../domain/models/events.js";
import type { EventIdStore } from "../../domain/services/event-deduplicator.js";
import type { JsonFileStore } from "./json-file-store.js";
import type { CollectionName, LocalDataState } from "./local-data-state.js";

type EntityCollectionName = CollectionName;
type EntityFor<K extends EntityCollectionName> = LocalDataState[K][string];

class JsonEntityRepository<K extends EntityCollectionName> implements Repository<EntityFor<K>> {
  public constructor(
    private readonly store: JsonFileStore,
    private readonly collectionName: K,
    private readonly getId: (entity: EntityFor<K>) => string
  ) {}

  public async get(id: string): Promise<EntityFor<K> | undefined> {
    const state = await this.store.read();
    const collection = state[this.collectionName] as Record<string, EntityFor<K>>;
    const entity = collection[id];
    return entity === undefined ? undefined : structuredClone(entity);
  }

  public async list(): Promise<readonly EntityFor<K>[]> {
    const state = await this.store.read();
    const collection = state[this.collectionName] as Record<string, EntityFor<K>>;
    return Object.values(collection).map((entity) => structuredClone(entity));
  }

  public async save(entity: EntityFor<K>): Promise<void> {
    const id = this.getId(entity);
    await this.store.update((state) => {
      const collection = state[this.collectionName] as Record<string, EntityFor<K>>;
      collection[id] = structuredClone(entity);
    });
  }

  public async delete(id: string): Promise<boolean> {
    let existed = false;
    await this.store.update((state) => {
      const collection = state[this.collectionName] as Record<string, EntityFor<K>>;
      existed = id in collection;
      delete collection[id];
    });
    return existed;
  }
}

export class JsonEventIdStore implements EventIdStore {
  public constructor(private readonly store: JsonFileStore) {}

  public async has(eventId: string): Promise<boolean> {
    const state = await this.store.read();
    return state.processedEventIds.includes(eventId);
  }

  public async add(eventId: string): Promise<void> {
    await this.store.update((state) => {
      if (!state.processedEventIds.includes(eventId)) {
        state.processedEventIds.push(eventId);
      }
    });
  }
}

export class JsonRelationshipEventLogRepository implements RelationshipEventLogRepository {
  public constructor(private readonly store: JsonFileStore) {}

  public async append(relationshipId: string, event: ScoutPassEvent): Promise<boolean> {
    let appended = false;
    await this.store.update((state) => {
      if (state.processedEventIds.includes(event.id)) {
        return;
      }
      state.relationshipEvents[relationshipId] ??= [];
      state.relationshipEvents[relationshipId].push(structuredClone(event));
      state.processedEventIds.push(event.id);
      appended = true;
    });
    return appended;
  }

  public async list(relationshipId: string): Promise<readonly ScoutPassEvent[]> {
    const state = await this.store.read();
    return structuredClone(state.relationshipEvents[relationshipId] ?? []);
  }
}

export const createJsonRepositories = (store: JsonFileStore): ScoutPassRepositories => ({
  profiles: new JsonEntityRepository(store, "profiles", (entity) => entity.id),
  reports: new JsonEntityRepository(store, "reports", (entity) => entity.id),
  sharePreferences: new JsonEntityRepository(store, "sharePreferences", (entity) => entity.id),
  relationships: new JsonEntityRepository(store, "relationships", (entity) => entity.id),
  receivedPackages: new JsonEntityRepository(
    store,
    "receivedPackages",
    (entity) => entity.packageId
  ),
  invitations: new JsonEntityRepository(store, "invitations", (entity) => entity.id),
  scoutPrivateNotes: new JsonEntityRepository(store, "scoutPrivateNotes", (entity) => entity.id),
  wallets: new JsonEntityRepository(store, "wallets", (entity) => entity.id),
  payments: new JsonEntityRepository(store, "payments", (entity) => entity.id),
  relationshipEvents: new JsonRelationshipEventLogRepository(store)
});
