# ScoutPass privacy model

ScoutPass is local-first, not anonymous and not an identity-verification service. This document
describes the MVP data paths.

## Data inventory

| Data                                          | Created by              | Stored at rest                            | Shared by default                    |
| --------------------------------------------- | ----------------------- | ----------------------------------------- | ------------------------------------ |
| Football profile and self-reported statistics | Player                  | Player JSON repository                    | No                                   |
| Contact details                               | Player                  | Player JSON repository                    | No                                   |
| QVAC prompt/report                            | Player local runtime    | Player repository/model memory            | No                                   |
| Share selection                               | Player                  | Player repository                         | Only the resulting selected package  |
| Received package                              | Player approval / Pears | Scout JSON repository                     | N/A                                  |
| Scout private assessment                      | Scout                   | Scout JSON repository                     | Never                                |
| Tryout invitation and response                | Scout / Player          | Both role repositories and event history  | Yes, only within relationship        |
| Public wallet address                         | WDK / Player            | Public metadata repository                | Only after Player approval           |
| Seed phrase/private key                       | WDK                     | macOS Keychain and wallet process memory  | Never                                |
| Payment amount/hash/status                    | Scout WDK / Sepolia     | Both role repositories; public blockchain | Yes and publicly observable on-chain |
| Relationship topic/public keys                | Pears                   | Relationship/Pear-managed local state     | Invite/peer only                     |

## What leaves the device

### QVAC

After the model is cached, inference inputs and outputs stay on the Player device. The initial model
download uses the QVAC registry source. ScoutPass has no cloud AI endpoint or API key.

### Pears

Only explicitly selected profile sections, invitation events, Player-approved public wallet metadata,
and payment status events travel to the connected peer. No ScoutPass central database receives them.
P2P does not mean the remote recipient cannot retain what the Player approved.

### Sepolia

Public wallet addresses, token transfers, amount, and transaction status are visible through the
public Sepolia blockchain/RPC. A seed phrase or private key is never sent to the RPC.

## Player controls

- Exact package preview before sharing.
- Minimal default selection: football profile, summary, and strengths.
- Separate opt-in for contact data, statistics, development areas, playing style, coach notes, and
  scout questions.
- Separate explicit approval before sharing a public receive address.
- Invitation response controls.
- Settings preview before normal local data is cleared.

## Deletion

Settings can clear normal local ScoutPass data after showing record counts and receiving explicit
confirmation. This clears profile, report, relationship, invitation, payment, and event records in the
role data file.

It does not:

- delete information already received and retained by a peer;
- erase public Sepolia transaction history;
- delete wallet recovery material from macOS Keychain;
- revoke an invite topic already copied by another person.

## Debug export

The sanitized debug export contains schema/update metadata, record counts, relationship IDs and
statuses, shortened wallet address suffixes, payment IDs/statuses, and event IDs/types/times. It
excludes profile payloads, contact details, private notes, relationship topics, sender public keys,
full wallet addresses, transaction payloads, and all recovery material.

## Human trust warnings

- Player statistics and qualitative notes are self-entered and not independently verified.
- The QVAC report interprets supplied information; it does not verify it or make a recruitment
  decision.
- Scout and club identity is not verified. Players should confirm the invitation through an
  independent official channel before travel.
- Testnet travel support is not escrow, a tryout fee, identity proof, or a recruitment guarantee.
