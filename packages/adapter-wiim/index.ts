import http from "node:http";
import https from "node:https";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import type { Playback } from "../playback-core/index";
import { safeArtworkUrl } from "../playback-core/artwork";
export function isPrivateIPv4(host: string) {
  if (isIP(host) !== 4) return false;
  const [a, b] = host.split(".").map(Number);
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 127
  );
}
export function decodeHex(value: unknown): string {
  if (typeof value !== "string") return "";
  if (value.length < 4 || value.length % 2 || !/^[a-f\d]+$/i.test(value))
    return value;
  const decoded = Buffer.from(value, "hex").toString("utf8");
  return decoded.includes("\uFFFD") || /[\x00-\x08\x0e-\x1f]/.test(decoded)
    ? value
    : decoded;
}
const numeric = (value: unknown) =>
  Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
export function normalize(
  status: Record<string, unknown>,
  meta: Record<string, unknown>,
  now: number,
  revision: number,
): Playback {
  const firstText = (...values: unknown[]) =>
    values
      .map(decodeHex)
      .map((value) => value.trim())
      .find((value) => value && !/^(?:unknow|unknown|n\/a)$/i.test(value)) ??
    "";
  const title = firstText(status.Title, status.title, meta.Title, meta.title);
  const artist = firstText(
    status.Artist,
    status.artist,
    meta.Artist,
    meta.artist,
  );
  const album = firstText(status.Album, status.album, meta.Album, meta.album);
  const durationMs = numeric(status.totlen ?? status.duration ?? meta.totlen);
  const rawState = String(status.status ?? "").toLowerCase();
  const state =
    rawState === "play" || rawState === "playing"
      ? "playing"
      : rawState === "pause" || rawState === "paused"
        ? "paused"
        : rawState === "stop" || rawState === "stopped"
          ? "stopped"
          : "unknown";
  return {
    sourceId: "wiim",
    trackKey: title
      ? createHash("sha256")
          .update(JSON.stringify([title, artist, album, durationMs]))
          .digest("hex")
          .slice(0, 24)
      : "",
    title,
    artist,
    album,
    artworkUrl: safeArtworkUrl(
      decodeHex(
        status.cover ?? status.albumArtURI ?? meta.cover ?? meta.albumArtURI,
      ),
    ),
    durationMs,
    positionMs: Math.min(
      durationMs || Infinity,
      numeric(status.curpos ?? status.position),
    ),
    sampledAtMonotonicMs: now,
    state,
    confidence: title && artist ? 0.9 : title ? 0.5 : 0,
    revision,
  };
}
export interface ProbeOptions {
  host: string;
  port?: number;
  timeoutMs?: number;
  allowSelfSigned?: boolean;
  protocols?: ("http" | "https")[];
}
export function requestCommand(
  options: ProbeOptions,
  protocol: "http" | "https",
  command: string,
): Promise<Record<string, unknown>> {
  if (!isPrivateIPv4(options.host))
    return Promise.reject(
      new Error("WiiM host must be a literal private IPv4 address"),
    );
  return new Promise((resolve, reject) => {
    const client = protocol === "https" ? https : http;
    const req = client.get(
      {
        hostname: options.host,
        port: options.port ?? (protocol === "https" ? 443 : 80),
        path: `/httpapi.asp?command=${encodeURIComponent(command)}`,
        timeout: options.timeoutMs ?? 1500,
        rejectUnauthorized: !options.allowSelfSigned,
        headers: { Accept: "application/json" },
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`WiiM returned HTTP ${response.statusCode}`));
          return;
        }
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
          if (body.length > 131072)
            req.destroy(new Error("WiiM response too large"));
        });
        response.on("error", reject);
        response.on("end", () => {
          try {
            const data: unknown = JSON.parse(body);
            if (!data || typeof data !== "object" || Array.isArray(data))
              throw new Error("Invalid WiiM JSON");
            resolve(data as Record<string, unknown>);
          } catch {
            reject(new Error("Invalid WiiM JSON"));
          }
        });
      },
    );
    const deadline = setTimeout(
      () => req.destroy(new Error("WiiM timed out")),
      options.timeoutMs ?? 1500,
    );
    req.once("close", () => clearTimeout(deadline));
    req.on("timeout", () => req.destroy(new Error("WiiM timed out")));
    req.on("error", reject);
  });
}
export class WiiMAdapter {
  capability: { protocol: string; command: string; metadata: boolean } | null =
    null;
  constructor(private options: ProbeOptions) {
    if (!isPrivateIPv4(options.host))
      throw new Error("WiiM host must be private IPv4");
  }
  async sample(now: () => number, revision: number): Promise<Playback> {
    const protocols = this.options.protocols ?? ["https", "http"];
    const attempts = this.capability
      ? [
          {
            protocol: this.capability.protocol as "http" | "https",
            command: this.capability.command,
          },
          ...protocols.flatMap((protocol) =>
            ["getPlayerStatusEx", "getPlayerStatus"].map((command) => ({
              protocol,
              command,
            })),
          ),
        ]
      : protocols.flatMap((protocol) =>
          ["getPlayerStatusEx", "getPlayerStatus"].map((command) => ({
            protocol,
            command,
          })),
        );
    for (const attempt of attempts) {
      try {
        const status = await requestCommand(
          this.options,
          attempt.protocol,
          attempt.command,
        );
        if (!("status" in status)) continue;
        const sampledAt = now();
        let meta: Record<string, unknown> = {};
        try {
          const data = await requestCommand(
            this.options,
            attempt.protocol,
            "getMetaInfo",
          );
          meta =
            data.metaData && typeof data.metaData === "object"
              ? (data.metaData as Record<string, unknown>)
              : data;
        } catch {
          /* Older firmware can omit metadata. */
        }
        this.capability = {
          ...attempt,
          metadata: Object.keys(meta).length > 0,
        };
        return normalize(status, meta, sampledAt, revision);
      } catch {
        /* Probe next supported command and transport. */
      }
    }
    this.capability = null;
    throw new Error("No supported WiiM status endpoint responded");
  }
}
