# ScoutPass three-minute demo script

Target duration: 2:45 to 2:55. Record two real desktop instances. Do not use browser preview as
integration evidence.

## Before recording

- Cache the QVAC model and complete one offline rehearsal.
- Open clean Player and Scout instances side by side.
- Confirm the Scout wallet has Sepolia ETH and the deployed spUSD test-token supply.
- Keep a second funded Scout wallet available.
- Prepare an invitation with a future date and a small test travel-support amount.
- Verify screen recording does not expose notifications, Keychain dialogs, personal email, or an
  invite code that will be reused.

## 0:00-0:20 — Problem and promise

Show both role dashboards.

Narration:

> Amateur players share fragmented, public, self-reported profiles and lose control of the data.
> ScoutPass creates the report locally, shares only what the player approves, sends the tryout
> directly peer to peer, and supports optional testnet travel funding.

Point briefly to the identity-not-verified and testnet warnings.

## 0:20-0:55 — QVAC offline

On Player, show the completed profile and self-reported notice. Disable network connectivity visibly,
then generate/open the real report.

Show:

- report sections and evidence/confidence;
- fixed disclaimer;
- real QVAC `modelInfo` and generated time;
- no cloud API key or hosted AI UI.

Narration:

> QVAC runs on this device. The network is off, structured output is schema-validated, and invalid
> output is never replaced with a fabricated report.

## 0:55-1:25 — Exact sharing over Pears

On Scout, create a fresh connection invite. On Player, connect. Show both connected indicators.

On Player, open selective sharing. Leave one sensitive section off, show the exact JSON preview, check
approval, and send. On Scout, show the received package and confirm the omitted section is absent.

Narration:

> The package is constructed from selected fields and sent directly through Pears. ScoutPass has no
> central player-profile server.

## 1:25-1:55 — Tryout invitation

On Scout, show a private note, then preview/send the prepared invitation. On Player, show the received
details and accept. Return to Scout and show accepted status.

Narration:

> The note stays local. The invitation and response are relationship events. Club identity is not
> verified, so the player must independently confirm travel details.

## 1:55-2:40 — Reviewed WDK payment

On Player, show the WDK public receive address and approve sharing. On Scout, open travel support and
show invitation, Sepolia network, spUSD test token, destination, amount, and fee.

Pause on the unchecked approval box.

Narration:

> No transaction has been signed. ScoutPass revalidates the accepted invitation and the address from
> the same P2P relationship, and blocks duplicate payments.

Check approval and click `Confirm and sign`. Show the real transaction hash and pending/confirmed
status. On Player, show the same hash associated with the invitation.

Narration:

> WDK signs locally with recovery material held in macOS Keychain. The displayed hash comes from the
> real Sepolia broadcast; there is no fake success fallback.

## 2:40-2:55 — Close

Show activity history or the dashboard summary.

Narration:

> ScoutPass connects local intelligence, player-controlled P2P sharing, a real tryout workflow, and
> self-custodial testnet support in one private MVP.

## Recording failure rules

- If QVAC cannot run offline, do not replace it with the UI preview; stop and fix the model cache.
- If Pears uses browser preview or a mock runtime, stop and use packaged desktop instances.
- If WDK fails or stays ambiguous after timeout, show the real failure; never splice in a hash from a
  different payment.
- If the final video exceeds three minutes, shorten narration rather than speeding up evidence.
