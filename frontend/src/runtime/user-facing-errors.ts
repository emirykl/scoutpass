import type { RuntimeEvent } from "@scoutpass/backend/contracts";

type OperationFailure = Extract<RuntimeEvent, { readonly type: "operation.failed" }>["payload"];

const FAILURE_MESSAGES: Readonly<Record<string, string>> = {
  invitation_not_accepted: "Travel support requires an accepted invitation with an spUSD amount.",
  address_not_verified: "The player receive address could not be verified for this connection.",
  duplicate_payment: "A travel support payment already exists for this invitation.",
  payment_not_found: "The travel support payment was not found on this device.",
  confirmation_required: "Review and explicit confirmation are required before signing.",
  invalid_payment_state: "This payment cannot continue from its current status.",
  wallet_operation_failed: "The testnet wallet operation failed. Check balances and try again.",
  wallet_initialization_failed: "The self-custodial testnet wallet could not be initialized.",
  wallet_balance_unavailable: "The spUSD balance could not be read from Sepolia.",
  qvac_model_unavailable: "The local QVAC model could not be loaded.",
  qvac_invalid_output: "QVAC did not return a valid scouting report after one retry.",
  peer_payload_rejected: "A peer message was rejected because it failed validation.",
  local_storage_unavailable: "Local ScoutPass data could not be opened safely.",
  local_operation_failed: "The local operation could not be completed safely."
};

export class UserFacingError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

export const runtimeFailureError = (failure: OperationFailure, fallback: string): UserFacingError =>
  new UserFacingError(FAILURE_MESSAGES[failure.code] ?? fallback);

export const toUserFacingMessage = (error: unknown, fallback: string): string => {
  if (error instanceof UserFacingError || isDesktopRuntimeUnavailable(error)) {
    return error.message;
  }
  return fallback;
};

const isDesktopRuntimeUnavailable = (error: unknown): error is Error =>
  error instanceof Error && error.name === "DesktopRuntimeUnavailableError";
