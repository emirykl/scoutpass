# ScoutPass architecture

## System context

ScoutPass has no central application server. Player and Scout instances communicate directly; QVAC
inference and normal storage are local, while WDK uses public Sepolia infrastructure for blockchain
operations.

```mermaid
flowchart LR
  Player[Player instance] <-->|Pears / Hyperswarm events| Scout[Scout instance]
  Player --> QP[Local QVAC model]
  Scout --> WS[Scout WDK wallet]
  Player --> WP[Player WDK wallet]
  WS --> RPC[Public Sepolia RPC]
  WP --> RPC
  Deployment[spUSD constructor mint] -. fixed test supply .-> WS
```

## Containers

```mermaid
flowchart TB
  subgraph Desktop[One ScoutPass desktop instance]
    UI[React renderer]
    Bridge[Validated preload/runtime bridge]
    Host[Local application host]
    Bare[Bare / Pear worker]
    Domain[Domain and use cases]
    QVAC[QVAC adapter]
    Pears[Pears transport adapter]
    WDK[WDK EVM adapter]
    JSON[Atomic JSON repositories]
    Keychain[macOS Keychain]

    UI <-->|RuntimeCommand / RuntimeEvent| Bridge
    Bridge <--> Host
    Host --> Domain
    Domain --> QVAC
    Domain --> Pears
    Domain --> WDK
    Domain --> JSON
    WDK --> Keychain
    Pears <--> Bare
  end

  Pears <-->|relationship events| Peer[Remote ScoutPass peer]
  WDK <-->|balance / fee / raw tx / receipt| Sepolia[Sepolia RPC]
```

The packaged Electron app installs `window.scoutpassRuntime` from a sandboxed preload. Every command
is validated in the renderer bridge and Electron main, accepted by the Bare worker, recorded as
sanitized metadata in Corestore/Hypercore, and then dispatched to the local command handler. The
returned event is validated, recorded by the worker, and returned to the renderer. The Vite browser
shell remains a UI-only development surface.

## Component ownership

| Component                 | Responsibility                                                     | Must not do                                         |
| ------------------------- | ------------------------------------------------------------------ | --------------------------------------------------- |
| `frontend/src`            | Role workflows, exact previews, explicit approvals, status display | Read Keychain, import native SDKs, open P2P sockets |
| `backend/src/domain`      | Models, schemas, state transitions, money/event rules              | Import QVAC, Pears, or WDK SDKs                     |
| `backend/src/application` | Use cases and adapter/repository ports                             | Store recovery material or bypass approval checks   |
| `infrastructure/qvac`     | Local prompt, model lifecycle, response parsing                    | Call hosted AI or fabricate a report                |
| `infrastructure/pears`    | Invite topics, Hyperswarm connection, framed bytes                 | Trust unvalidated peer bytes                        |
| `infrastructure/wdk`      | Keychain-backed WDK account, balance, quote, transfer, receipt     | Return seed/private key to UI or normal storage     |
| `infrastructure/storage`  | Isolated strict JSON state and atomic writes                       | Silently replace corrupt/unknown-version state      |

## Profile and invitation flow

```mermaid
sequenceDiagram
  participant P as Player UI
  participant PQ as Player QVAC
  participant PP as Player Pears
  participant SP as Scout Pears
  participant S as Scout UI

  P->>PQ: Structured profile
  PQ-->>P: Zod-valid local report
  P->>P: Select fields and review exact JSON
  P->>PP: Explicit share approval
  PP->>SP: player.profile_shared
  SP-->>PP: profile.received
  SP-->>S: Store sanitized package
  S->>SP: tryout.invitation
  SP->>PP: Tryout invitation
  P->>PP: Accept / decline / clarification
  PP->>SP: invitation.response
```

## Travel-support flow

```mermaid
sequenceDiagram
  participant P as Player
  participant PP as Pears
  participant S as Scout
  participant W as Scout WDK
  participant R as Sepolia RPC

  P->>PP: Approved public receive address
  PP->>S: wallet.address_shared + relationshipId
  S->>S: Require accepted invitation and prevent duplicate
  S->>W: Quote transfer fee
  S->>PP: travel_support.proposed
  S->>S: Display invitation, network, token, address, amount, fee
  S->>W: Confirm and sign
  W->>R: Signed spUSD test-token transaction
  R-->>W: Real transaction hash
  W-->>S: pending PaymentReference
  S->>PP: travel_support.sent
  PP-->>P: Invitation-linked hash and status
  S->>R: Receipt query
  R-->>S: pending / confirmed / reverted
```

## Persistence

Each role resolves to a separate data file under `SCOUTPASS_DATA_DIR/<role>/`. Writes validate the
complete state, write an owner-only temporary file, then atomically rename it. Relationship events are
append-only and event IDs are deduplicated.

The Pear worker owns a separate named Corestore feed for IPC audit metadata. Records contain only the
request ID, command/event type, timestamp, and record kind. Hypercore supplies append-only storage;
Autobase is not used because this local audit feed has no multi-writer merge requirement.

Wallet recovery material uses the `io.scoutpass.wallet` macOS Keychain service and never appears in
the JSON state. Clearing app data intentionally leaves Keychain material untouched.

## Protocol constraints

- Protocol version: `1.0.0`
- Local schema version: `1.0.0`
- Maximum P2P event payload: 64 KiB
- Event union: profile share/receipt, invitation/response, wallet address, payment proposal/result
- Time storage: ISO 8601 UTC; UI rendering uses the local locale

Detailed process and storage decisions are in [ADR 0001](decisions/0001-desktop-process-boundaries.md)
and [ADR 0002](decisions/0002-local-storage.md).
