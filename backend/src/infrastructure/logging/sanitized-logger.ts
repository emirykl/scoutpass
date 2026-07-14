const SENSITIVE_KEY = /(?:mnemonic|private.?key|seed|secret|passphrase)/i;
const REDACTED = "[REDACTED]";

export const sanitizeLogValue = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (typeof value !== "object" || value === null) {
    return value;
  }
  if (seen.has(value)) {
    return "[CIRCULAR]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      SENSITIVE_KEY.test(key) ? REDACTED : sanitizeLogValue(nestedValue, seen)
    ])
  );
};

export interface LogSink {
  write(level: "error" | "info" | "warn", message: string, context?: unknown): void;
}

export class SanitizedLogger {
  public constructor(private readonly sink: LogSink) {}

  public info(message: string, context?: unknown): void {
    this.sink.write("info", message, sanitizeLogValue(context));
  }

  public warn(message: string, context?: unknown): void {
    this.sink.write("warn", message, sanitizeLogValue(context));
  }

  public error(message: string, context?: unknown): void {
    this.sink.write("error", message, sanitizeLogValue(context));
  }
}
