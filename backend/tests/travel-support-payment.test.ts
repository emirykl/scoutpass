import { describe, expect, it } from "vitest";

import type { ScoutingConnectionService } from "../src/application/connections/scouting-connection-service.js";
import type { WalletGateway } from "../src/application/ports/integrations.js";
import type { RelationshipEventLogRepository } from "../src/application/ports/repositories.js";
import {
  TravelSupportPaymentError,
  TravelSupportPaymentService
} from "../src/application/wallet/travel-support-payment-service.js";
import { PROTOCOL_VERSION, TESTNET_CONFIG } from "../src/domain/constants.js";
import type { ScoutPassEvent } from "../src/domain/models/events.js";
import type { TryoutInvitation } from "../src/domain/models/invitation.js";
import type {
  PaymentProposal,
  PaymentReference,
  WalletPublicMetadata
} from "../src/domain/models/wallet.js";
import { createInvitation, NOW, PUBLIC_KEY } from "./fixtures.js";

class MemoryRepository<T extends { readonly id: string }> {
  readonly values = new Map<string, T>();
  public get(id: string): Promise<T | undefined> {
    const value = this.values.get(id);
    return Promise.resolve(value === undefined ? undefined : structuredClone(value));
  }
  public list(): Promise<readonly T[]> {
    return Promise.resolve([...this.values.values()].map((value) => structuredClone(value)));
  }
  public save(entity: T): Promise<void> {
    this.values.set(entity.id, structuredClone(entity));
    return Promise.resolve();
  }
  public delete(id: string): Promise<boolean> {
    return Promise.resolve(this.values.delete(id));
  }
}

class MemoryEventLog implements RelationshipEventLogRepository {
  readonly events = new Map<string, ScoutPassEvent[]>();
  public append(relationshipId: string, event: ScoutPassEvent): Promise<boolean> {
    this.events.set(relationshipId, [...(this.events.get(relationshipId) ?? []), event]);
    return Promise.resolve(true);
  }
  public list(relationshipId: string): Promise<readonly ScoutPassEvent[]> {
    return Promise.resolve(structuredClone(this.events.get(relationshipId) ?? []));
  }
}

