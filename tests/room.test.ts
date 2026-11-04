import { describe, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startGateway } from "../apps/gateway/src/server";
import { validateSettings } from "../packages/room/settings";
describe("shared room controls", () => {
  it("requires pairing, validates settings, rate limits codes, revokes controllers and persists preferences", async () => {
    const dir = await mkdtemp(join(tmpdir(), "atmosphere-room-")),
      file = join(dir, "room.json");
    let gateway = await startGateway({ port: 0, roomFile: file });
    const call = async (
      action: string,
      body?: unknown,
      owner = false,
      token = "",
    ) =>
      fetch(`http://127.0.0.1:${gateway.port}/room/${action}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(owner ? { "x-atmosphere-room-owner": "1" } : {}),
          "x-atmosphere-room-token": token,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    try {
      expect((await call("state")).status).toBe(401);
      const enabled = await (
        await call(
          "enable",
          { settings: { ambientVisual: "Ink", source: "gateway" } },
          true,
        )
      ).json();
      expect(enabled.code).toMatch(/^\d{6}$/);
      expect(
        (await call("settings", { patch: { brightness: 30 } })).status,
      ).toBe(401);
      expect((await call("pair", { code: "bad" })).status).toBe(403);
      const { token } = await (
        await call("pair", { code: enabled.code })
      ).json();
      const paired = await (
        await call("state", undefined, false, token)
      ).json();
      expect(paired).not.toHaveProperty("code");
      expect(paired.owner).toBe(false);
      const updated = await (
        await call(
          "settings",
          {
            patch: {
              brightness: 900,
              visualDynamics: -4,
              trackOffsets: { one: 9000 },
              favorites: ["Ink", "invalid"],
            },
          },
          false,
          token,
        )
      ).json();
      expect(updated.settings).toMatchObject({
        brightness: 100,
        visualDynamics: 0,
        trackOffsets: { one: 5000 },
        favorites: ["Ink"],
      });
      expect((await call("disable", {}, false, token)).status).toBe(403);
      for (let i = 0; i < 8; i++) await call("pair", { code: "wrong" });
      expect((await call("pair", { code: enabled.code })).status).toBe(429);
      await gateway.close();
      gateway = await startGateway({ port: 0, roomFile: file });
      const restored = await (await call("state", undefined, true)).json();
      expect(restored.settings.ambientVisual).toBe("Ink");
      expect(restored.settings.brightness).toBe(100);
      expect((await call("state", undefined, false, token)).status).toBe(401);
      await call("disable", {}, true);
      expect(
        (await (await call("state", undefined, true)).json()).enabled,
      ).toBe(false);
    } finally {
      await gateway.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("bounds experience preferences and accepts every new scene", () => {
    for (const ambientVisual of ["Ink", "Architecture", "Landscape"])
      expect(validateSettings({ ambientVisual }).ambientVisual).toBe(
        ambientVisual,
      );
    const settings = validateSettings({
      brightness: NaN,
      trackInfo: "other",
      favorites: ["Ink", "Ink", "no"],
      trackOffsets: { song: Infinity, other: -8000 },
      hiddenLyrics: [false, "song"],
    });
    expect(settings).toMatchObject({
      brightness: 100,
      cleanDisplay: true,
      trackInfo: "brief",
      favorites: ["Ink"],
      trackOffsets: { other: -5000 },
      hiddenLyrics: ["song"],
    });
  });
});
