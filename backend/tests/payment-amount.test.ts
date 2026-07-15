import { describe, expect, it } from "vitest";

import {
  decimalAmountToBaseUnits,
  InvalidPaymentAmountError
} from "../src/domain/services/payment-amount.js";

describe("payment amount", () => {
  it("converts spUSD decimals without floating point arithmetic", () => {
    expect(decimalAmountToBaseUnits("25.50")).toBe(25_500_000n);
    expect(decimalAmountToBaseUnits("0.000001")).toBe(1n);
  });

  it("rejects zero, negatives, scientific notation, and excessive precision", () => {
    for (const amount of ["0", "-1", "1e3", "1.0000001", "01.5"]) {
      expect(() => decimalAmountToBaseUnits(amount)).toThrow(InvalidPaymentAmountError);
    }
  });
});
