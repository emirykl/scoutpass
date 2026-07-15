# ScoutPass

ScoutPass is a local-first football scouting and tryout MVP. An adult player creates a structured
profile, generates a scouting report on-device, chooses exactly what to share with one scout,
receives a P2P tryout invitation, and can receive optional testnet USD₮ travel support.

The project was built for the Tether Developers Cup. It intentionally does not provide a public
player marketplace, cloud AI, centralized messaging, identity verification, escrow, or mainnet
payments.

## The problem

Amateur players often depend on public videos, unstructured documents, direct messages, and personal
connections to reach scouts. Once a profile is shared, the player usually loses control of it.
Scouts receive inconsistent, self-reported information that is hard to compare.

ScoutPass gives the player a standardized local profile and an explicit sharing boundary. A scout
receives only the approved package and can move the relationship to a tryout without a ScoutPass
cloud server.

## Connected product flow

```text
Player profile
  -> local QVAC report
  -> exact share preview and approval
  -> Pears P2P transfer
  -> tryout invitation and player response
  -> reviewed WDK Sepolia USD₮ travel support
  -> local activity history on both instances
```

### QVAC

`@qvac/sdk` loads `QWEN3_600M_INST_Q4` locally. ScoutPass sends structured player data to the local
model, requests JSON-only output, validates it with Zod, retries invalid output once, and never uses
a hosted AI fallback.

### Pears Stack

`pear-runtime`, Hyperswarm, Hypercore, and Corestore provide relationship-specific peer transport.
Frames are size-limited and validated before processing. Event IDs, protocol versions, freshness,
and append-only local history prevent accidental replay and duplicate processing.

### WDK

The official WDK EVM wallet module creates separate Player and Scout self-custodial wallets. Recovery
material remains in macOS Keychain. Payment review is bound to an accepted invitation and a player
address shared through the same P2P relationship. Signing is not called until `Confirm and sign`.

## Requirements

- macOS arm64 for the currently verified Keychain and QVAC path
- Node.js `24.11.1` verified; project minimum is recorded in `.nvmrc`
- npm `11.6.2`
- At least 2 GB available RAM before loading the selected QVAC model
- Pear CLI `3.0.0` and Bare `1.30.3` for Pear runtime work
- Sepolia ETH and test USD₮ only for the payment demonstration

## Install and verify

These commands were run successfully on 15 July 2026:

```bash
npm install
npx qvac doctor --json
npm run check
npm run test:p2p
npm run test:keychain
npm run test:wdk:network
```

`npm run check` runs formatting, lint, TypeScript checks, all default tests, and production builds.
The three smoke commands require local UDP sockets, macOS Keychain access, and Sepolia network access
respectively.

## Run the UI

```bash
npm run dev
```

The Vite URL is a browser UI development surface. Wallet, QVAC, and Pears actions remain disabled
unless a desktop preload provides the validated `window.scoutpassRuntime` bridge. It must not be used
as proof of the complete desktop acceptance flow.

## QVAC model and offline proof

1. Close memory-heavy applications and verify at least 2 GB available RAM.
2. Run `npx qvac doctor --json`.
3. While online, run the local adapter once so the selected registry model can be cached:

   ```bash
   npm run qvac:report
   ```

4. Confirm that the command prints a valid JSON scouting report with real `modelInfo`.
5. Disable Wi-Fi and all other network connections.
6. Run `npm run qvac:report` again and preserve the successful output as offline evidence.

No model file is committed. The current workstation did not have the selected model cached during
the final automated audit, so both report runs remain a manual acceptance item.

## Two-instance Pears proof

The repeatable in-process two-node smoke test was run successfully:

```bash
npm run test:p2p
```

It creates independent Player and Scout Hyperswarm transports, connects and reconnects them, sends a
selective profile, returns an acknowledgement, sends a tryout invitation and acceptance, and shares
the public Player wallet metadata.

A packaged Pear desktop entrypoint and verified two-window CLI command are not present yet. The final
demo must not claim two desktop instances until that host/preload packaging step is completed and the
manual checklist passes.

