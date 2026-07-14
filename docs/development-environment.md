# Development environment

Validated on 14 July 2026 in `/Users/emir/Desktop/scoutpass`.

## Toolchain

| Component      | Validated version |
| -------------- | ----------------- |
| Node.js        | 24.11.1           |
| npm            | 11.6.2            |
| TypeScript     | 6.0.3             |
| Pear CLI       | 3.0.0             |
| Pear runtime   | 1.3.1             |
| Bare runtime   | 1.30.3            |
| QVAC SDK       | 0.15.0            |
| QVAC CLI       | 0.8.1             |
| WDK core       | 1.0.0-beta.14     |
| WDK EVM wallet | 1.0.0-beta.15     |
| Hyperswarm     | 4.17.0            |
| Hypercore      | 11.34.0           |
| Corestore      | 7.11.0            |

Exact dependency versions are recorded in `package-lock.json`. Integration code must be checked against the installed TypeScript declarations again before each adapter is implemented.

## QVAC host check

`npx qvac doctor --json` passed all required checks:

- Host: macOS arm64
- Total RAM: 16 GB
- GPU backend: Metal
- Free project-volume disk at check time: approximately 100 GB
- Desktop target: supported
- `@qvac/sdk`: resolvable from the workspace

The doctor reported less than 2 GB available memory during the check. Close memory-heavy applications before loading a local model. QVAC model files are multi-gigabyte artifacts and remain excluded from Git.

FFmpeg and Bun are not installed. They are not required by the ScoutPass text-report MVP: FFmpeg is relevant to audio workflows, and Bun is only required when building QVAC from source.

Official requirements:

- https://docs.qvac.tether.io/installation/
- https://docs.qvac.tether.io/system-requirements/
- https://docs.qvac.tether.io/quickstart/

## Verified package surfaces

The installed modules were imported locally rather than inferred from examples:

- QVAC exports `loadModel`, `completion`, `unloadModel`, `LLAMA_3_2_1B_INST_Q4_0`, and other model constants.
- WDK core has a default `WDK` export.
- WDK EVM exports a default wallet manager, `WalletAccountEvm`, and `WalletAccountReadOnlyEvm`.
- `pear-runtime` has a default export.

These checks validate package shape only. Model inference, P2P transfer, and testnet transactions remain separate integration gates in later phases.

## Testnet decision

The MVP wallet target is Ethereum Sepolia (`chainId` 11155111) with the test USD₮ address published in WDK documentation:

`0xd077a400968890eacc75cdc901f0356c943e4fdb`

This is a test-only asset with six decimals and no redeemable value. The initial MVP uses the standard WDK EVM wallet module. ERC-4337 or EIP-7702 gasless modules are intentionally deferred because they add bundler/paymaster dependencies to the critical demo path.

Official references:

- https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm/
- https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm-erc-4337/configuration/

Before the payment phase is marked complete, the RPC, faucet, token balance, fee funding, transfer quote, transfer call, and transaction receipt must all be tested against the installed WDK versions.
