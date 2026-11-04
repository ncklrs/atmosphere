import { randomInt, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { dirname } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  validateSettings,
  type Settings,
} from "../../../packages/room/settings";
export async function createRoom(file?: string) {
  let settings: Settings | null = null,
    enabled = false,
    revision = 0;
  let code = randomInt(1000000).toString().padStart(6, "0");
  const sessionId = randomUUID();
  const port = Number(process.env.ROOM_LAN_PORT ?? 3211);
  const controllerUrls = Object.values(networkInterfaces())
    .flat()
    .filter(
      (info) =>
        info &&
        info.family === "IPv4" &&
        !info.internal &&
        /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(info.address),
    )
    .map(
      (info) =>
        `http://${info!.address}:${Number.isInteger(port) && port > 0 && port < 65536 ? port : 3211}/remote`,
    );
  const tokens = new Set<string>();
  let attempts = 0,
    attemptWindow = Date.now(),
    writing = Promise.resolve();
  if (file)
    try {
      const saved = JSON.parse(await readFile(file, "utf8"));
      if (saved.enabled && saved.settings) {
        settings = validateSettings(saved.settings);
        enabled = true;
        revision = 1;
      }
    } catch {
      /* First run or invalid file. */
    }
  const persist = () => {
    if (!file) return Promise.resolve();
    const body = JSON.stringify({ enabled, settings });
    writing = writing
      .catch(() => {})
      .then(async () => {
        await mkdir(dirname(file), { recursive: true });
        const temp = `${file}.tmp`;
        await writeFile(temp, body, { mode: 0o600 });
        await rename(temp, file);
      });
    return writing;
  };
  const snapshot = (owner: boolean) => ({
    sessionId,
    enabled,
    revision,
    settings,
    owner,
    ...(owner && enabled ? { code, controllerUrls } : {}),
  });
  async function handle(
    req: IncomingMessage,
    res: ServerResponse,
    path: string,
  ) {
    const owner = req.headers["x-atmosphere-room-owner"] === "1";
    const token = String(req.headers["x-atmosphere-room-token"] ?? "");
    const authorized = owner || tokens.has(token);
    const reply = (status: number, value: unknown) => {
      res.writeHead(status);
      res.end(JSON.stringify(value));
    };
    if (req.method === "GET" && path === "/room/state") {
      if (!authorized) {
        reply(401, { error: "Pair this controller to the display.", enabled });
        return;
      }
      reply(200, snapshot(owner));
      return;
    }
    if (req.method !== "POST") {
      reply(405, { error: "Method not allowed" });
      return;
    }
    if (path !== "/room/pair" && !authorized) {
      reply(401, { error: "Pair this controller to the display." });
      return;
    }
    let body = "";
    try {
      for await (const chunk of req) {
        body += chunk.toString();
        if (Buffer.byteLength(body) > 65536) {
          reply(413, { error: "Settings are too large." });
          return;
        }
      }
      const data = JSON.parse(body || "{}");
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        reply(400, { error: "Invalid request" });
        return;
      }
      if (path === "/room/pair") {
        if (Date.now() - attemptWindow > 60000) {
          attempts = 0;
          attemptWindow = Date.now();
        }
        if (++attempts > 8) {
          reply(429, {
            error: "Too many pairing attempts. Wait a minute and try again.",
          });
          return;
        }
        if (!enabled || typeof data.code !== "string" || data.code !== code) {
          reply(403, { error: "That pairing code did not match." });
          return;
        }
        const issued = randomUUID();
        if (tokens.size >= 32) tokens.delete(tokens.values().next().value!);
        tokens.add(issued);
        reply(200, { token: issued });
        return;
      }
      if (path === "/room/enable" && owner) {
        settings = validateSettings(data.settings ?? settings);
        enabled = true;
        revision++;
        await persist();
        reply(200, snapshot(true));
        return;
      }
      if (path === "/room/disable" && owner) {
        enabled = false;
        tokens.clear();
        code = randomInt(1000000).toString().padStart(6, "0");
        revision++;
        await persist();
        reply(200, snapshot(true));
        return;
      }
      if (path === "/room/settings" && enabled) {
        if (
          !data.patch ||
          typeof data.patch !== "object" ||
          Array.isArray(data.patch)
        ) {
          reply(400, { error: "Invalid settings patch" });
          return;
        }
        settings = validateSettings({ ...settings, ...data.patch });
        revision++;
        await persist();
        reply(200, snapshot(owner));
        return;
      }
      reply(403, {
        error:
          "Room controls are disabled or this action needs the display owner.",
      });
    } catch {
      reply(400, { error: "Could not apply room settings." });
    }
  }
  return { handle };
}
