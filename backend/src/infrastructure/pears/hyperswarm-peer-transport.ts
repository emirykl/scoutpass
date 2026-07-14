import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import type { Duplex } from "node:stream";

import type { PeerConnection, PeerTransport } from "../../application/ports/integrations.js";
import { PROTOCOL_VERSION } from "../../domain/constants.js";
import type { ScoutPassEvent } from "../../domain/models/events.js";
import { SanitizedLogger, type LogSink } from "../logging/sanitized-logger.js";
import {
  createInviteCode,
  createRelationshipTopic,
  decodeScoutPassEvent,
  encodeScoutPassEvent,
  parseInviteCode
} from "../../protocol/peer-wire.js";

type HyperswarmConstructor = new () => HyperswarmLike;

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
    const payload = encodeScoutPassEvent(event);
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
}

export class HyperswarmPeerTransport implements PeerTransport {
  readonly #events = new EventEmitter();
  readonly #logger: SanitizedLogger;
  #swarm: HyperswarmLike | undefined;
  #connection: HyperswarmConnection | undefined;
  #activeRelationshipId: string | undefined;

  public constructor(options: HyperswarmPeerTransportOptions = {}) {
    this.#logger = new SanitizedLogger(
      options.logSink ?? {
        write: () => undefined
      }
    );
  }

  public async createInvite(relationshipId: string): Promise<string> {
    this.#activeRelationshipId = relationshipId;
    const topic = createRelationshipTopic(relationshipId);
    const swarm = this.#getSwarm();
    const discovery = swarm.join(topic, { server: true, client: false });
    await discovery.flushed();

    return createInviteCode({
      protocolVersion: PROTOCOL_VERSION,
      relationshipId,
      topicHex: topic.toString("hex")
    });
  }

  public async connect(inviteCode: string): Promise<PeerConnection> {
    const invite = parseInviteCode(inviteCode);
    this.#activeRelationshipId = invite.relationshipId;
    const topic = Buffer.from(invite.topicHex, "hex");
    const swarm = this.#getSwarm();
    swarm.join(topic, { server: false, client: true });
    await swarm.flush();

    if (this.#connection === undefined) {
      throw new Error("No peer connection was established for the invite topic.");
    }
    return this.#connection;
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
  }

  #getSwarm(): HyperswarmLike {
    if (this.#swarm !== undefined) {
      return this.#swarm;
    }

    const require = createRequire(import.meta.url);
    const Hyperswarm = require("hyperswarm") as HyperswarmConstructor;

    const swarm = new Hyperswarm();
    swarm.on("connection", (socketLike: unknown, peerInfoLike: unknown) => {
      const socket = socketLike as Duplex;
      const peerInfo = peerInfoLike as PeerInfoLike;
      const remotePublicKey = peerInfo.publicKey?.toString("hex");
      this.#connection = new HyperswarmConnection(
        this.#activeRelationshipId ?? "relationship_unknown",
        socket,
        remotePublicKey
      );

      socket.on("data", (chunk: Buffer) => {
        try {
          const event = decodeScoutPassEvent(chunk);
          this.#events.emit("event", event);
        } catch (error) {
          this.#logger.warn("Rejected malformed P2P payload.", { error });
        }
      });
    });
    swarm.on("error", (error) => {
      this.#logger.warn("Pears transport error.", { error });
    });

    this.#swarm = swarm;
    return swarm;
  }
}
