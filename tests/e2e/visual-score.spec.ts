import { openLabPanels } from "./lab-panels";
import { test, expect, type Locator } from "@playwright/test";
import { demoPlayback } from "../../packages/fixtures/index";
async function pixels(canvas: Locator) {
  return canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement,
      gl = c.getContext("webgl")!;
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const data = new Uint8Array(c.width * c.height * 4);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    let hash = 2166136261;
    for (let i = 0; i < data.length; i += 4) {
      hash = Math.imul(hash ^ data[i], 16777619);
      hash = Math.imul(hash ^ data[i + 1], 16777619);
      hash = Math.imul(hash ^ data[i + 2], 16777619);
    }
    return hash >>> 0;
  });
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("atmosphere.settings.v1"))
      localStorage.setItem(
        "atmosphere.settings.v1",
        JSON.stringify({
          source: "demo",
          lyrics: false,
          visualDynamics: 100,
          override: { scene: "AMBIENT_DAY", expiresAt: 4102444800000 },
        }),
      );
    // Hold independent ambient clocks fixed, so pixel differences prove song direction.
    const locations = new Map<WebGLUniformLocation, string>();
    const get = WebGLRenderingContext.prototype.getUniformLocation,
      set = WebGLRenderingContext.prototype.uniform1f;
    WebGLRenderingContext.prototype.getUniformLocation = function (
      program,
      name,
    ) {
      const location = get.call(this, program, name);
      if (location) locations.set(location, name);
      return location;
    };
    WebGLRenderingContext.prototype.uniform1f = function (location, value) {
      const name = location ? locations.get(location) : undefined;
      return set.call(
        this,
        location,
        name === "time" || name === "prismTime"
          ? 12
          : name === "seed" || name === "reveal"
            ? 1
            : value,
      );
    };
  });
});
test("lyrics visibly direct the background, remain deterministic on pause/seeks, and open art-free breaks", async ({
  page,
}) => {
  await page.goto("/lab");
  await openLabPanels(page);
  await page.getByRole("button", { name: "Pause demo", exact: true }).click();
  const canvas = page.locator("canvas.generative-canvas"),
    position = page.getByLabel("Demo playback position");
  await expect(page.locator(".ambient-visuals")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  await position.fill("3400");
  await expect(canvas).toHaveAttribute("data-score-phase", "phrase");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-phrase")))
    .toBeGreaterThan(0.1);
  const entrance = await pixels(canvas);
  await page.waitForTimeout(200);
  expect(await pixels(canvas)).toBe(entrance);
  await position.fill("7000");
  await expect.poll(() => pixels(canvas)).not.toBe(entrance);
  await position.fill("3400");
  await expect.poll(() => pixels(canvas)).toBe(entrance);
  await position.fill("13000");
  await expect(canvas).toHaveAttribute("data-score-phase", "break");
  await expect(page.locator(".artwork")).toHaveCount(0);
  await expect(page.locator(".lyric-hero")).toHaveCount(0);
  await page.getByLabel("Song dynamics", { exact: true }).fill("0");
  await expect(canvas).toHaveAttribute("data-phrase", "0.000");
  await expect(canvas).toHaveAttribute("data-dynamics", "0");
  const quiet = await pixels(canvas);
  await position.fill("3400");
  expect(await pixels(canvas)).toBe(quiet);
  await page.reload();
  await openLabPanels(page);
  await expect(page.getByLabel("Song dynamics", { exact: true })).toHaveValue(
    "0",
  );
});
test("only song identity changes trigger the color sweep, including rapid skips", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "atmosphere.settings.v1",
      JSON.stringify({
        source: "gateway",
        lyrics: true,
        visualDynamics: 100,
        override: { scene: "AMBIENT_DAY", expiresAt: 4102444800000 },
      }),
    ),
  );
  let current = {
    ...demoPlayback(0, 0),
    sourceId: "wiim",
    trackKey: "one",
    artworkUrl: null,
    state: "paused" as const,
  };
  await page.route("**/api/gateway/state", (route) =>
    route.fulfill({
      json: {
        type: "snapshot",
        sessionId: "score",
        playback: current,
        lyrics: null,
        connected: true,
        sentAt: Date.now(),
      },
    }),
  );
  await page.goto("/display");
  const canvas = page.locator("canvas.generative-canvas");
  await expect(canvas).toHaveAttribute("data-song-identity", "one");
  await expect(canvas).toHaveAttribute("data-song-transition", "settled");
  current = {
    ...current,
    album: "Enriched album",
    durationMs: 120000,
    revision: 2,
  };
  await page.waitForTimeout(1200);
  await expect(canvas).toHaveAttribute("data-song-transition", "settled");
  current = { ...current, trackKey: "two", title: "Second song", revision: 3 };
  await expect(canvas).toHaveAttribute("data-song-identity", "two");
  await expect(canvas).toHaveAttribute("data-song-transition", "changing");
  const sweep = await pixels(canvas);
  current = { ...current, trackKey: "three", title: "Third song", revision: 4 };
  await expect(canvas).toHaveAttribute("data-song-identity", "three");
  await expect(canvas).toHaveAttribute("data-song-transition", "changing");
  await expect.poll(() => pixels(canvas)).not.toBe(sweep);
  await expect(canvas).toHaveAttribute("data-song-transition", "settled", {
    timeout: 7000,
  });
  await expect(page.locator(".lyric-hero")).toHaveCount(0);
});
test("reduced motion removes lyric and song movement while retaining album color", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/lab");
  await openLabPanels(page);
  await page.getByRole("button", { name: "Pause demo", exact: true }).click();
  const canvas = page.locator("canvas.generative-canvas");
  await page.getByLabel("Demo playback position").fill("3400");
  await expect(canvas).toHaveAttribute("data-phrase", "0.000");
  const before = await pixels(canvas);
  await page.getByLabel("Demo playback position").fill("17000");
  await page.waitForTimeout(200);
  expect(await pixels(canvas)).toBe(before);
  await expect(canvas).toHaveAttribute("data-song-transition", "settled");
});
