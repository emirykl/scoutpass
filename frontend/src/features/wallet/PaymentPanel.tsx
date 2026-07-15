import { useEffect, useState } from "react";

import type { PaymentReference, TryoutInvitation } from "@scoutpass/backend/contracts";

import {
  createRuntimeRequest,
  isDesktopRuntimeAvailable,
  requestRuntime,
  subscribeRuntimeEvents
} from "../../runtime/runtime-bridge.js";

interface PaymentPanelProps {
  readonly role: "player" | "scout";
  readonly invitation?: TryoutInvitation | undefined;
  readonly payment?: PaymentReference | undefined;
  readonly onPaymentChange: (payment: PaymentReference) => void;
}

export function PaymentPanel({ role, invitation, payment, onPaymentChange }: PaymentPanelProps) {
  const [confirmedReview, setConfirmedReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const runtimeAvailable = isDesktopRuntimeAvailable();

  useEffect(
    () =>
      subscribeRuntimeEvents((event) => {
        if (event.type === "payment.updated") onPaymentChange(event.payload.payment);
      }),
    [onPaymentChange]
  );

  const run = async (
    command:
      | { readonly type: "payment.review"; readonly payload: { readonly invitationId: string } }
      | {
          readonly type: "payment.confirm";
          readonly payload: { readonly proposalId: string; readonly userConfirmed: true };
        }
      | { readonly type: "payment.reject"; readonly payload: { readonly proposalId: string } }
      | { readonly type: "payment.status.get"; readonly payload: { readonly paymentId: string } }
  ) => {
    setBusy(true);
    setError(undefined);
    try {
      const event = await requestRuntime({ ...createRuntimeRequest(), ...command });
      if (event.type === "operation.failed") throw new Error(event.payload.message);
      if (event.type !== "payment.updated") {
        throw new Error("Desktop runtime did not return a payment update.");
      }
      onPaymentChange(event.payload.payment);
      setConfirmedReview(false);
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  if (role === "player") {
    return (
      <PaymentResult
        title="Travel support"
        invitation={invitation}
        payment={payment}
        onRefresh={() =>
          payment && void run({ type: "payment.status.get", payload: { paymentId: payment.id } })
        }
        busy={busy}
      />
    );
  }

  return (
    <section className="panel" aria-labelledby="payment-review-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Reviewed travel support</p>
          <h2 id="payment-review-title">Payment review</h2>
        </div>
        <span className="testnet-badge">Ethereum Sepolia · Testnet only</span>
      </div>

      {payment === undefined ? (
        <div className="payment-empty">
          <p className="summary">
            Review is available only after the player accepts an invitation and shares a receive
            address through this scouting connection.
          </p>
          <button
            type="button"
            className="primary-button"
            disabled={!runtimeAvailable || busy || invitation?.status !== "accepted"}
            onClick={() =>
              invitation &&
              void run({ type: "payment.review", payload: { invitationId: invitation.id } })
            }
          >
            Review travel support
          </button>
        </div>
      ) : (
        <div className="payment-review">
          <PaymentFacts invitation={invitation} payment={payment} />
          {payment.status === "proposed" ? (
            <>
              <label className="approval-row">
                <input
                  type="checkbox"
                  checked={confirmedReview}
                  onChange={(event) => setConfirmedReview(event.target.checked)}
                />
                I reviewed the invitation, player address, amount, network and estimated fee.
              </label>
              <div className="response-actions">
                <button
                  type="button"
                  className="primary-button"
                  disabled={!runtimeAvailable || busy || !confirmedReview}
                  onClick={() =>
                    void run({
                      type: "payment.confirm",
                      payload: { proposalId: payment.id, userConfirmed: true }
                    })
                  }
                >
                  Confirm and sign
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!runtimeAvailable || busy}
                  onClick={() =>
                    void run({ type: "payment.reject", payload: { proposalId: payment.id } })
                  }
                >
                  Reject payment
                </button>
              </div>
            </>
          ) : null}
          {payment.status === "pending" ? (
            <button
              type="button"
              className="secondary-button"
              disabled={!runtimeAvailable || busy}
              onClick={() =>
                void run({ type: "payment.status.get", payload: { paymentId: payment.id } })
              }
            >
              Refresh transaction status
            </button>
          ) : null}
        </div>
      )}
      <p className="muted">
        This is optional testnet travel support, not escrow, a fee, identity verification or a
        recruitment guarantee.
      </p>
      {!runtimeAvailable ? <div className="warning">Desktop runtime required for WDK.</div> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

function PaymentResult({
  title,
  invitation,
  payment,
  onRefresh,
  busy
}: {
  readonly title: string;
  readonly invitation?: TryoutInvitation | undefined;
  readonly payment?: PaymentReference | undefined;
  readonly onRefresh: () => void;
  readonly busy: boolean;
}) {
  return (
    <section className="panel" aria-labelledby="player-payment-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Testnet transaction</p>
          <h2 id="player-payment-title">{title}</h2>
        </div>
        <span className="testnet-badge">Ethereum Sepolia · Testnet only</span>
      </div>
      {payment === undefined ? (
        <p className="summary">No travel support transaction has been received.</p>
      ) : (
        <div className="payment-review">
          <PaymentFacts invitation={invitation} payment={payment} />
          {payment.status === "pending" ? (
            <button type="button" className="secondary-button" disabled={busy} onClick={onRefresh}>
              Refresh transaction status
            </button>
          ) : null}
        </div>
      )}
      <p className="muted">
        The displayed status comes from the testnet transaction result; it does not verify a club or
        guarantee recruitment.
      </p>
    </section>
  );
}

function PaymentFacts({
  invitation,
  payment
}: {
  readonly invitation?: TryoutInvitation | undefined;
  readonly payment: PaymentReference;
}) {
  return (
    <dl className="payment-facts">
      <div>
        <dt>Invitation</dt>
        <dd>{invitation?.trialTitle ?? payment.invitationId}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>
          <span className={`status-pill status-${payment.status}`}>{payment.status}</span>
        </dd>
      </div>
      <div>
        <dt>Network</dt>
        <dd>{payment.network}</dd>
      </div>
      <div>
        <dt>Asset and amount</dt>
        <dd>
          {payment.amount} {payment.asset}
        </dd>
      </div>
      <div className="wide">
        <dt>Player destination</dt>
        <dd>
          <code>{payment.destinationAddress}</code>
        </dd>
      </div>
      <div>
        <dt>Estimated network fee</dt>
        <dd>{formatWei(payment.feeBaseUnits)} Sepolia ETH</dd>
      </div>
      {payment.transactionId ? (
        <div className="wide">
          <dt>Transaction identifier</dt>
          <dd>
            <code>{payment.transactionId}</code>
          </dd>
        </div>
      ) : null}
      {payment.failureReason ? (
        <div className="wide">
          <dt>Failure</dt>
          <dd>{payment.failureReason}</dd>
        </div>
      ) : null}
    </dl>
  );
}

const formatWei = (fee: string): string => {
  const padded = fee.padStart(19, "0");
  const whole = padded.slice(0, -18);
  const fraction = padded.slice(-18).replace(/0+$/, "");
  return fraction.length === 0 ? whole : `${whole}.${fraction}`;
};

const toMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "The testnet payment operation failed.";
