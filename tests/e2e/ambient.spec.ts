import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { emptyPlayback } from "../../packages/playback-core/index";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("atmosphere.settings.v1"))
      localStorage.setItem(
        "atmosphere.settings.v1",
        JSON.stringify({
          source: "demo",
          circadian: { timezone: "UTC" },
          override: { scene: "AMBIENT_DAY", expiresAt: 4102444800000 },
        }),
      );
  });
});
for (const [width, height] of [
  [1440, 900],
  [390, 844],
]) {
  test(`ambient presets remain visible and art-free at ${width}x${height}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await page.goto("/lab");
    await page.getByLabel("Show synchronized lyrics").uncheck();
    await mkdir("test-results/screenshots/ambient", { recursive: true });
    for (const preset of ["Bloom", "Tide", "Orbit"]) {
      await page.getByRole("button", { name: preset, exact: true }).click();
      await expect(page.locator(".ambient-visuals")).toHaveAttribute(
        "data-visual",
        preset,
      );
      await expect(page.locator(".ambient-visuals")).toHaveAttribute(
        "data-focus",
        "ambient",
      );
      await expect(page.locator(".artwork")).toHaveCount(0);
      await expect(page.locator(".lyric-hero")).toHaveCount(0);
      await page.locator(".preview").screenshot({
        path: `test-results/screenshots/ambient/${width}-${preset}.png`,
      });
    }
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Orbit", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
  });
}
test("ambient motion continues through a lyric gap without restarting its clock", async ({
  page,
}) => {
  await page.goto("/display");
  await page.getByRole("button", { name: "Pause demo" }).click();
  const field = page.locator(".field-one");
  const start = await field.evaluate((el) => el.getAnimations()[0]?.startTime);
  const transform = await field.evaluate(
    (el) => getComputedStyle(el).transform,
  );
  await page.waitForTimeout(200);
  expect(await field.evaluate((el) => getComputedStyle(el).transform)).not.toBe(
    transform,
  );
  await page
    .getByRole("slider", { name: "Demo playback position" })
    .fill("13000");
  await expect(page.locator(".ambient-visuals")).toHaveAttribute(
    "data-focus",
    "ambient",
  );
  expect(await field.evaluate((el) => el.getAnimations()[0]?.startTime)).toBe(
    start,
  );
  await expect(page.locator(".artwork")).toHaveCount(0);
  await page
    .getByRole("slider", { name: "Demo playback position" })
    .fill("20000");
  await expect(page.locator(".ambient-visuals")).toHaveAttribute(
    "data-focus",
    "lyrics",
  );
  expect(await field.evaluate((el) => el.getAnimations()[0]?.startTime)).toBe(
    start,
  );
});
test("reduced motion disables ambient animation and sleep unmounts the visual engine", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/display");
  expect(
    await page
      .locator(".field-one")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  for (const selector of [".cloud-one", ".orbital-disk i", ".orb-surface"]) {
    expect(
      await page
        .locator(selector)
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
  }
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Music wakes the display").uncheck();
  await page.getByRole("button", { name: "Sleep", exact: false }).click();
  await page.getByRole("link", { name: "Display", exact: true }).click();
  await expect(page.locator(".ambient-visuals")).toHaveCount(0);
});
test("high contrast protects lyrics without dimming the ambient-only scene", async ({
  page,
}) => {
  await page.goto("/lab");
  await page.getByLabel("High contrast").check();
  await expect(page.locator(".ambient-visuals")).toHaveCSS("opacity", "0.28");
  await page.getByLabel("Show synchronized lyrics").uncheck();
  await expect(page.locator(".ambient-visuals")).toHaveAttribute(
    "data-focus",
    "ambient",
  );
  await expect(page.locator(".ambient-visuals")).toHaveCSS("opacity", "1");
  await expect(page.locator(".artwork")).toHaveCount(0);
});
test("idle device uses the generative clock scene without an album card", async ({
  page,
}) => {
  await page.routeWebSocket("ws://127.0.0.1:8787/events", (socket) =>
    socket.send(
      JSON.stringify({
        type: "snapshot",
        playback: { ...emptyPlayback(), state: "stopped", revision: 1 },
        lyrics: null,
        connected: true,
        sentAt: Date.now(),
      }),
    ),
  );
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Local gateway", exact: true })
    .click();
  await page.getByRole("link", { name: "Display", exact: true }).click();
  await expect(page.locator(".ambient-idle .ambient-time")).toBeVisible();
  await expect(page.locator(".ambient-visuals")).toHaveAttribute(
    "data-focus",
    "ambient",
  );
  await expect(page.locator(".artwork")).toHaveCount(0);
});
