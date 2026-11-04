import { openLabPanels } from "./lab-panels";
import { test, expect, type Locator } from "@playwright/test";
async function fingerprint(canvas: Locator) {
  return canvas.evaluate((el) => {
    const element = el as HTMLCanvasElement;
    const gl = element.getContext("webgl")!;
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const pixels = new Uint8Array(element.width * element.height * 4);
    gl.readPixels(
      0,
      0,
      element.width,
      element.height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    let hash = 2166136261;
    for (let i = 0; i < pixels.length; i += 4) {
      hash = Math.imul(hash ^ pixels[i], 16777619);
      hash = Math.imul(hash ^ pixels[i + 1], 16777619);
      hash = Math.imul(hash ^ pixels[i + 2], 16777619);
    }
    return hash >>> 0;
  });
}
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
test("nine GPU presets render distinct fixed-time scenes within the pixel budget", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/lab");
  await openLabPanels(page);
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
  const captures: number[] = [];
  for (const preset of [
    "Orbit",
    "Bloom",
    "Tide",
    "Nova",
    "Prism",
    "Voyage",
    "Ink",
    "Architecture",
    "Landscape",
  ]) {
    await page.getByRole("button", { name: preset, exact: true }).click();
    await expect(page.locator("canvas.generative-canvas")).toHaveAttribute(
      "data-active-visual",
      preset,
    );
    await expect(page.locator("canvas.generative-canvas")).toHaveAttribute(
      "data-transition",
      "settled",
    );
    captures.push(await fingerprint(page.locator("canvas.generative-canvas")));
    await page
      .locator(".preview")
      .screenshot({ path: `test-results/screenshots/gpu-${preset}.png` });
  }
  for (let i = 1; i < captures.length; i++)
    expect(captures[i - 1] === captures[i]).toBe(false);
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
  await openLabPanels(page);
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
  await openLabPanels(page);
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

test("the GPU field evolves over time without changing preset or restarting", async ({
  page,
}) => {
  await page.goto("/lab");
  await openLabPanels(page);
  const canvas = page.locator("canvas.generative-canvas");
  await expect(page.locator(".ambient-visuals")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  await expect(canvas).toHaveCSS("opacity", "1");
  const before = await fingerprint(canvas);
  await page.waitForTimeout(400);
  const after = await fingerprint(canvas);
  expect(before).not.toBe(after);
  await expect(canvas).toHaveAttribute("data-active-visual", "Orbit");
});
