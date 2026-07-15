# ScoutPass manual acceptance checklist

Use this checklist for the final evidence session. Do not check an item based on browser preview,
mock data, a fake transaction, or a cloud AI substitute.

## Automated preflight completed on 15 July 2026

- [x] `npm install` completed with the lockfile.
- [x] `npm run check` passed before Phase 9 documentation work.
- [x] `npm audit --json` reported zero vulnerabilities.
- [x] `npm run test:p2p` passed with real local UDP/DHT nodes.
- [x] `npm run test:keychain` passed against macOS Keychain.
- [x] `npm run test:wdk:network` read a real Sepolia balance through WDK.
- [x] `npx qvac doctor --json` passed required host checks.
- [x] `npm run test:pear-worker` persisted and reopened two Corestore/Hypercore audit records.
- [x] `npm run desktop:package` produced the macOS arm64 `.app` bundle.
- [x] Packaged Player and Scout smoke runs injected the preload bridge and returned runtime status.
- [x] QVAC Qwen3 0.6B Q4 was cached and produced a schema-valid report.
- [x] Public GitHub page returned anonymous HTTP 200.

## Preparation

- [ ] Close memory-heavy apps; QVAC doctor reports at least 2 GB available RAM.
- [x] Selected QVAC model is downloaded and cached before the demo.
- [ ] Player and Scout use clean, isolated data directories.
- [ ] Scout wallet has enough Sepolia ETH for gas.
- [x] Scout wallet has 1,000 spUSD from the confirmed project-owned deployment.
- [ ] Backup demo wallet has testnet funds.
- [ ] Wi-Fi/network can be toggled without interrupting screen recording.
- [ ] No real/mainnet funds are present or used.

Record:

```text
Player data directory:
Scout data directory:
Scout public address:
Player public address:
QVAC modelInfo:
```

## QVAC local/offline test

- [x] Run `npm run qvac:report` online once; a schema-valid report is printed.
- [x] Record/downloaded model information and retain no cloud API key.
- [ ] Disable all network connectivity.
- [ ] Run `npm run qvac:report` again successfully.
- [x] Report contains summary, positional profile, strengths, development areas, systems, questions,
      limitations, timestamp, and real model info.
- [x] Invalid/malformed fixture tests remain green after the model run.
- [ ] Re-enable networking only after offline evidence is captured.

## Two clean desktop instances

- [ ] Start the packaged Scout desktop instance with the Scout data root.
- [ ] Start the packaged Player desktop instance with the Player data root.
- [ ] Both windows show desktop runtime ready, not browser preview.
- [ ] Scout creates one relationship-specific invite.
- [ ] Player connects using that invite.
- [ ] Both roles show connected state.
- [ ] Disconnect/reconnect recovers without losing the relationship history.

Record:

```text
Desktop build/version:
Player instance start command:
Scout instance start command:
```

## Profile and selective sharing

- [ ] Player loads/creates an 18+ profile and confirms the self-reported warning.
- [ ] Player views the real offline QVAC report.
- [ ] Default sharing excludes contact, statistics, coach notes, and development areas.
- [ ] Exact JSON preview contains only intentionally selected sections.
- [ ] Player explicitly approves and sends.
- [ ] Scout receives the exact package and no unselected field.
- [ ] Duplicate delivery does not create a duplicate received package.

## Invitation and identity warning

- [ ] Scout/club identity-not-verified warning is visible on both roles.
- [ ] Scout private assessment remains local and absent from Pear event history.
- [ ] Scout sends a complete tryout invitation.
- [ ] Player receives it and verifies details through an independent channel.
- [ ] Player accepts; Scout receives the accepted status.
- [ ] An expired invitation cannot be accepted.

## WDK payment

- [ ] Player initializes/restores the Player wallet and explicitly shares its public address.
- [ ] Scout initializes/restores the separate Scout wallet.
- [ ] Payment review is unavailable before invitation acceptance.
- [ ] Review shows invitation, Sepolia, spUSD, Player address, amount, and fee.
- [ ] Reject path creates no transaction.
- [ ] Insufficient gas/token path shows a safe error and no fake success.
- [ ] Scout checks the confirmation box and clicks `Confirm and sign`.
- [ ] Real transaction hash appears on Scout.
- [ ] Same hash and invitation appear on Player through Pears.
- [ ] Pending changes only after a receipt query.
- [ ] Sepolia receipt confirms the transaction or displays a real reverted/failed result.
- [ ] A second payment attempt for the same invitation is rejected.

Record:

```text
Transaction hash:
Sepolia explorer URL:
Final status:
spUSD amount:
```

## Persistence and privacy

- [ ] Close and reopen both instances; profile/package/invitation/payment history returns.
- [ ] Recovery material is absent from renderer text, JSON data, logs, and debug export.
- [ ] Sanitized debug export excludes profile payload, private note, topic, keys, and full addresses.
- [ ] Clear-data preview lists record counts before confirmation.
- [ ] Cancel leaves data intact; explicit confirmation clears normal app data.
- [ ] Keychain wallet restores after normal app data is cleared.

## Error-state spot checks

- [ ] QVAC model missing/loading/load failure/invalid second output are visible and safe.
- [ ] Pear malformed/oversized/timeout/not-found/reconnect states are visible and safe.
- [ ] WDK init/balance/insufficient/reject/pending/failure states are visible and safe.
- [ ] No UI error includes a local path, raw stack, seed, private key, topic, or unredacted payload.

## Submission evidence

- [ ] Four real desktop screenshots are added under `docs/screenshots/`.
- [ ] Unlisted demo video is no longer than three minutes.
- [ ] Video visibly proves QVAC offline, Pears P2P, and a real WDK transaction hash.
- [ ] Public GitHub main branch includes the final commit and MIT license.
- [ ] DoraHacks project URL is added and opens anonymously.
- [ ] YouTube URL is added and opens in an incognito window.
- [ ] Demo machine has cached model and backup testnet funds.

## Sign-off

```text
Tester:
Date/time (UTC):
Machine(s):
Final commit:
Result: PASS / FAIL
Notes:
```
