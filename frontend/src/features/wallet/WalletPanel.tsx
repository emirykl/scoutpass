import { useEffect, useState } from "react";

import type { WalletPublicMetadata } from "@scoutpass/backend/contracts";

import {
  createRuntimeRequest,
  isDesktopRuntimeAvailable,
  requestRuntime,
  subscribeRuntimeEvents
} from "../../runtime/runtime-bridge.js";

interface WalletPanelProps {
  readonly role: "player" | "scout";
  readonly relationshipId: string;
}

export function WalletPanel({ role, relationshipId }: WalletPanelProps) {
  const [wallet, setWallet] = useState<WalletPublicMetadata>();
  const [remotePlayerWallet, setRemotePlayerWallet] = useState<WalletPublicMetadata>();
  const [balance, setBalance] = useState<string>();
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [shareApproved, setShareApproved] = useState(false);
  const [addressShared, setAddressShared] = useState(false);
  const [error, setError] = useState<string>();
  const runtimeAvailable = isDesktopRuntimeAvailable();

  useEffect(
    () =>
      subscribeRuntimeEvents((event) => {
        if (event.type === "wallet.updated" && event.payload.wallet.ownerRole === role) {
          setWallet(event.payload.wallet);
          setBalance(event.payload.balance);
          setStatus("ready");
        }
        if (event.type === "wallet.address.received") {
          setRemotePlayerWallet(event.payload.wallet);
        }
      }),
    [role]
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
      if (event.type === "operation.failed") throw new Error(event.payload.message);
      if (event.type !== "wallet.updated") {
        throw new Error("Desktop runtime did not return wallet metadata.");
      }
      setWallet(event.payload.wallet);
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
      if (event.type === "operation.failed") throw new Error(event.payload.message);
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
      if (event.type === "operation.failed") throw new Error(event.payload.message);
      setAddressShared(true);
    } catch (caught) {
      setError(toMessage(caught));
    }
  };

  return (
    <section className="panel" aria-labelledby={`wallet-title-${role}`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">WDK self-custody</p>
          <h2 id={`wallet-title-${role}`}>Travel support wallet</h2>
        </div>
        <span className="testnet-badge">Ethereum Sepolia · Testnet only</span>
      </div>

      {wallet === undefined ? (
        <button
          type="button"
          className="primary-button"
          disabled={!runtimeAvailable || status === "loading"}
          onClick={() => void initialize()}
        >
          {status === "loading" ? "Initializing" : "Create or load wallet"}
        </button>
      ) : (
        <div className="wallet-details">
          <div>
            <span>Receive address</span>
            <code>{wallet.address}</code>
          </div>
          <div>
            <span>Test USD₮ balance</span>
            <strong>{balance ?? "Not loaded"}</strong>
          </div>
          <button type="button" className="secondary-button" onClick={() => void refreshBalance()}>
            Refresh balance
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
                Share this public receive address with the connected scout.
              </label>
              <button
                type="button"
                className="secondary-button"
                disabled={!shareApproved}
                onClick={() => void shareAddress()}
              >
                Share receive address
              </button>
              {addressShared ? <p className="success">Public address shared.</p> : null}
            </>
          ) : null}
        </div>
      )}

      {role === "scout" && remotePlayerWallet ? (
        <div className="notice">
          Player receive address: <code>{remotePlayerWallet.address}</code>
        </div>
      ) : null}
      <p className="muted">Recovery material remains in macOS Keychain and is never shown here.</p>
      {!runtimeAvailable ? <div className="warning">Desktop runtime required for WDK.</div> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

const toMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "The self-custodial wallet operation failed.";
