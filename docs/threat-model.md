# ScoutPass MVP threat model

- Reviewed: 15 July 2026
- Scope: local Player and Scout application instances, QVAC adapter, Pears transport, local JSON
  storage, macOS Keychain wallet secret storage, and WDK Sepolia calls
- Out of scope: operating-system compromise, malicious QVAC/WDK/Pears package maintainers, mainnet
  assets, and verified club identity

## Assets and trust boundaries

Protected assets are player contact/profile data, unshared report sections, scout private notes,
relationship topics, wallet recovery material, public payment metadata, and local history.

Trust boundaries:

1. React renderer to the local runtime: only discriminated Zod command/event unions cross it.
2. Peer bytes to domain events: length-framed bytes are decoded, size-limited, schema-validated,
   freshness-checked, and deduplicated before use.
3. Normal JSON storage to macOS Keychain: wallet recovery material has no normal repository field.
4. Local runtime to Sepolia RPC: only public chain queries and signed transaction broadcasts leave the
   device.
5. Player to Scout: neither human identity nor self-reported performance is automatically trusted.

## Threats and controls

| Threat                                   | Control                                                                                          | Residual risk / required user action                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Malicious P2P JSON or invalid UTF-8      | Fatal UTF-8 decoding, strict event union, protocol version validation                            | A peer can repeatedly send invalid frames; rate limiting is not implemented              |
| Oversized message or frame               | 64 KiB limit before JSON parsing and before sending                                              | Many individually valid frames can still consume resources                               |
| Fake scout or club identity              | Persistent UI warning; no verified badge or identity claim                                       | Player must confirm club and invitation independently before travel                      |
| Self-reported player data                | Fixed report disclaimer and self-reported flag                                                   | Scout must verify statistics and references independently                                |
| Oversharing                              | Default-minimal selection, exact JSON preview, explicit approval, sanitized package creation     | Player can intentionally approve sensitive fields                                        |
| Wallet secret exposure                   | macOS Keychain, stdin-based Keychain writes, strict public metadata schema, sanitized logging    | Compromised OS account or process memory remains out of scope                            |
| Replay or stale event                    | Event ID deduplication, freshness/future-skew rejection, append-only event log                   | A new malicious event ID with plausible time still reaches domain validation             |
| Duplicate payment                        | One local payment per invitation, accepted-invitation check, address binding, no automatic retry | RPC timeout after broadcast can be ambiguous; inspect hash/chain before any manual retry |
| Corrupted or downgraded storage          | Atomic rename, strict whole-state validation, explicit schema version, no silent reset           | User must restore from a trusted backup or clear reviewed data                           |
| Tampered invitation/address relationship | Payment service re-reads the address event from the same relationship before signing             | Peer identity keys are not tied to legal club identity                                   |
| Renderer error detail leakage            | Stable error codes and centralized user-facing messages                                          | Local sanitized logs may still be needed for diagnostics                                 |
| Dependency compromise                    | Lockfile, source audit, `npm audit`, license inventory, no install scripts in acceptance docs    | Registry/package maintainer compromise is not eliminated                                 |

## Payment safety invariants

- Network and token address are compile-time Sepolia/test USD₮ literals.
- Floating-point arithmetic is not used for token amounts.
- Review quotes a fee but does not sign.
- `userConfirmed: true` is required at the runtime contract and use-case boundary.
- WDK returns the transaction hash; ScoutPass never fabricates success or a demo hash.
- `pending` changes to `confirmed` or `failed` only from a real receipt result.
- RPC timeout is not treated as failure-safe retry permission because a broadcast may have succeeded.

## Privacy abuse cases

- A Scout cannot query a public player directory because none exists.
- A received package contains only newly constructed selected fields, not a redacted full profile.
- Private scout assessment stays in the Scout repository and is not placed in Pear events.
- Sanitized debug export contains counts and operational metadata, not profile payloads, private notes,
  relationship topics, public keys, or full wallet addresses.

## Incident response for the MVP

1. Disconnect the Pear relationship and stop both instances.
2. Do not retry an ambiguous payment until the transaction hash/address history is checked on Sepolia.
3. Use Settings to review local-data scope and export sanitized diagnostics.
4. Clear normal local data only after explicit review; this does not remove Keychain recovery material.
5. Remove wallet recovery material separately from Keychain if wallet compromise is suspected.
6. Rotate to a new relationship invite because the old invite topic cannot be revoked remotely.

## Known gaps

- No club identity attestation or trust registry.
- No per-peer rate limiter or abuse blocklist.
- No encrypted backup/recovery UX for normal app history.
- No packaged desktop code-signing/notarization verification yet.
- No independent security review.
