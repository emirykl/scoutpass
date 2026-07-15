declare module "b4a" {
  interface B4a {
    alloc(size: number): Uint8Array;
    concat(buffers: readonly Uint8Array[]): Uint8Array;
    indexOf(buffer: Uint8Array, value: number, byteOffset?: number): number;
    toString(buffer: Uint8Array, encoding?: "utf8" | "hex" | "base64"): string;
  }

  const b4a: B4a;
  export default b4a;
}
