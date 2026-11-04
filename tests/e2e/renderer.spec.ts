import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "atmosphere.settings.v1",
      JSON.stringify({
        source: "demo",
        lyrics: false,
        override: { scene: "AMBIENT_DAY", expiresAt: 4102444800000 },
      }),
    ),
  );
});
test("GPU presets render distinct evolving scenes with a bounded pixel budget", async ({
  page,
}) => {
  await page.goto("/lab");
  const layer = page.locator(".ambient-visuals");
  await expect(layer).toHaveAttribute("data-renderer", "webgl");
  await expect(page.locator("canvas.generative-canvas")).toHaveCSS(
    "opacity",
    "1",
  );
  const dimensions = await page
    .locator("canvas.generative-canvas")
    .evaluate((el) => ({
      width: (el as HTMLCanvasElement).width,
      height: (el as HTMLCanvasElement).height,
    }));
  expect(dimensions.width * dimensions.height).toBeLessThan(523000);
  const captures: Buffer[] = [];
  for (const preset of ["Orbit", "Bloom", "Tide"]) {
    await page.getByRole("button", { name: preset, exact: true }).click();
    await page.waitForTimeout(150);
    captures.push(await page.locator("canvas.generative-canvas").screenshot());
    await page
      .locator(".preview")
      .screenshot({ path: `test-results/screenshots/gpu-${preset}.png` });
  }
  expect(captures[0].equals(captures[1])).toBe(false);
  expect(captures[1].equals(captures[2])).toBe(false);
});
test("unavailable WebGL retains the CSS scene", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type === "webgl") return null;
      return original.call(this, type as "2d", ...args);
    } as typeof original;
  });
  await page.goto("/lab");
  await expect(page.locator(".ambient-visuals")).toHaveAttribute(
    "data-renderer",
    "css",
  );
  await expect(page.locator(".ambient-orb")).toBeVisible();
});
test("GPU context loss reveals fallback and restoration resumes rendering", async ({
  page,
}) => {
  await page.goto("/lab");
  await expect(page.locator(".ambient-visuals")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  await page.locator("canvas.generative-canvas").evaluate((el) => {
    const extension = (el as HTMLCanvasElement)
      .getContext("webgl")!
      .getExtension("WEBGL_lose_context")!;
    extension.loseContext();
    setTimeout(() => extension.restoreContext(), 700);
  });
  await expect(page.locator(".ambient-visuals")).toHaveAttribute(
    "data-renderer",
    "css",
  );
  await expect(page.locator(".ambient-visuals")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
});
