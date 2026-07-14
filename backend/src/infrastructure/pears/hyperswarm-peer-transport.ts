import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import type { Duplex } from "node:stream";

import type {
  PeerConnection,
  PeerConnectionStatus,
  PeerTransport
} from "../../application/ports/integrations.js";
import { PROTOCOL_VERSION } from "../../domain/constants.js";
import type { ScoutPassEvent } from "../../domain/models/events.js";
import { SanitizedLogger, type LogSink } from "../logging/sanitized-logger.js";
import {
  createInviteCode,
  createRelationshipTopic,
  encodeScoutPassEventFrame,
  parseInviteCode,
  ScoutPassEventFrameDecoder
} from "../../protocol/peer-wire.js";

type HyperswarmConstructor = new (options?: { dht?: unknown }) => HyperswarmLike;
export type PearsConnectionStatus = PeerConnectionStatus;

interface HyperswarmLike {
  on(event: "connection" | "error" | "update", listener: (...args: unknown[]) => void): this;
  join(topic: Buffer, options: { server: boolean; client: boolean }): { flushed(): Promise<void> };
  flush(): Promise<void>;
  destroy(): Promise<void>;
}

interface PeerInfoLike {
  publicKey?: Buffer;
}

class HyperswarmConnection implements PeerConnection {
  public readonly remotePublicKey?: string;

  public constructor(
    public readonly relationshipId: string,
    private readonly socket: Duplex,
    remotePublicKey?: string
  ) {
    if (remotePublicKey !== undefined) {
      this.remotePublicKey = remotePublicKey;
    }
  }

  public async send(event: ScoutPassEvent): Promise<void> {
    const payload = encodeScoutPassEventFrame(event);
    await new Promise<void>((resolve, reject) => {
      this.socket.write(payload, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  public close(): Promise<void> {
    this.socket.destroy();
    return Promise.resolve();
  }
}

export interface HyperswarmPeerTransportOptions {
  readonly logSink?: LogSink;
  readonly connectionTimeoutMs?: number;
  readonly dht?: unknown;
}

export class HyperswarmPeerTransport implements PeerTransport {
  readonly #events = new EventEmitter();
  readonly #logger: SanitizedLogger;
  #swarm: HyperswarmLike | undefined;
  #connection: HyperswarmConnection | undefined;
  #activeRelationshipId: string | undefined;
  #status: PearsConnectionStatus = "idle";
  readonly #connectionTimeoutMs: number;
  readonly #dht: unknown;

  public constructor(options: HyperswarmPeerTransportOptions = {}) {
    this.#connectionTimeoutMs = options.connectionTimeoutMs ?? 15_000;
    this.#dht = options.dht;
    this.#logger = new SanitizedLogger(
      options.logSink ?? {
        write: () => undefined
      }
    );
  }

  public createInvite(relationshipId: string): Promise<string> {
    this.#activeRelationshipId = relationshipId;
    this.#setStatus("connecting");
    const topic = createRelationshipTopic(relationshipId);
    const swarm = this.#getSwarm();
    const discovery = swarm.join(topic, { server: true, client: false });
    void discovery.flushed().catch((error: unknown) => {
      this.#logger.warn("Pears invite announce did not flush.", { error });
      this.#setStatus("error");
    });
    this.#setStatus("invite_ready");

    return Promise.resolve(
      createInviteCode({
        protocolVersion: PROTOCOL_VERSION,
        relationshipId,
        topicHex: topic.toString("hex")
      })
    );
  }

  public async connect(inviteCode: string): Promise<PeerConnection> {
    const invite = parseInviteCode(inviteCode);
    this.#activeRelationshipId = invite.relationshipId;
    const topic = Buffer.from(invite.topicHex, "hex");
    const swarm = this.#getSwarm();
    this.#setStatus("connecting");
    swarm.join(topic, { server: false, client: true });
    void swarm.flush().catch((error: unknown) => {
      this.#logger.warn("Pears peer discovery did not flush.", { error });
      this.#setStatus("error");
    });
    return this.#waitForConnection();
  }

  public getStatus(): PearsConnectionStatus {
    return this.#status;
  }

  public onStatus(listener: (status: PearsConnectionStatus) => void): () => void {
    this.#events.on("status", listener);
    return () => this.#events.off("status", listener);
  }

  public onConnection(listener: (connection: PeerConnection) => void): () => void {
    this.#events.on("connection", listener);
    return () => this.#events.off("connection", listener);
  }

  public onEvent(listener: (event: ScoutPassEvent) => Promise<void>): () => void {
    const wrapped = (event: ScoutPassEvent) => {
      void listener(event);
    };
    this.#events.on("event", wrapped);
    return () => this.#events.off("event", wrapped);
  }

  public async dispose(): Promise<void> {
    await this.#connection?.close();
    this.#connection = undefined;
    await this.#swarm?.destroy();
    this.#swarm = undefined;
    this.#setStatus("disconnected");
  }

  #getSwarm(): HyperswarmLike {
    if (this.#swarm !== undefined) {
      return this.#swarm;
    }

    const require = createRequire(import.meta.url);
    const Hyperswarm = require("hyperswarm") as HyperswarmConstructor;

    const swarm = new Hyperswarm(this.#dht === undefined ? undefined : { dht: this.#dht });
    swarm.on("connection", (socketLike: unknown, peerInfoLike: unknown) => {
      const socket = socketLike as Duplex;
      const decoder = new ScoutPassEventFrameDecoder();
      const peerInfo = peerInfoLike as PeerInfoLike;
      const remotePublicKey = peerInfo.publicKey?.toString("hex");
      this.#connection = new HyperswarmConnection(
        this.#activeRelationshipId ?? "relationship_unknown",
        socket,
        remotePublicKey
      );
      this.#events.emit("connection", this.#connection);
      this.#setStatus("connected");

      socket.on("data", (chunk: Buffer) => {
        try {
          for (const event of decoder.push(chunk)) {
            this.#events.emit("event", event);
          }
        } catch (error) {
          this.#logger.warn("Rejected malformed P2P payload.", { error });
        }
      });
      socket.on("close", () => {
        this.#setStatus("disconnected");
        this.#setStatus("reconnecting");
      });
      socket.on("error", (error) => {
        this.#logger.warn("Pears socket error.", { error });
        this.#setStatus("error");
      });
    });
    swarm.on("error", (error) => {
      this.#logger.warn("Pears transport error.", { error });
      this.#setStatus("error");
    });

    this.#swarm = swarm;
    return swarm;
  }

  #setStatus(status: PearsConnectionStatus): void {
    this.#status = status;
    this.#events.emit("status", status);
  }

  #waitForConnection(): Promise<HyperswarmConnection> {
    if (this.#connection !== undefined) {
      return Promise.resolve(this.#connection);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        this.#setStatus("timeout");
        this.#setStatus("peer_not_found");
        reject(new Error("Timed out waiting for a Pears peer connection."));
      }, this.#connectionTimeoutMs);

      const onStatus = (status: PearsConnectionStatus) => {
        if (status === "connected" && this.#connection !== undefined) {
          cleanup();
          resolve(this.#connection);
        }
        if (status === "error") {
          cleanup();
          reject(new Error("Pears peer connection failed."));
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.#events.off("status", onStatus);
      };

      this.#events.on("status", onStatus);
    });
  }
}
