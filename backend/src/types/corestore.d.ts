declare module "corestore" {
  interface Hypercore<T> {
    readonly length: number;
    ready(): Promise<void>;
    append(value: T): Promise<number>;
    close(): Promise<void>;
  }

  interface CorestoreGetOptions {
    readonly name: string;
    readonly valueEncoding?: "json" | "utf-8" | "binary";
  }

  export default class Corestore {
    public constructor(storage: string);
    public ready(): Promise<void>;
    public get<T>(options: CorestoreGetOptions): Hypercore<T>;
    public close(): Promise<void>;
  }
}
