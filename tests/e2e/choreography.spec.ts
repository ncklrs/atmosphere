import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "atmosphere.settings.v1",
      JSON.stringify({
        source: "demo",
        circadian: { timezone: "UTC" },
        override: { scene: "AMBIENT_DAY", expiresAt: 4102444800000 },
      }),
    ),
  );
});
for (const [width, height] of [
  [1920, 1080],
  [1920, 1200],
  [1080, 1920],
  [1024, 1024],
  [800, 480],
  [390, 844],
]) {
  test(`five lyric compositions remain readable at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/display");
    await page.getByRole("button", { name: "Pause demo" }).click();
    await mkdir("test-results/screenshots/choreography", { recursive: true });
    for (const [i, name] of [
      "cascade",
      "split",
      "monument",
      "margin",
      "horizon",
    ].entries()) {
      if (i > 0)
        await page
          .getByRole("button", { name: "Next lyric", exact: true })
          .click();
      await expect(page.locator(".scene-composition")).toHaveAttribute(
        "data-choreography",
        name,
      );
      const bounds = await page.locator(".kinetic-focus").evaluate((el) => {
        const text = el.getBoundingClientRect(),
          stage = el.closest(".scene-composition")!.getBoundingClientRect();
        return {
          left: text.left - stage.left,
          top: text.top - stage.top,
          right: stage.right - text.right,
          bottom: stage.bottom - text.bottom,
        };
      });
      for (const [edge, clearance] of Object.entries(bounds))
        expect(clearance, `${name} ${edge} clearance`).toBeGreaterThanOrEqual(
          -2,
        );
      expect(await page.locator(".lyric-context.previous").count()).toBe(0);
      await expect(page.locator(".artwork")).toHaveCount(0);
      await page.screenshot({
        path: `test-results/screenshots/choreography/${width}x${height}-${name}.png`,
      });
    }
  });
}
test("lyric transforms freeze on pause and are reproduced by a seek", async ({
  page,
}) => {
  await page.goto("/display");
  await page.getByRole("button", { name: "Pause demo" }).click();
  await page
    .getByRole("slider", { name: "Demo playback position" })
    .fill("6500");
  await expect(page.locator(".kinetic-focus")).toHaveCSS("opacity", "1");
  await page.waitForTimeout(100);
  const transform = await page
    .locator(".kinetic-focus")
    .evaluate((el) => getComputedStyle(el).transform);
  await page.waitForTimeout(350);
  expect(
    await page
      .locator(".kinetic-focus")
      .evaluate((el) => getComputedStyle(el).transform),
  ).toBe(transform);
  await page
    .getByRole("slider", { name: "Demo playback position" })
    .fill("28500");
  await expect(page.locator(".kinetic-stage")).toHaveAttribute(
    "data-treatment",
    "monument",
  );
  await page
    .getByRole("slider", { name: "Demo playback position" })
    .fill("6500");
  await expect
    .poll(() =>
      page
        .locator(".kinetic-focus")
        .evaluate((el) => getComputedStyle(el).transform),
    )
    .toBe(transform);
});
test("reduced motion uses a static reading composition without synthetic word highlights", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/display");
  await expect
    .poll(() =>
      page
        .locator(".kinetic-focus")
        .evaluate((el) => getComputedStyle(el).transform),
    )
    .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  await expect(page.locator(".kinetic-stage")).toHaveAttribute(
    "data-timing",
    "line",
  );
  await expect(page.locator(".word-active")).toHaveCount(0);
});

test("lyric compositions retain opposite gentle tilts and pause preserves the angle", async ({
  page,
}) => {
  await page.goto("/display");
  await page.getByRole("button", { name: "Pause demo" }).click();
  const seek = page.getByRole("slider", { name: "Demo playback position" });
  const angle = () =>
    page.locator(".kinetic-focus").evaluate((el) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
    });
  await seek.fill("3100");
  await expect.poll(angle).toBeLessThan(-0.5);
  const first = await angle();
  await seek.fill("14100");
  await expect.poll(angle).toBeGreaterThan(0.5);
  await seek.fill("3100");
  await expect.poll(angle).toBeCloseTo(first, 3);
  await page.waitForTimeout(200);
  expect(await angle()).toBeCloseTo(first, 3);
});
