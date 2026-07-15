# ScoutPass quality audit

- Audit date: 15 July 2026
- Commit at audit start: `ee5b484`
- Host: macOS arm64, Node.js `24.11.1`, npm `11.6.2`

## Automated quality gate

Final `npm run check` passed. It covered Prettier, ESLint with zero warnings, backend/frontend
TypeScript, 59 passing backend tests, 8 passing frontend tests, and both production builds. Three
opt-in backend smoke cases remained skipped in the default suite and were invoked separately where
applicable.

## Integration smoke results

| Command                    | Result               | Evidence covered                                                                                                          |
| -------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:p2p`         | Pass                 | Two local DHT nodes, connect/reconnect, selected profile, acknowledgement, invitation, acceptance, public wallet metadata |
| `npm run test:keychain`    | Pass                 | Temporary Keychain set/get/delete and stable WDK wallet restoration                                                       |
| `npm run test:wdk:network` | Pass                 | Real Sepolia RPC test USD₮ balance query through WDK                                                                      |
| `npx qvac doctor --json`   | Required checks pass | SDK resolution, macOS arm64, Metal, 16 GB total RAM, disk                                                                 |

QVAC doctor reported only about 90 MB available RAM and no selected model cache was found. Real model
generation/offline proof was therefore not run and remains a manual acceptance item.

## Dependency vulnerability audit

`npm audit --json` returned zero info, low, moderate, high, or critical vulnerabilities across its
649-package dependency graph view. `npm install --package-lock-only --ignore-scripts` also reported
zero vulnerabilities after package metadata was updated.

This is a point-in-time registry result, not a guarantee against future advisories or package supply
chain compromise.

## License inventory

All third-party lockfile entries included license metadata. ScoutPass root/backend/frontend packages
were updated to explicitly declare `MIT`, matching the repository `LICENSE`. Two generated
`node_modules/@scoutpass/*` workspace-link lock entries omit duplicated license metadata; their source
workspace entries declare MIT.

Counts observed in the lockfile:

| License       | Package entries |
| ------------- | --------------: |
| MIT           |             379 |
| Apache-2.0    |             196 |
| ISC           |              26 |
| MPL-2.0       |              12 |
| BSD-3-Clause  |              11 |
| BSD-2-Clause  |               8 |
| BlueOak-1.0.0 |               6 |
| 0BSD          |               2 |
| MIT-0         |               2 |
| CC-BY-4.0     |               1 |
| CC0-1.0       |               1 |
| Python-2.0    |               1 |

Non-MIT/Apache transitives reviewed: `lightningcss` platform packages (MPL-2.0), `caniuse-lite`
(CC-BY-4.0), `mdn-data` (CC0-1.0), `argparse` (Python-2.0), and the BlueOak-licensed npm utility
family. No package was found without license metadata after adding ScoutPass metadata.

## Cloud, telemetry, and endpoint audit

Source and lockfile searches found no OpenAI, Anthropic, Gemini, Firebase, Supabase, Socket.io,
Sentry, Segment, PostHog, Mixpanel, or Axios dependency/use. No application analytics or telemetry
call exists.

The only application HTTP endpoint literal in source is the configurable default Sepolia RPC:

```text
https://sepolia.drpc.org
```

QVAC registry/model download and Pear discovery are SDK-controlled external operations. They are
listed in the README external-component table. React's production bundle contains its own error-help
URL text; this is library text, not a ScoutPass network call.

## Secret scan

Tracked production source was searched for common access-key, private-key block, hosted-AI key, seed,
mnemonic, and private-key assignment patterns.

- No credential or recovery phrase literal was found.
- Expected identifier names occur only in the Keychain adapter and logger redaction regex.
- `.env.example` contains public configuration only.
- Files matching local wallet/data/model/build patterns remain ignored.
- Tests use generated or explicitly fake secrets and were excluded from the production credential
  scan.

## Production bundle scan

The production build completed. Scans found:

- no cloud AI/telemetry provider string;
- no credential/private-key/seed phrase literal;
- no ScoutPass debug `console.log` statement;
- one expected sensitive-key regex in the compiled sanitized logger;
- the public Sepolia RPC in the backend wallet CLI.

## Public repository

Anonymous HTTP access to `https://github.com/emirykl/scoutpass` returned `200`, and `origin/main`
resolved to the current published commit at audit time. The MIT license and six visible local commits
were present. DoraHacks and YouTube URLs were not found and remain user submission tasks.

## Residual manual gates

1. Cache the QVAC model, generate a valid report, disable networking, and generate again.
2. Package/install the Pear desktop host and run two clean visible role instances.
3. Fund the Scout demo wallet with Sepolia ETH and test USD₮.
4. Complete one explicitly approved transaction and confirm the hash from both roles.
5. Capture screenshots and a maximum three-minute unlisted demo.
6. Add and verify DoraHacks and YouTube URLs.
