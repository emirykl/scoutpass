import type { ScoutPassEvent } from "../../domain/models/events.js";
import type { PlayerProfile } from "../../domain/models/player-profile.js";
import type { ScoutReport } from "../../domain/models/scout-report.js";
import type {
  PaymentProposal,
  PaymentReference,
  WalletPublicMetadata
} from "../../domain/models/wallet.js";

export type IntegrationStatus = "not_initialized" | "loading" | "ready" | "error";

export interface LocalReportGenerator {
  getStatus(): Promise<IntegrationStatus>;
  generate(player: PlayerProfile): Promise<ScoutReport>;
  dispose(): Promise<void>;
}

export interface PeerConnection {
  readonly relationshipId: string;
  readonly remotePublicKey?: string;
  send(event: ScoutPassEvent): Promise<void>;
  close(): Promise<void>;
}

export interface PeerTransport {
  createInvite(relationshipId: string): Promise<string>;
  connect(invite: string): Promise<PeerConnection>;
  onEvent(listener: (event: ScoutPassEvent) => Promise<void>): () => void;
  dispose(): Promise<void>;
}

export interface WalletGateway {
  initialize(ownerRole: "player" | "scout"): Promise<WalletPublicMetadata>;
  getTokenBalance(address: string): Promise<string>;
  quoteTransfer(proposal: PaymentProposal): Promise<{ readonly feeBaseUnits: string }>;
  confirmAndSend(proposal: PaymentProposal): Promise<PaymentReference>;
  dispose(): Promise<void>;
}
