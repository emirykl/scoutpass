import { z } from "zod";

import { SCHEMA_VERSION } from "../../domain/constants.js";
import type { JsonFileStore } from "../../infrastructure/storage/json-file-store.js";

const maintenanceDataCountsSchema = z
  .object({
    profiles: z.number().int().nonnegative(),
    reports: z.number().int().nonnegative(),
    relationships: z.number().int().nonnegative(),
    receivedPackages: z.number().int().nonnegative(),
    invitations: z.number().int().nonnegative(),
    scoutPrivateNotes: z.number().int().nonnegative(),
    wallets: z.number().int().nonnegative(),
    payments: z.number().int().nonnegative(),
    relationshipEvents: z.number().int().nonnegative()
  })
  .strict();

export type LocalDataCounts = z.infer<typeof maintenanceDataCountsSchema>;

export class LocalDataMaintenanceService {
  public constructor(private readonly store: JsonFileStore) {}

  public async previewClear(): Promise<LocalDataCounts> {
    const state = await this.store.read();
    return maintenanceDataCountsSchema.parse({
      profiles: Object.keys(state.profiles).length,
      reports: Object.keys(state.reports).length,
      relationships: Object.keys(state.relationships).length,
      receivedPackages: Object.keys(state.receivedPackages).length,
      invitations: Object.keys(state.invitations).length,
      scoutPrivateNotes: Object.keys(state.scoutPrivateNotes).length,
      wallets: Object.keys(state.wallets).length,
      payments: Object.keys(state.payments).length,
      relationshipEvents: Object.values(state.relationshipEvents).reduce(
        (total, events) => total + events.length,
        0
      )
    });
  }

  public async clear(userConfirmed: boolean): Promise<LocalDataCounts> {
    if (!userConfirmed) throw new Error("Explicit confirmation is required to clear local data.");
    const previous = await this.previewClear();
    await this.store.clear();
    return previous;
  }

  public async createSanitizedDebugExport(): Promise<string> {
    const state = await this.store.read();
    const counts = await this.previewClear();
    const relationshipEvents = Object.entries(state.relationshipEvents).flatMap(
      ([relationshipId, events]) =>
        events.map((event) => ({
          relationshipId,
          id: event.id,
          type: event.type,
          createdAt: event.createdAt,
          protocolVersion: event.protocolVersion
        }))
    );
    return JSON.stringify(
      {
        schemaVersion: SCHEMA_VERSION,
        updatedAt: state.updatedAt,
        counts,
        relationships: Object.values(state.relationships).map((relationship) => ({
          id: relationship.id,
          localRole: relationship.localRole,
          status: relationship.status,
          createdAt: relationship.createdAt,
          updatedAt: relationship.updatedAt
        })),
        wallets: Object.values(state.wallets).map((wallet) => ({
          id: wallet.id,
          ownerRole: wallet.ownerRole,
          network: wallet.network,
          chainId: wallet.chainId,
          addressSuffix: wallet.address.slice(-6),
          testnetOnly: wallet.testnetOnly
        })),
        payments: Object.values(state.payments).map((payment) => ({
          id: payment.id,
          invitationId: payment.invitationId,
          relationshipId: payment.relationshipId,
          status: payment.status,
          network: payment.network,
          asset: payment.asset,
          updatedAt: payment.updatedAt
        })),
        relationshipEvents
      },
      null,
      2
    );
  }
}
