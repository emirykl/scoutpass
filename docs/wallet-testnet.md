# ScoutPass WDK Testnet Wallet

ScoutPass uses the official WDK EVM module on Ethereum Sepolia only.

## Fixed configuration

- Network: Ethereum Sepolia
- Chain ID: `11155111`
- Test asset: ScoutPass Test USD (`spUSD`), a project-owned mock ERC-20 with no monetary value
- spUSD contract: `0x0E746Cf3DFb656dF11AeBa7775Df3C7b74425b18`
- Token decimals: `6`
- Default public RPC: `https://sepolia.drpc.org`

The RPC is public infrastructure, not a ScoutPass backend. It is used only for blockchain balance and transaction calls. Override it with `SCOUTPASS_SEPOLIA_RPC_URL` when needed.

## Security model

- WDK generates a BIP-39 seed locally.
- On macOS, ScoutPass stores the seed in Keychain under the `io.scoutpass.wallet` service.
- The seed is passed to the Keychain command through stdin and never through process arguments.
- Normal ScoutPass JSON storage contains only public wallet metadata.
- WDK account and signer memory is disposed when the wallet gateway closes.
- The browser preview never receives or displays recovery material.

## Verification commands

```bash
npm run test:keychain
npm run test:wdk:network
```

The first command creates a temporary Keychain item, reads it back, deletes it, and confirms deletion. The second derives a real WDK EVM account and reads its spUSD balance from Sepolia.

## Funding the demo wallets

1. Initialize the Player and Scout wallets and record only their public addresses:

   ```bash
   npm run wallet:player
   npm run wallet:scout
   ```

2. Obtain Sepolia ETH for gas from a reputable Sepolia faucet listed by the Ethereum ecosystem or the hackathon organizer.
3. The fixed supply of 1,000 spUSD was minted to the Scout WDK address by the constructor.
4. Never send mainnet ETH or real USD₮ to these addresses for the demo.
5. Run `npm run test:wdk:network` again and confirm balance reads remain healthy.

The spUSD deployment transaction is `0x6009f180bfb29dc9551fd27f5b76d196ba04fa04d30b92614c10edd0069b746d`.
The token is not issued by Tether and must never be represented as real or redeemable USD₮.

Official references:

- https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm/configuration
- https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm/guides/check-balances
- https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm/guides/getting-started
