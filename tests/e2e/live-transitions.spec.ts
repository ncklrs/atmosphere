import { test, expect } from "@playwright/test";
import { demoPlayback } from "../../packages/fixtures/index";
import type { Snapshot } from "../../packages/playback-core/index";
const wire = (key: string, revision: number, sessionId = "one"): Snapshot => ({
  type: "snapshot",
  sessionId,
  playback: {
    ...demoPlayback(0, 0, revision),
    sourceId: "wiim",
    trackKey: key,
    title: `${key} track`,
    artist: "Fixture artist",
    artworkUrl: `https://i.scdn.co/image/${key}`,
    positionMs: 4000,
  },
  lyrics: null,
  connected: true,
  sentAt: Date.now(),
});
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "atmosphere.settings.v1",
      JSON.stringify({
        source: "gateway",
        override: { scene: "AMBIENT_DAY", expiresAt: 4102444800000 },
      }),
    ),
  );
  await page.route("**/api/gateway/capabilities", (route) =>
    route.fulfill({ json: { source: "wiim" } }),
  );
});
test("live startup, rapid switches and gateway restart never substitute demo lyrics", async ({
  page,
}) => {
  let current = wire("First", 500);
  let release: (() => void) | undefined;
  const initial = new Promise<void>((resolve) => {
    release = resolve;
  });
  let first = true;
  await page.route("**/api/gateway/state", async (route) => {
    if (first) {
      first = false;
      await initial;
    }
    await route.fulfill({ json: current });
  });
  await page.route("https://i.scdn.co/**", (route) => route.abort());
  await page.goto("/display");
  await expect(page.locator(".now-playing h2")).not.toContainText(
    "The space between",
  );
  await expect(page.locator(".lyric-hero")).toHaveCount(0);
  release!();
  await expect(page.locator(".now-playing h2")).toHaveText("First track");
  current = {
    ...wire("Second", 501),
    lyrics: {
      trackKey: "Second",
      cues: [{ startMs: 0, text: "Second fixture line" }],
      provider: "Fixture",
      attribution: "Original fixture",
      timing: "line",
    },
  };
  await expect(page.locator(".lyric-hero")).toContainText(
    "Second fixture line",
  );
  current = wire("Third", 502);
  await expect(page.locator(".now-playing h2")).toHaveText("Third track");
  await expect(page.locator(".lyric-hero")).toHaveCount(0);
  current = wire("Restarted", 1, "two");
  await expect(page.locator(".now-playing h2")).toHaveText("Restarted track");
  await expect(page.locator(".now-playing h2")).not.toContainText(
    "The space between",
  );
});
test("artwork colors update on a switch and late images cannot recolor the new track", async ({
  page,
}) => {
  let current = wire("red", 1);
  await page.route("**/api/gateway/state", (route) =>
    route.fulfill({ json: current }),
  );
  let releaseRed: (() => void) | undefined;
  const redWait = new Promise<void>((resolve) => {
    releaseRed = resolve;
  });
  await page.route("https://i.scdn.co/image/*", async (route) => {
    const red = route.request().url().endsWith("red");
    if (red) await redWait;
    await route.fulfill({
      contentType: "image/svg+xml",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="${red ? "#dc1e28" : "#143ce6"}"/></svg>`,
    });
  });
  await page.goto("/display");
  await expect(page.locator(".now-playing h2")).toHaveText("red track");
  current = wire("blue", 2);
  await expect(page.locator(".display-scene")).toHaveAttribute(
    "data-palette",
    "artwork",
  );
  await expect
    .poll(() =>
      page
        .locator(".display-scene")
        .evaluate((el) =>
          (el as HTMLElement).style.getPropertyValue("--album-1"),
        ),
    )
    .toBe("#143ce6");
  releaseRed!();
  await page.waitForTimeout(200);
  expect(
    await page
      .locator(".display-scene")
      .evaluate((el) =>
        (el as HTMLElement).style.getPropertyValue("--album-1"),
      ),
  ).toBe("#143ce6");
  await expect(page.locator(".artwork")).toHaveCount(0);
});
test("failed artwork loads retain a usable ambient palette", async ({
  page,
}) => {
  await page.route("**/api/gateway/state", (route) =>
    route.fulfill({ json: wire("missing", 1) }),
  );
  await page.route("https://i.scdn.co/**", (route) => route.abort());
  await page.goto("/display");
  await expect(page.locator(".now-playing h2")).toHaveText("missing track");
  await expect(page.locator(".display-scene")).toHaveAttribute(
    "data-palette",
    "fallback",
  );
  await expect(page.locator(".ambient-visuals")).toBeVisible();
});
