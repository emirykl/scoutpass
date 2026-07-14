export interface RuntimeInfo {
  readonly mode: "local-first";
  readonly protocolVersion: string;
  readonly status: "ready";
}

export const getRuntimeInfo = (): RuntimeInfo => ({
  mode: "local-first",
  protocolVersion: "1.0.0",
  status: "ready"
});
