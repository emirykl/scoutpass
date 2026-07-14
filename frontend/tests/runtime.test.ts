import { describe, expect, it } from "vitest";

import { getRuntimeInfo } from "@scoutpass/backend/runtime";

describe("local runtime bridge", () => {
  it("exposes a ready local-first runtime", () => {
    expect(getRuntimeInfo()).toEqual({
      mode: "local-first",
      protocolVersion: "1.0.0",
      status: "ready"
    });
  });
});