class FakeConnectionService {
  readonly sent: ScoutPassEvent[] = [];
  readonly listeners = new Set<(event: ScoutPassEvent, relationshipId: string) => Promise<void>>();
  public onIncomingEvent(
    listener: (event: ScoutPassEvent, relationshipId: string) => Promise<void>
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  public sendEvent(_relationshipId: string, event: ScoutPassEvent): Promise<void> {
    this.sent.push(structuredClone(event));
    return Promise.resolve();
  }
}

class FakeWalletGateway implements WalletGateway {
  public sendCount = 0;
  public sendError: Error | undefined;
  public initialize(): Promise<WalletPublicMetadata> {
    throw new Error("not needed");
  }
  public getTokenBalance(): Promise<string> {
    throw new Error("not needed");
  }
  public quoteTransfer(): Promise<{ readonly feeBaseUnits: string }> {
    return Promise.resolve({ feeBaseUnits: "21000000000000" });
  }
  public confirmAndSend(proposal: PaymentProposal): Promise<PaymentReference> {
    this.sendCount += 1;
    if (this.sendError !== undefined) return Promise.reject(this.sendError);
    return Promise.resolve({
      ...proposal,
      status: "pending",
      transactionId: `0x${"2".repeat(64)}`,
      updatedAt: NOW.toISOString()
    });
  }
  public getTransferStatus(payment: PaymentReference): Promise<PaymentReference> {
    return Promise.resolve({ ...payment, status: "confirmed", updatedAt: NOW.toISOString() });
  }
  public dispose(): Promise<void> {
    return Promise.resolve();
  }
}

const PLAYER_WALLET: WalletPublicMetadata = {
  id: "wallet_player_demo",
  ownerRole: "player",
  network: TESTNET_CONFIG.network,
  chainId: TESTNET_CONFIG.chainId,
  address: `0x${"1".repeat(40)}`,
  testnetOnly: true,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString()
};

const setup = async () => {
  const invitations = new MemoryRepository<TryoutInvitation>();
  const payments = new MemoryRepository<PaymentReference>();
  const events = new MemoryEventLog();
  const connection = new FakeConnectionService();
  const gateway = new FakeWalletGateway();
  const invitation = createInvitation({ status: "accepted" });
  await invitations.save(invitation);
  await events.append(invitation.relationshipId, {
    id: "event_wallet_shared_demo",
    type: "wallet.address_shared",
    senderPublicKey: PUBLIC_KEY,
    createdAt: NOW.toISOString(),
    protocolVersion: PROTOCOL_VERSION,
    payload: { relationshipId: invitation.relationshipId, wallet: PLAYER_WALLET }
  });
  const service = new TravelSupportPaymentService({
    gateway,
    connectionService: connection as unknown as ScoutingConnectionService,
    invitations,
    payments,
    relationshipEvents: events,
    senderPublicKey: "b".repeat(64),
    now: () => NOW
  });
  return { connection, gateway, invitation, payments, service };
};

describe("travel support payment", () => {
  it("reviews an accepted invitation without signing and prevents duplicate attempts", async () => {
    const { connection, gateway, invitation, service } = await setup();
    const proposal = await service.review(invitation.id);
    expect(proposal).toMatchObject({
      invitationId: invitation.id,
      relationshipId: invitation.relationshipId,
      destinationAddress: PLAYER_WALLET.address,
      amount: invitation.travelSupportAmount,
      feeBaseUnits: "21000000000000",
      status: "proposed"
    });
    expect(gateway.sendCount).toBe(0);
    expect(connection.sent.at(-1)?.type).toBe("travel_support.proposed");
    await expect(service.review(invitation.id)).rejects.toMatchObject({
      code: "duplicate_payment"
    });
  });

  it("requires explicit confirmation before calling WDK and returns the real hash", async () => {
    const { connection, gateway, invitation, service } = await setup();
    const proposal = await service.review(invitation.id);
    await expect(service.confirmAndSend(proposal.id, false)).rejects.toBeInstanceOf(
      TravelSupportPaymentError
    );
    expect(gateway.sendCount).toBe(0);

    const pending = await service.confirmAndSend(proposal.id, true);
    expect(gateway.sendCount).toBe(1);
    expect(pending).toMatchObject({
      status: "pending",
      transactionId: `0x${"2".repeat(64)}`
    });
    expect(connection.sent.at(-1)).toMatchObject({
      type: "travel_support.sent",
      payload: { payment: pending }
    });
  });

  it("moves a broadcast transaction to confirmed using the network receipt", async () => {
    const { invitation, service } = await setup();
    const proposal = await service.review(invitation.id);
    const pending = await service.confirmAndSend(proposal.id, true);
    await expect(service.refreshStatus(pending.id)).resolves.toMatchObject({
      status: "confirmed",
      transactionId: pending.transactionId
    });
  });

  it("rejects an unsigned proposal without calling the wallet gateway", async () => {
    const { gateway, invitation, service } = await setup();
    const proposal = await service.review(invitation.id);

    await expect(service.reject(proposal.id)).resolves.toMatchObject({ status: "rejected" });
    expect(gateway.sendCount).toBe(0);
    await expect(service.confirmAndSend(proposal.id, true)).rejects.toMatchObject({
      code: "invalid_payment_state"
    });
  });

  it("stores insufficient balance as failed without fabricating a transaction hash", async () => {
    const { gateway, invitation, payments, service } = await setup();
    gateway.sendError = new Error("insufficient funds for gas");
    const proposal = await service.review(invitation.id);

    await expect(service.confirmAndSend(proposal.id, true)).rejects.toMatchObject({
      code: "wallet_operation_failed"
    });
    expect(await payments.get(proposal.id)).toMatchObject({
      status: "failed",
      failureReason: "Insufficient spUSD or Sepolia ETH balance for this transaction."
    });
    expect((await payments.get(proposal.id))?.transactionId).toBeUndefined();
  });
});
