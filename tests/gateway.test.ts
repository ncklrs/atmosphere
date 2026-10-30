import { createServer, type Server, type RequestListener } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { afterEach, describe, expect, it } from "vitest";
import {
  decodeHex,
  isPrivateIPv4,
  normalize,
  requestCommand,
  WiiMAdapter,
} from "../packages/adapter-wiim/index";
import { startGateway } from "../apps/gateway/src/server";
import { safeArtworkUrl } from "../packages/playback-core/artwork";
const resources: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of resources.splice(0).reverse()) await close();
});
async function mock(handler: RequestListener) {
  const server = createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  resources.push(
    () => new Promise<void>((resolve) => server.close(() => resolve())),
  );
  return { server, port: (server.address() as AddressInfo).port };
}
const waitFor = async (predicate: () => boolean) => {
  const end = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > end) throw new Error("condition timeout");
    await new Promise((r) => setTimeout(r, 20));
  }
};
describe("WiiM adapter", () => {
  it("allowlists artwork without an arbitrary URL proxy", () => {
    expect(safeArtworkUrl("https://i.scdn.co/image/fixture")).toBe(
      "https://i.scdn.co/image/fixture",
    );
    for (const value of [
      "http://i.scdn.co/image/x",
      "https://i.scdn.co.evil.test/x",
      "https://user:pass@i.scdn.co/x",
      "https://i.scdn.co:9000/x",
      "http://169.254.169.254/x",
    ])
      expect(safeArtworkUrl(value)).toBeNull();
  });
  it("falls back from blank status metadata to actual meta fields", () => {
    expect(
      normalize(
        { Title: "", Artist: "", status: "pause" },
        { title: "A real title", artist: "An artist" },
        0,
        1,
      ),
    ).toMatchObject({
      title: "A real title",
      artist: "An artist",
      state: "paused",
    });
  });
  it("decodes UTF-8 hex and preserves plain titles", () => {
    expect(decodeHex(Buffer.from("Björk · 水").toString("hex"))).toBe(
      "Björk · 水",
    );
    expect(decodeHex("Still water")).toBe("Still water");
    expect(decodeHex("ffff")).toBe("ffff");
  });
  it("normalizes milliseconds and refuses remote artwork", () => {
    const state = normalize(
      {
        status: "play",
        curpos: "184919",
        totlen: "240000",
        Title: "Song",
        Artist: "Artist",
        cover: "http://127.0.0.1/secret",
      },
      {},
      123,
      4,
    );
    expect(state).toMatchObject({
      state: "playing",
      positionMs: 184919,
      durationMs: 240000,
      artworkUrl: null,
      revision: 4,
    });
    expect(
      normalize({ status: "pause", curpos: "NaN" }, {}, 0, 1).positionMs,
    ).toBe(0);
  });
  it("rejects public IP, hostnames, redirects and oversized replies", async () => {
    expect(isPrivateIPv4("169.254.169.254")).toBe(false);
    expect(isPrivateIPv4("example.com")).toBe(false);
    expect(() => new WiiMAdapter({ host: "8.8.8.8" })).toThrow();
    const { port } = await mock((_req, res) => {
      res.writeHead(302, { Location: "http://8.8.8.8" });
      res.end();
    });
    await expect(
      requestCommand({ host: "127.0.0.1", port }, "http", "getPlayerStatus"),
    ).rejects.toThrow("302");
  });
  it("falls back to supported command and metadata", async () => {
    const { port } = await mock((req, res) => {
      const command = new URL(req.url!, "http://localhost").searchParams.get(
        "command",
      );
      if (command === "getPlayerStatusEx") {
        res.writeHead(404);
        res.end();
      } else
        res.end(
          JSON.stringify(
            command === "getMetaInfo"
              ? { metaData: { title: "Song", artist: "Artist" } }
              : { status: "play", curpos: "1234", totlen: "10000" },
          ),
        );
    });
    const adapter = new WiiMAdapter({
      host: "127.0.0.1",
      port,
      protocols: ["http"],
    });
    expect(await adapter.sample(() => 10, 1)).toMatchObject({
      title: "Song",
      positionMs: 1234,
    });
    expect(adapter.capability).toMatchObject({
      command: "getPlayerStatus",
      metadata: true,
    });
  });
  it("times out stalled requests", async () => {
    const { port, server } = await mock(() => {});
    const promise = requestCommand(
      { host: "127.0.0.1", port, timeoutMs: 30 },
      "http",
      "getPlayerStatus",
    );
    await expect(promise).rejects.toThrow("timed out");
    (server as Server).closeAllConnections();
  });
});
describe("gateway integration", () => {
  it("serves read-only snapshots, rejects hostile origins and reconnects after device outages", async () => {
    let online = true;
    const { port } = await mock((req, res) => {
      if (!online) {
        res.writeHead(503);
        res.end();
        return;
      }
      const command = new URL(req.url!, "http://localhost").searchParams.get(
        "command",
      );
      res.end(
        JSON.stringify(
          command === "getMetaInfo"
            ? { title: "Fixture", artist: "Mock" }
            : {
                status: "play",
                curpos: "1000",
                totlen: "90000",
                Title: "Fixture",
                Artist: "Mock",
              },
        ),
      );
    });
    const gateway = await startGateway({
      port: 0,
      wiim: { host: "127.0.0.1", port, protocols: ["http"], timeoutMs: 100 },
      pollMs: 40,
      idlePollMs: 40,
    });
    resources.push(() => gateway.close());
    await waitFor(() => gateway.snapshot().connected);
    const base = `http://127.0.0.1:${gateway.port}`;
    expect((await fetch(base + "/health")).status).toBe(200);
    expect(
      (
        await fetch(base + "/state", {
          headers: { Origin: "http://evil.test" },
        })
      ).status,
    ).toBe(403);
    expect((await fetch(base + "/state", { method: "POST" })).status).toBe(405);
    const socket = new WebSocket(`ws://127.0.0.1:${gateway.port}/events`, {
      origin: "http://127.0.0.1:3000",
    });
    const messages: unknown[] = [];
    socket.on("message", (data) => messages.push(JSON.parse(String(data))));
    resources.push(async () => socket.terminate());
    await waitFor(() => messages.length > 0);
    expect(gateway.snapshot().playback.title).toBe("Fixture");
    online = false;
    await waitFor(() => !gateway.snapshot().connected);
    expect(gateway.snapshot().playback.state).toBe("unknown");
    expect((await fetch(base + "/health")).status).toBe(503);
    online = true;
    await waitFor(() => gateway.snapshot().connected);
    expect(gateway.snapshot().playback.state).toBe("playing");
    socket.terminate();
    const next = new WebSocket(`ws://127.0.0.1:${gateway.port}/events`, {
      origin: "http://127.0.0.1:3000",
    });
    resources.push(async () => next.terminate());
    await new Promise<void>((resolve, reject) => {
      next.once("message", () => resolve());
      next.once("error", reject);
    });
  });
});
