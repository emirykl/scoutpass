# ADR 0001: Desktop process boundaries

- Status: accepted
- Date: 2026-07-14

## Context

ScoutPass must keep the renderer sandboxed, run local AI and wallet operations outside UI state, and place all player–scout networking on Pears. The repository is constrained to `frontend/` and `backend/` for application code.

## Decision

Use the production-shaped Pear desktop split described by the official `hello-pear-electron` architecture:

1. `frontend/` contains the React renderer. It has no direct Node, Bare, wallet-secret, Hypercore, or Hyperswarm access.
2. The Electron main process is a thin host and IPC proxy.
3. A dedicated Bare worker in `backend/` owns `pear-runtime`, Hyperswarm, Corestore/Hypercore, and the P2P protocol.
4. QVAC and WDK adapters run outside the renderer. Their exact host process will be selected by installed SDK compatibility tests, but only validated commands and sanitized results cross into the UI.
5. Renderer ↔ local runtime messages are discriminated unions validated by Zod on both sides.
6. Application records use repository interfaces with a strict, atomic structured-JSON adapter for the MVP. Pear replication data remains in the Bare worker's Corestore rooted under Pear-managed storage.

The central `backend/` directory is therefore a local application backend, not a remote HTTP service.

## Rationale

The official Pear desktop model keeps native P2P dependencies out of the renderer. `PearRuntime.run()` starts a Bare worker and returns a duplex IPC stream; the renderer reaches it only through a preload bridge. Separate storage roots make Player and Scout instances behave like independent devices.

Official references:

- https://docs.pears.com/explanation/pear-desktop-architecture/
- https://docs.pears.com/getting-started/from-a-template/start-from-hello-pear-electron/
- https://docs.pears.com/reference/pear/runtime/

## Consequences

- No REST/WebSocket server is needed for Player–Scout communication.
- P2P byte payloads require size limits and runtime validation before processing.
- Wallet secrets cannot enter renderer state or the normal JSON database.
- The Vite browser development shell is only a UI development surface; the production acceptance test must run through the Electron/preload/Bare-worker path.
- Autobase is not selected for the first MVP. A single relationship event log and explicit acknowledgements are sufficient until a real multi-writer merge requirement is demonstrated.
