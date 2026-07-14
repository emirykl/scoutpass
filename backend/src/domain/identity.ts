import { randomUUID } from "node:crypto";

const PREFIX_PATTERN = /^[a-z][a-z0-9_]{1,24}$/;

export const createId = (prefix: string): string => {
  if (!PREFIX_PATTERN.test(prefix)) {
    throw new Error("ID prefix must contain only lowercase letters, numbers, or underscores.");
  }

  return `${prefix}_${randomUUID()}`;
};
