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

  it("shows only the active player task", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Profile editor" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Local scouting report" })
    ).not.toBeInTheDocument();

    const playerSteps = screen.getByRole("navigation", { name: "player steps" });
    fireEvent.click(within(playerSteps).getByRole("button", { name: /Local report/ }));

    expect(screen.getByRole("heading", { name: "Local scouting report" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Profile editor" })).not.toBeInTheDocument();
  });

  it("switches to the shorter scout workflow", () => {
    render(<App />);

    const rolePicker = screen.getByLabelText("Choose role");
    fireEvent.click(within(rolePicker).getByRole("button", { name: "Scout" }));

    expect(screen.getByRole("heading", { name: "Scouting connection" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "scout steps" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Local report/ })).not.toBeInTheDocument();
  });
});
