import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import { TryoutPanel } from "../src/features/invitations/TryoutPanel.js";
import { WalletPanel } from "../src/features/wallet/WalletPanel.js";
import { PaymentPanel } from "../src/features/wallet/PaymentPanel.js";
import type { PaymentReference, TryoutInvitation } from "@scoutpass/backend/contracts";

describe("tryout and wallet UI", () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.scoutpassRuntime;
  });

  afterEach(() => cleanup());

  it("previews a complete invitation while keeping the scout note local", () => {
    render(<TryoutPanel role="scout" relationshipId="relationship_demo_001" />);

    const note = screen.getByLabelText(/Private scout assessment/);
    fireEvent.change(note, { target: { value: "Private assessment, never share." } });
    fireEvent.click(screen.getByRole("button", { name: "Save private note" }));
    expect(localStorage.getItem("scoutpass.scoutNote.relationship_demo_001")).toBe(
      "Private assessment, never share."
    );

    fireEvent.click(screen.getByRole("button", { name: "Preview invitation" }));
    expect(screen.getByText("First Team Winger Trial")).toBeInTheDocument();
    expect(screen.getByText(/25.50 USD₮/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send invitation" })).toBeDisabled();
  });

  it("shows a testnet-only WDK wallet without exposing recovery material", () => {
    render(<WalletPanel role="player" relationshipId="relationship_demo_001" />);

    expect(screen.getByText("Ethereum Sepolia · Testnet only")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create or load wallet" })).toBeDisabled();
    expect(screen.getByText(/Recovery material remains in macOS Keychain/)).toBeInTheDocument();
    expect(document.body.textContent?.toLowerCase()).not.toContain("seed phrase");
  });

  it("does not request signing until the scout explicitly confirms the reviewed payment", async () => {
    const invitation: TryoutInvitation = {
      id: "invitation_demo_001",
      relationshipId: "relationship_demo_001",
      clubName: "Izmir Football Club",
      scoutName: "Demo Scout",
      trialTitle: "First Team Winger Trial",
      startsAt: "2026-07-20T10:00:00.000Z",
      endsAt: "2026-07-20T12:00:00.000Z",
      city: "Izmir",
      venue: "Training Ground",
      positionEvaluated: "Right Winger",
      instructions: "Arrive early.",
      contactDetails: "scout@example.test",
      travelSupportAmount: "25.50",
      paymentAsset: "USD₮",
      expiresAt: "2026-07-19T10:00:00.000Z",
      status: "accepted",
      createdAt: "2026-07-14T10:00:00.000Z",
      updatedAt: "2026-07-14T10:00:00.000Z"
    };
    const proposal: PaymentReference = {
      id: "payment_demo_001",
      invitationId: invitation.id,
      relationshipId: invitation.relationshipId,
      destinationAddress: `0x${"1".repeat(40)}`,
      network: "Ethereum Sepolia",
      tokenAddress: "0xd077a400968890eacc75cdc901f0356c943e4fdb",
      asset: "USD₮",
      amount: "25.50",
      feeBaseUnits: "21000000000000",
      status: "proposed",
      createdAt: "2026-07-14T10:00:00.000Z",
      updatedAt: "2026-07-14T10:00:00.000Z"
    };
    const request = vi.fn((command: { readonly requestId: string; readonly type: string }) =>
      Promise.resolve({
        requestId: command.requestId,
        occurredAt: "2026-07-14T10:00:00.000Z",
        type: "payment.updated",
        payload: {
          payment:
            command.type === "payment.confirm"
              ? {
                  ...proposal,
                  status: "pending",
                  transactionId: `0x${"2".repeat(64)}`
                }
              : proposal
        }
      })
    );
    window.scoutpassRuntime = { request, subscribe: () => () => undefined };

    const PaymentHarness = () => {
      const [payment, setPayment] = useState<PaymentReference>();
      return (
        <PaymentPanel
          role="scout"
          invitation={invitation}
          payment={payment}
          onPaymentChange={setPayment}
        />
      );
    };
    render(<PaymentHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Review travel support" }));
    expect(await screen.findByText("25.50 USD₮")).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Confirm and sign" })).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: /I reviewed the invitation/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm and sign" }));
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]?.[0]).toMatchObject({
      type: "payment.confirm",
      payload: { proposalId: proposal.id, userConfirmed: true }
    });
  });
});
