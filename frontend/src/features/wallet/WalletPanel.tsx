import { useEffect, useState } from "react";

import type { WalletPublicMetadata } from "@scoutpass/backend/contracts";

import {
  createRuntimeRequest,
  isDesktopRuntimeAvailable,
  requestRuntime,
  subscribeRuntimeEvents
} from "../../runtime/runtime-bridge.js";
import { runtimeFailureError, toUserFacingMessage } from "../../runtime/user-facing-errors.js";

interface WalletPanelProps {
  readonly role: "player" | "scout";
  readonly relationshipId: string;
  readonly storedWallet?: WalletPublicMetadata | undefined;
  readonly sharedPlayerWallet?: WalletPublicMetadata | undefined;
  readonly onWalletChange?: ((wallet: WalletPublicMetadata) => void) | undefined;
}

export function WalletPanel({
  role,
  relationshipId,
  storedWallet,
  sharedPlayerWallet,
  onWalletChange
}: WalletPanelProps) {
  const [runtimeWallet, setRuntimeWallet] = useState<WalletPublicMetadata>();
  const [runtimePlayerWallet, setRuntimePlayerWallet] = useState<WalletPublicMetadata>();
  const [balance, setBalance] = useState<string>();
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [shareApproved, setShareApproved] = useState(false);
  const [addressShared, setAddressShared] = useState(false);
  const [error, setError] = useState<string>();
  const runtimeAvailable = isDesktopRuntimeAvailable();
  const wallet = runtimeWallet ?? storedWallet;
  const remotePlayerWallet = runtimePlayerWallet ?? sharedPlayerWallet;

  useEffect(
    () =>
      subscribeRuntimeEvents((event) => {
        if (event.type === "wallet.updated" && event.payload.wallet.ownerRole === role) {
          setRuntimeWallet(event.payload.wallet);
          onWalletChange?.(event.payload.wallet);
          setBalance(event.payload.balance);
          setStatus("ready");
        }
        if (event.type === "wallet.address.received") {
          setRuntimePlayerWallet(event.payload.wallet);
        }
      }),
    [onWalletChange, role]
  );

  const initialize = async () => {
    setStatus("loading");
    setError(undefined);
    try {
      const event = await requestRuntime({
        ...createRuntimeRequest(),
        type: "wallet.initialize",
        payload: { ownerRole: role }
      });
      if (event.type === "operation.failed") {
        throw runtimeFailureError(event.payload, "The testnet wallet could not be initialized.");
      }
      if (event.type !== "wallet.updated") {
        throw new Error("Desktop runtime did not return wallet metadata.");
      }
      setRuntimeWallet(event.payload.wallet);
      onWalletChange?.(event.payload.wallet);
      setBalance(event.payload.balance);
      setStatus("ready");
    } catch (caught) {
      setStatus("error");
      setError(toMessage(caught));
    }
  };

  const refreshBalance = async () => {
    if (wallet === undefined) return;
    setError(undefined);
    try {
      const event = await requestRuntime({
        ...createRuntimeRequest(),
        type: "wallet.balance.get",
        payload: { address: wallet.address }
      });
      if (event.type === "operation.failed") {
        throw runtimeFailureError(event.payload, "The test USD₮ balance could not be refreshed.");
      }
      if (event.type !== "wallet.updated") {
        throw new Error("Desktop runtime did not return the test balance.");
      }
      setBalance(event.payload.balance);
    } catch (caught) {
      setError(toMessage(caught));
    }
  };

  const shareAddress = async () => {
    if (wallet === undefined || role !== "player" || !shareApproved) return;
    setError(undefined);
    try {
      const event = await requestRuntime({
        ...createRuntimeRequest(),
        type: "wallet.address.share",
        payload: { relationshipId, wallet, playerApproved: true }
      });
      if (event.type === "operation.failed") {
        throw runtimeFailureError(event.payload, "The public receive address could not be shared.");
      }
      setAddressShared(true);
    } catch (caught) {
      setError(toMessage(caught));
    }
  };

  return (
    <section className="panel" aria-labelledby={`wallet-title-${role}`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Step 1</p>
          <h2 id={`wallet-title-${role}`}>
            {role === "player" ? "Receive travel support" : "Set up travel support"}
          </h2>
        </div>
        <span className="testnet-badge">Testnet only</span>
      </div>

      <p className="summary">
        {role === "player"
          ? "Create your test wallet, then share only its public address with the connected scout."
          : "Create the scout test wallet used to send optional travel support."}
      </p>

      {wallet === undefined ? (
        <button
          type="button"
          className="primary-button"
          disabled={!runtimeAvailable || status === "loading"}
          onClick={() => void initialize()}
        >
          {status === "loading"
            ? "Setting up..."
            : role === "player"
              ? "Set up my wallet"
              : "Set up scout wallet"}
        </button>
      ) : (
        <div className="wallet-details">
          <div>
            <span>{role === "player" ? "My public address" : "Scout wallet address"}</span>
            <code>{wallet.address}</code>
          </div>
          <div>
            <span>Test balance</span>
            <strong>{balance ?? "Not loaded"}</strong>
          </div>
          <button type="button" className="secondary-button" onClick={() => void refreshBalance()}>
            Check balance
          </button>
          {role === "player" ? (
            <>
              <label className="approval-row">
                <input
                  type="checkbox"
                  checked={shareApproved}
                  onChange={(event) => {
                    setShareApproved(event.target.checked);
                    setAddressShared(false);
                  }}
                />
                I want to share this public address with the connected scout.
              </label>
              <button
                type="button"
                className="secondary-button"
                disabled={!shareApproved}
                onClick={() => void shareAddress()}
              >
                Share address with scout
              </button>
              {addressShared ? <p className="success">Address shared with the scout.</p> : null}
            </>
          ) : null}
        </div>
      )}

      {role === "scout" && remotePlayerWallet ? (
        <div className="notice">
          Player address received: <code>{remotePlayerWallet.address}</code>
        </div>
      ) : role === "scout" ? (
        <div className="notice">Waiting for the player to share a public address.</div>
      ) : null}
      <p className="muted">Wallet recovery stays protected in macOS Keychain.</p>
      {!runtimeAvailable ? <div className="warning">Available in the desktop app.</div> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

const toMessage = (error: unknown): string =>
  toUserFacingMessage(error, "The self-custodial wallet operation failed.");
