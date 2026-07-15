import type {
  RuntimeCommand,
  RuntimeEvent,
  WorkspaceSnapshot
} from "../contracts/runtime-messages.js";
import { workspaceSnapshotSchema } from "../contracts/runtime-messages.js";
import type { PaymentReference } from "../domain/models/wallet.js";
import type { ScoutPassRepositories } from "../application/ports/repositories.js";
import type { LocalDataCounts } from "../application/settings/local-data-maintenance-service.js";
import { TravelSupportPaymentError } from "../application/wallet/travel-support-payment-service.js";

interface PaymentOperations {
  review(invitationId: string): Promise<PaymentReference>;
  confirmAndSend(proposalId: string, userConfirmed: boolean): Promise<PaymentReference>;
  reject(proposalId: string): Promise<PaymentReference>;
  refreshStatus(paymentId: string): Promise<PaymentReference>;
}

interface DataMaintenanceOperations {
  previewClear(): Promise<LocalDataCounts>;
  clear(userConfirmed: boolean): Promise<LocalDataCounts>;
  createSanitizedDebugExport(): Promise<string>;
}

export interface PhaseSevenEightCommandHandlerOptions {
  readonly payments: PaymentOperations;
  readonly maintenance: DataMaintenanceOperations;
  readonly repositories: ScoutPassRepositories;
  readonly now?: () => Date;
}

export class PhaseSevenEightCommandHandler {
  readonly #payments: PaymentOperations;
  readonly #maintenance: DataMaintenanceOperations;
  readonly #repositories: ScoutPassRepositories;
  readonly #now: () => Date;

  public constructor(options: PhaseSevenEightCommandHandlerOptions) {
    this.#payments = options.payments;
    this.#maintenance = options.maintenance;
    this.#repositories = options.repositories;
    this.#now = options.now ?? (() => new Date());
  }

  public async handle(command: RuntimeCommand): Promise<RuntimeEvent | undefined> {
    try {
      switch (command.type) {
        case "payment.review":
          return this.#paymentUpdated(
            command.requestId,
            await this.#payments.review(command.payload.invitationId)
          );
        case "payment.confirm":
          return this.#paymentUpdated(
            command.requestId,
            await this.#payments.confirmAndSend(
              command.payload.proposalId,
              command.payload.userConfirmed
            )
          );
        case "payment.reject":
          return this.#paymentUpdated(
            command.requestId,
            await this.#payments.reject(command.payload.proposalId)
          );
        case "payment.status.get":
          return this.#paymentUpdated(
            command.requestId,
            await this.#payments.refreshStatus(command.payload.paymentId)
          );
        case "workspace.snapshot.get":
          return {
            requestId: command.requestId,
            occurredAt: this.#now().toISOString(),
            type: "workspace.snapshot",
            payload: await this.#createWorkspaceSnapshot()
          };
        case "settings.data.preview":
          return this.#dataPreviewed(
            command.requestId,
            await this.#maintenance.previewClear(),
            false
          );
        case "settings.data.clear":
          return this.#dataPreviewed(
            command.requestId,
            await this.#maintenance.clear(command.payload.userConfirmed),
            true
          );
        case "settings.debug.export":
          return {
            requestId: command.requestId,
            occurredAt: this.#now().toISOString(),
            type: "settings.debug.exported",
            payload: { content: await this.#maintenance.createSanitizedDebugExport() }
          };
        default:
          return undefined;
      }
    } catch (error) {
      return {
        requestId: command.requestId,
        occurredAt: this.#now().toISOString(),
        type: "operation.failed",
        payload: {
          code: error instanceof TravelSupportPaymentError ? error.code : "local_operation_failed",
          message: error instanceof Error ? error.message : "The local operation failed.",
          retryable:
            error instanceof TravelSupportPaymentError && error.code === "wallet_operation_failed"
        }
      };
    }
  }

  async #createWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
    const [profiles, reports, receivedPackages, invitations, wallets, payments, relationships] =
      await Promise.all([
        this.#repositories.profiles.list(),
        this.#repositories.reports.list(),
        this.#repositories.receivedPackages.list(),
        this.#repositories.invitations.list(),
        this.#repositories.wallets.list(),
        this.#repositories.payments.list(),
        this.#repositories.relationships.list()
      ]);
    const activityEvents = (
      await Promise.all(
        relationships.map((relationship) =>
          this.#repositories.relationshipEvents.list(relationship.id)
        )
      )
    ).flat();
    return workspaceSnapshotSchema.parse({
      profiles,
      reports,
      receivedPackages,
      invitations,
      wallets,
      payments,
      activityEvents
    });
  }

  #paymentUpdated(requestId: string, payment: PaymentReference): RuntimeEvent {
    return {
      requestId,
      occurredAt: this.#now().toISOString(),
      type: "payment.updated",
      payload: { payment }
    };
  }

  #dataPreviewed(requestId: string, counts: LocalDataCounts, cleared: boolean): RuntimeEvent {
    return {
      requestId,
      occurredAt: this.#now().toISOString(),
      type: "settings.data.previewed",
      payload: { counts, cleared }
    };
  }
}
