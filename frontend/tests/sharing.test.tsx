import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PreparedPlayerShare } from "@scoutpass/backend/sharing";

import { SharingPanel } from "../src/features/sharing/SharingPanel.js";
import { createLocalPreviewReport, demoPlayerProfile } from "../src/runtime/local-runtime.js";

describe("selective sharing panel", () => {
  it("previews only default fields and requires explicit approval", async () => {
    const player = {
      ...demoPlayerProfile,
      contact: { email: "private@example.test" }
    };
    const sent: PreparedPlayerShare[] = [];
    const onSend = (prepared: PreparedPlayerShare): Promise<void> => {
      sent.push(prepared);
      return Promise.resolve();
    };
    render(
      <SharingPanel player={player} report={createLocalPreviewReport(player)} onSend={onSend} />
    );

    expect(screen.getByRole("checkbox", { name: /Basic football profile/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Player summary/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Strengths/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Contact information/ })).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Prepare preview" }));
    const preview = screen.getByTestId("share-json-preview");
    expect(preview).not.toHaveTextContent("private@example.test");
    expect(preview).not.toHaveTextContent("coachFeedback");

    const sendButton = screen.getByRole("button", { name: "Send to scout" });
    expect(sendButton).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /I approve sharing exactly/ }));
    expect(sendButton).toBeEnabled();
    fireEvent.click(sendButton);

    await waitFor(() => expect(sent).toHaveLength(1));
    const delivered = sent[0];
    expect(delivered).toBeDefined();
    expect(delivered?.serializedPayload).toBe(JSON.stringify(delivered?.package));
  });
});
