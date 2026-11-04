import { test, expect } from "@playwright/test";
import { demoPlayback } from "../../packages/fixtures/index";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "atmosphere.settings.v1",
      JSON.stringify({
        source: "demo",
        override: { scene: "AMBIENT_DAY", expiresAt: 4102444800000 },
      }),
    ),
  );
});
test("content-based word entrances vary, freeze on pause and reproduce after a seek", async ({
  page,
}) => {
  await page.goto("/display");
  await page.getByRole("button", { name: "Pause demo" }).click();
  const seek = page.getByRole("slider", { name: "Demo playback position" });
  for (const [i, treatment] of [
    "unfold",
    "reveal",
    "slide",
    "slide",
    "unfold",
  ].entries()) {
    await seek.fill(String(3200 + i * 11000));
    await expect(page.locator(".kinetic-stage")).toHaveAttribute(
      "data-word-treatment",
      treatment,
    );
    const words = page.locator(".kinetic-word");
    await expect(words.first()).not.toHaveCSS("opacity", "0");
    const states = await words.evaluateAll((nodes) =>
      nodes.map((el) => ({
        transform: (el as HTMLElement).style.transform,
        opacity: (el as HTMLElement).style.opacity,
        clip: (el as HTMLElement).style.clipPath,
      })),
    );
    expect(states[0]).not.toEqual(states.at(-1));
    await page.waitForTimeout(150);
    expect(
      await words.evaluateAll((nodes) =>
        nodes.map((el) => ({
          transform: (el as HTMLElement).style.transform,
          opacity: (el as HTMLElement).style.opacity,
          clip: (el as HTMLElement).style.clipPath,
        })),
      ),
    ).toEqual(states);
    await page.screenshot({
      path: `test-results/screenshots/words-${treatment}.png`,
    });
    await seek.fill("6500");
    await seek.fill(String(3200 + i * 11000));
    expect(
      await words.evaluateAll((nodes) =>
        nodes.map((el) => ({
          transform: (el as HTMLElement).style.transform,
          opacity: (el as HTMLElement).style.opacity,
          clip: (el as HTMLElement).style.clipPath,
        })),
      ),
    ).toEqual(states);
  }
});
test("reduced motion shows every word without entrance transforms", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/display");
  await expect(page.locator(".kinetic-word").first()).toHaveCSS(
    "transform",
    "none",
  );
  const words = await page.locator(".kinetic-word").evaluateAll((nodes) =>
    nodes.map((el) => ({
      transform: getComputedStyle(el).transform,
      opacity: getComputedStyle(el).opacity,
      clip: getComputedStyle(el).clipPath,
    })),
  );
  expect(words.length).toBeGreaterThan(3);
  for (const word of words)
    expect(word).toEqual({ transform: "none", opacity: "1", clip: "none" });
});
test("real word timestamps control entrances when they are supplied", async ({
  page,
}) => {
  let position = 2500;
  await page.route("**/api/gateway/state", (route) =>
    route.fulfill({
      json: {
        type: "snapshot",
        sessionId: "word-test",
        playback: {
          ...demoPlayback(0, 0, position),
          trackKey: "word-fixture",
          sourceId: "wiim",
          positionMs: position,
          state: "paused",
        },
        lyrics: {
          trackKey: "word-fixture",
          cues: [
            {
              startMs: 0,
              endMs: 9000,
              text: "First Second",
              words: [
                { startMs: 0, text: "First" },
                { startMs: 4000, text: "Second" },
              ],
            },
          ],
          provider: "Fixture",
          attribution: "Original fixture",
          timing: "word",
        },
        connected: true,
        sentAt: Date.now(),
      },
    }),
  );
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Local gateway", exact: true })
    .click();
  await page.getByRole("link", { name: "Display", exact: true }).click();
  await expect(page.locator(".kinetic-word").first()).toHaveCSS("opacity", "1");
  await expect(page.locator(".kinetic-word").nth(1)).toHaveCSS("opacity", "0");
  position = 4500;
  await expect(page.locator(".kinetic-word").nth(1)).toHaveCSS("opacity", "1");
});
