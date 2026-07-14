import type { PlayerProfile } from "../../domain/models/player-profile.js";
import type { ScoutingRelationship } from "../../domain/models/relationship.js";
import type { StoredScoutReport } from "../../domain/models/scout-report.js";
import type { SharedPlayerPackage, SharePreference } from "../../domain/models/sharing.js";
import type { TryoutInvitation } from "../../domain/models/invitation.js";
import type { PaymentReference, WalletPublicMetadata } from "../../domain/models/wallet.js";

export interface Repository<T> {
  get(id: string): Promise<T | undefined>;
  list(): Promise<readonly T[]>;
  save(entity: T): Promise<void>;
  delete(id: string): Promise<boolean>;
}

export type PlayerProfileRepository = Repository<PlayerProfile>;
export type ScoutReportRepository = Repository<StoredScoutReport>;
export type SharePreferenceRepository = Repository<SharePreference>;
export type RelationshipRepository = Repository<ScoutingRelationship>;
export type SharedPackageRepository = Repository<SharedPlayerPackage>;
export type InvitationRepository = Repository<TryoutInvitation>;
export type WalletMetadataRepository = Repository<WalletPublicMetadata>;
export type PaymentReferenceRepository = Repository<PaymentReference>;

export interface ScoutPassRepositories {
  readonly profiles: PlayerProfileRepository;
  readonly reports: ScoutReportRepository;
  readonly sharePreferences: SharePreferenceRepository;
  readonly relationships: RelationshipRepository;
  readonly receivedPackages: SharedPackageRepository;
  readonly invitations: InvitationRepository;
  readonly wallets: WalletMetadataRepository;
  readonly payments: PaymentReferenceRepository;
}
