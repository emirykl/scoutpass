import { moneyAmountSchema } from "../models/invitation.js";

export class InvalidPaymentAmountError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidPaymentAmountError";
  }
}

export const decimalAmountToBaseUnits = (amount: string, decimals = 6): bigint => {
  const result = moneyAmountSchema.safeParse(amount);
  if (!result.success) {
    throw new InvalidPaymentAmountError("Payment amount must be a valid non-negative decimal.");
  }

  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new InvalidPaymentAmountError("Asset decimals must be an integer between 0 and 18.");
  }

  const [whole = "0", fraction = ""] = amount.split(".");
  if (fraction.length > decimals) {
    throw new InvalidPaymentAmountError("Payment amount exceeds the asset precision.");
  }

  const units =
    BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
  if (units <= 0n) {
    throw new InvalidPaymentAmountError("Payment amount must be greater than zero.");
  }

  return units;
};
