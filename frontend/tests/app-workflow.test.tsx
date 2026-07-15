import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/app/App.js";

describe("role-focused ScoutPass workspace", () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.scoutpassRuntime;
  });

  afterEach(() => cleanup());

  it("starts directly in the player profile workflow", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Your football profile, under your control" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tell your football story" })).toBeInTheDocument();

    const playerSteps = screen.getByRole("navigation", { name: "player steps" });
    expect(within(playerSteps).queryByRole("button", { name: /Overview/ })).not.toBeInTheDocument();
    expect(within(playerSteps).queryByRole("button", { name: /Settings/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Your scouting report" })).not.toBeInTheDocument();

    fireEvent.click(within(playerSteps).getByRole("button", { name: /AI report/ }));

    expect(screen.getByRole("heading", { name: "Your scouting report" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Player summary" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Tell your football story" })
    ).not.toBeInTheDocument();
  });

  it("keeps privacy controls outside the role workflow", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Privacy & data" }));
    expect(screen.getByRole("heading", { name: "Privacy & local data" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "player steps" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to workflow" }));
    expect(screen.getByRole("navigation", { name: "player steps" })).toBeInTheDocument();
  });

  it("switches directly to the scout connection workflow", () => {
    render(<App />);

    const rolePicker = screen.getByLabelText("Choose role");
    fireEvent.click(within(rolePicker).getByRole("button", { name: "Scout" }));

    expect(
      screen.getByRole("heading", { name: "A direct path from player to tryout" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Invite a player" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "scout steps" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /AI report/ })).not.toBeInTheDocument();

    const scoutSteps = screen.getByRole("navigation", { name: "scout steps" });
    fireEvent.click(within(scoutSteps).getByRole("button", { name: /Tryout/ }));
    expect(screen.getByRole("heading", { name: "Prepare a player trial" })).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Scout and club identity is not verified");
  });
});
