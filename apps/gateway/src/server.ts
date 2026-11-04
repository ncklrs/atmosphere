import { createRoom } from "./room";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer, WebSocket } from "ws";
import {
  emptyPlayback,
  positionAt,
  reconcile,
  type LyricResult,
  type Snapshot,
} from "../../../packages/playback-core/index";
import {
  demoLyrics,
  demoPlayback,
  tracks,
} from "../../../packages/fixtures/index";
import {
  WiiMAdapter,
  type ProbeOptions,
} from "../../../packages/adapter-wiim/index";
import {
  LyricResolver,
  LrclibProvider,
  type LyricProvider,
} from "../../../packages/lyrics/index";
import { SoftwareBrightness } from "../../../packages/circadian/brightness";
export interface GatewayOptions {
  roomFile?: string;
  port?: number;
  wiim?: ProbeOptions;
  lyrics?: boolean;
  lyricProvider?: LyricProvider;
  origin?: string;
  pollMs?: number;
  idlePollMs?: number;
}
export async function startGateway(options: GatewayOptions = {}) {
  let playback = emptyPlayback(performance.now()),
    lyrics: LyricResult | null = null,
    connected = false,
    errors = 0,
    closed = false,
    lastError: string | null = null;
  let revision = 0,
    trackIndex = 0,
    timer: ReturnType<typeof setTimeout> | undefined;
  const adapter = options.wiim ? new WiiMAdapter(options.wiim) : null;
  const resolver = options.lyrics
    ? new LyricResolver(options.lyricProvider ?? new LrclibProvider())
    : null;
  const sessionId = randomUUID();
  const origin = options.origin ?? "http://127.0.0.1:3000";
  const snapshot = (): Snapshot => ({
    type: "snapshot",
    sessionId,
    playback: {
      ...playback,
      positionMs: positionAt(playback, performance.now()),
      sampledAtMonotonicMs: 0,
    },
    lyrics,
    connected,
    sentAt: Date.now(),
  });
  const capabilities = () => ({
    source: adapter ? "wiim" : "demo",
    device: adapter?.capability ?? null,
    lyrics: resolver ? "LRCLIB opt-in" : "original demo / live lyrics disabled",
    brightness: new SoftwareBrightness().capabilities(),
    artwork: "allowlisted Spotify CDN only; original procedural fallback",
    controls: "read-only live source",
    errors,
    lastError,
  });
  const room = await createRoom(options.roomFile);
  const server = createServer((request, response) => {
    const host = request.headers.host?.split(":")[0];
    if (!["127.0.0.1", "localhost"].includes(host ?? "")) {
      response.writeHead(403);
      response.end();
      return;
    }
    if (request.headers.origin && request.headers.origin !== origin) {
      response.writeHead(403);
      response.end();
      return;
    }
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json");
    response.setHeader("X-Content-Type-Options", "nosniff");
    const roomPath = request.url?.split("?")[0] ?? "";
    if (roomPath.startsWith("/room/")) {
      void room.handle(request, response, roomPath);
      return;
    }
    if (request.method !== "GET") {
      response.writeHead(405);
      response.end(JSON.stringify({ error: "read-only" }));
      return;
    }
    const path = request.url?.split("?")[0];
    if (path === "/health") {
      response.writeHead(connected ? 200 : 503);
      response.end(
        JSON.stringify({
          ok: connected,
          mode: adapter ? "wiim" : "demo",
          errors,
          lastError,
        }),
      );
    } else if (path === "/state") response.end(JSON.stringify(snapshot()));
    else if (path === "/capabilities")
      response.end(JSON.stringify(capabilities()));
    else {
      response.writeHead(404);
      response.end(JSON.stringify({ error: "not found" }));
    }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  server.on("upgrade", (request, socket, head) => {
    if (
      request.url !== "/events" ||
      request.headers.origin !== origin ||
      wss.clients.size >= 16
    ) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) =>
      wss.emit("connection", ws, request),
    );
  });
  wss.on("connection", (ws) => {
    ws.send(JSON.stringify(snapshot()));
    ws.on("error", () => ws.terminate());
    ws.on("message", () => ws.close(1008, "Read-only stream"));
  });
  const publish = () => {
    const message = JSON.stringify(snapshot());
    for (const client of wss.clients) {
      if (client.bufferedAmount > 262144) client.terminate();
      else if (client.readyState === WebSocket.OPEN) client.send(message);
    }
  };
  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.ping();
    }
  }, 15000);
  async function poll() {
    if (closed) return;
    try {
      if (adapter) {
        const sample = await adapter.sample(
          () => performance.now(),
          ++revision,
        );
        const changed = sample.trackKey !== playback.trackKey;
        playback = reconcile(playback, sample);
        connected = true;
        lastError = null;
        if (changed) lyrics = null;
        if (resolver && sample.trackKey && (changed || !lyrics)) {
          void resolver.resolve(sample).then((result) => {
            if (!closed && playback.trackKey === sample.trackKey) {
              lyrics = result;
              publish();
            }
          });
        }
      } else {
        const now = performance.now();
        if (
          !playback.trackKey ||
          positionAt(playback, now) >= playback.durationMs
        ) {
          if (playback.trackKey) trackIndex = (trackIndex + 1) % tracks.length;
          playback = demoPlayback(trackIndex, now, ++revision);
          lyrics = demoLyrics(trackIndex);
        } else
          playback = {
            ...playback,
            positionMs: positionAt(playback, now),
            sampledAtMonotonicMs: now,
            revision: ++revision,
          };
        connected = true;
      }
    } catch (error) {
      errors++;
      connected = false;
      lastError = error instanceof Error ? error.message : "Device unavailable";
      playback = {
        ...playback,
        positionMs: positionAt(playback, performance.now()),
        sampledAtMonotonicMs: performance.now(),
        state: "unknown",
        revision: ++revision,
      };
    }
    if (closed) return;
    publish();
    timer = setTimeout(
      poll,
      playback.state === "playing"
        ? (options.pollMs ?? 500)
        : (options.idlePollMs ?? 1000),
    );
  }
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 8787, "127.0.0.1", resolve);
  }).catch((error) => {
    clearInterval(heartbeat);
    throw error;
  });
  void poll();
  return {
    port: (server.address() as AddressInfo).port,
    snapshot,
    capabilities,
    async close() {
      closed = true;
      clearTimeout(timer);
      clearInterval(heartbeat);
      for (const client of wss.clients) client.terminate();
      await new Promise<void>((resolve) =>
        wss.close(() => server.close(() => resolve())),
      );
    },
  };
}