## WDK testnet setup

```bash
npm run wallet:player
npm run wallet:scout
```

These commands create or restore role-specific wallets in macOS Keychain and print only public
metadata and test USD₮ balance. Fund the Scout address with Sepolia ETH for gas and organizer-issued
test USD₮. Never send real ETH, mainnet USD₮, or other funds to demo wallets.

The repository does not hard-code an unverified faucet. See [wallet-testnet.md](docs/wallet-testnet.md)
for the fixed network and token configuration.

## Screenshots and demo evidence

Repository screenshots are intentionally pending until the real desktop runtime is used. Capture the
following from the acceptance session and add them under `docs/screenshots/` before submission:

1. Player selective-share preview.
2. Scout received package and accepted invitation.
3. Payment review before signing.
4. Player transaction hash and confirmed Sepolia status.

Browser-preview screenshots are not acceptable evidence for QVAC, Pears, or WDK integration.

## External components and services

| Component                  | Purpose                                  | Network use                                      |
| -------------------------- | ---------------------------------------- | ------------------------------------------------ |
| `@qvac/sdk` `0.15.0`       | Local report inference                   | Model download only; inference must work offline |
| QVAC Qwen3 0.6B Q4 model   | Local text generation                    | Registry download before offline demo            |
| Pear CLI / `pear-runtime`  | Desktop/Bare runtime                     | Pear distribution/runtime operations             |
| Hyperswarm / HyperDHT      | Player-Scout P2P transport               | Peer discovery and encrypted transport           |
| Hypercore / Corestore      | Local append-only Pear data              | No ScoutPass central server                      |
| WDK core and EVM wallet    | Self-custodial wallet and token transfer | Configured Sepolia RPC only                      |
| `https://sepolia.drpc.org` | Default public Sepolia RPC               | Balance, fee, broadcast, receipt                 |
| React, Vite, Zod, Vitest   | UI, build, schemas, tests                | No application telemetry                         |

There are no OpenAI, Anthropic, Gemini, Firebase, Supabase, analytics, telemetry, or ScoutPass-hosted
API dependencies.

## Security and privacy

- Player statistics are self-reported and not independently verified.
- Scout and club identity is not verified in the MVP.
- Normal app data is separate from Keychain wallet recovery material.
- P2P payloads are strict, versioned, size-limited, freshness-checked, and deduplicated.
- A payment is optional testnet travel support, not escrow, a fee, identity proof, or recruitment
  guarantee.

Read [threat-model.md](docs/threat-model.md), [privacy.md](docs/privacy.md), and
[architecture.md](docs/architecture.md) before running a public demo.

## Current limitations

- The selected QVAC model has not yet been cached and proven offline on this workstation.
- The browser UI is not yet packaged with the Electron/preload/Bare worker path described by the ADR.
- Scout and club identities are not verified.
- Statistics and coach notes are player-provided.
- There is no mainnet support, escrow, gas sponsorship, or automatic payment retry.
- A real funded test USD₮ transaction still requires explicit Scout approval and manual evidence.
- DoraHacks and YouTube submission URLs are not present in the repository.

## Roadmap

1. Package and verify the Pear desktop host with isolated Player and Scout data roots.
2. Cache the QVAC model and record offline inference evidence.
3. Complete one funded Sepolia USD₮ acceptance transaction and receipt check.
4. Add optional club identity attestations without centralizing player data.
5. Evaluate Autobase only if a real multi-writer requirement appears.

## Delivery documents

- [Architecture](docs/architecture.md)
- [Privacy](docs/privacy.md)
- [Threat model](docs/threat-model.md)
- [Quality audit](docs/quality-audit.md)
- [Three-minute demo script](docs/demo-script.md)
- [Manual acceptance checklist](docs/manual-test-checklist.md)
- [Development environment](docs/development-environment.md)
- [WDK testnet configuration](docs/wallet-testnet.md)

## License

MIT. See [LICENSE](LICENSE).
