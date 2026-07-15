import { TravelSupportPaymentError } from "../wallet/travel-support-payment-service.js";

export interface UserFacingFailure {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

const PAYMENT_MESSAGES: Readonly<Record<TravelSupportPaymentError["code"], string>> = {
  invitation_not_accepted: "Travel support requires an accepted invitation with a USD₮ amount.",
  address_not_verified: "The player receive address could not be verified for this connection.",
  duplicate_payment: "A travel support payment already exists for this invitation.",
  payment_not_found: "The travel support payment was not found on this device.",
  confirmation_required: "Review and explicit confirmation are required before signing.",
  invalid_payment_state: "This payment cannot continue from its current status.",
  wallet_operation_failed: "The testnet wallet operation failed. Check balances and try again."
};

export const mapErrorToUserFacingFailure = (error: unknown): UserFacingFailure => {
  if (error instanceof TravelSupportPaymentError) {
    return {
      code: error.code,
      message: PAYMENT_MESSAGES[error.code],
      retryable: error.code === "wallet_operation_failed"
    };
  }

  const name = error instanceof Error ? error.name : "";
  switch (name) {
    case "QvacModelLoadError":
      return {
        code: "qvac_model_unavailable",
        message: "The local QVAC model could not be loaded. Check the model installation.",
        retryable: true
      };
    case "InvalidScoutReportOutputError":
      return {
        code: "qvac_invalid_output",
        message: "QVAC did not return a valid scouting report after one retry.",
        retryable: true
      };
    case "PeerPayloadValidationError":
    case "EventFreshnessError":
      return {
        code: "peer_payload_rejected",
        message: "A peer message was rejected because it failed protocol validation.",
        retryable: false
      };
    case "StorageCorruptionError":
    case "UnsupportedStorageVersionError":
      return {
        code: "local_storage_unavailable",
        message: "Local ScoutPass data could not be opened safely.",
        retryable: false
      };
    case "WalletInitializationError":
      return {
        code: "wallet_initialization_failed",
        message: "The self-custodial testnet wallet could not be initialized.",
        retryable: true
      };
    case "WalletBalanceQueryError":
      return {
        code: "wallet_balance_unavailable",
        message: "The test USD₮ balance could not be read from Sepolia.",
        retryable: true
      };
    default:
      return {
        code: "local_operation_failed",
        message: "The local operation could not be completed safely.",
        retryable: false
      };
  }
};
