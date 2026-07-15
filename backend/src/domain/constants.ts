export const SCHEMA_VERSION = "1.0.0" as const;
export const PROTOCOL_VERSION = "1.0.0" as const;

export const REPORT_DISCLAIMER =
  "This report is generated from information provided by the player. It is intended to support human scouting and does not verify performance claims or replace professional evaluation.";

export const SELF_REPORTED_DATA_NOTICE =
  "Performance statistics are self-entered by the player and have not been independently verified.";

export const TESTNET_CONFIG = {
  asset: "spUSD",
  chainId: 11155111,
  decimals: 6,
  network: "Ethereum Sepolia",
  tokenAddress: "0x0E746Cf3DFb656dF11AeBa7775Df3C7b74425b18"
} as const;
