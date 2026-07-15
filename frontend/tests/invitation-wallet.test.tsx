import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { TryoutPanel } from "../src/features/invitations/TryoutPanel.js";
import { WalletPanel } from "../src/features/wallet/WalletPanel.js";

describe("tryout and wallet UI", () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.scoutpassRuntime;
  });

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
});
