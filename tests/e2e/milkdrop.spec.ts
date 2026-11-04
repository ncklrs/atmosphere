import { test, expect, type Locator } from "@playwright/test";
import {
  milkdropCollections,
  milkdropIds,
  milkdropPresets,
  presetsInCollection,
} from "../../packages/design-system/milkdrop";
async function sample(canvas: Locator) {
  return canvas.evaluate(
    (el) =>
      new Promise<{ hash: number; lit: number; width: number; height: number }>(
        (resolve, reject) => {
          const element = el as HTMLCanvasElement;
          const timer = setTimeout(() => {
            observer.disconnect();
            reject(new Error("Milkdrop stopped drawing"));
          }, 5000);
          const observer = new MutationObserver(() => {
            const gl = element.getContext("webgl2")!;
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
            let hash = 2166136261,
              lit = 0;
            for (let i = 0; i < pixels.length; i += 4) {
              hash = Math.imul(hash ^ pixels[i], 16777619);
              hash = Math.imul(hash ^ pixels[i + 1], 16777619);
              hash = Math.imul(hash ^ pixels[i + 2], 16777619);
              if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 12) lit++;
            }
            observer.disconnect();
            clearTimeout(timer);
            resolve({
              hash: hash >>> 0,
              lit,
              width: element.width,
              height: element.height,
            });
          });
          observer.observe(element, {
            attributes: true,
            attributeFilter: ["data-frame"],
          });
        },
      ),
  );
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("atmosphere.settings.v1"))
      localStorage.setItem(
        "atmosphere.settings.v1",
        JSON.stringify({
          source: "demo",
          lyrics: false,
          override: { scene: "AMBIENT_DAY", expiresAt: 4102444800000 },
        }),
      );
  });
});
test("all curated scenes draw real WebGL2 output and the original engine remains available", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/lab");
  await page.getByRole("button", { name: "Milkdrop", exact: true }).click();
  const layer = page.locator(".ambient-visuals"),
    canvas = page.locator("canvas.milkdrop-canvas");
  await expect(layer).toHaveAttribute("data-renderer", "butterchurn", {
    timeout: 15000,
  });
  await page.getByRole("slider", { name: "Milkdrop preset blend" }).fill("0");
  const hashes = new Set<number>();
  for (const collection of milkdropCollections) {
    await page.getByRole("button", { name: collection, exact: true }).click();
    for (const id of presetsInCollection(collection)) {
      await page
        .getByRole("button", { name: milkdropPresets[id].title, exact: true })
        .click();
      await expect(canvas).toHaveAttribute("data-active-preset", id);
      await page.waitForTimeout(900);
      const result = await sample(canvas);
      expect(result.width * result.height).toBeLessThan(362000);
      expect(result.lit, `${id} should have visible pixels`).toBeGreaterThan(
        100,
      );
      hashes.add(result.hash);
      await page
        .locator(".preview")
        .screenshot({ path: `test-results/screenshots/milkdrop-${id}.png` });
    }
  }
  expect(hashes.size).toBe(milkdropIds.length);
  await expect(page.locator(".artwork")).toHaveCount(0);
  await page.getByRole("button", { name: "Ambient", exact: true }).click();
  await expect(canvas).toHaveCount(0);
  await page.getByRole("button", { name: "Nova", exact: true }).click();
  await expect(layer).toHaveAttribute("data-visual", "Nova");
  await expect(layer).toHaveAttribute("data-renderer", "webgl");
  expect(errors).toEqual([]);
});
test("controls persist, stop the canvas, and resume without restarting it", async ({
  page,
}) => {
  await page.goto("/lab");
  await page.getByRole("button", { name: "Milkdrop", exact: true }).click();
  const canvas = page.locator("canvas.milkdrop-canvas");
  await expect(page.locator(".ambient-visuals")).toHaveAttribute(
    "data-renderer",
    "butterchurn",
  );
  await page.getByRole("slider", { name: "Milkdrop brightness" }).fill("35");
  await page
    .getByRole("slider", { name: "Milkdrop pattern energy" })
    .fill("20");
  await page.getByRole("slider", { name: "Milkdrop preset blend" }).fill("7");
  await page
    .getByRole("slider", { name: "Milkdrop animation speed" })
    .fill("0");
  await page.waitForTimeout(300);
  const frame = await canvas.getAttribute("data-frame");
  await page.waitForTimeout(400);
  expect(await canvas.getAttribute("data-frame")).toBe(frame);
  await expect(canvas).toHaveCSS("filter", "brightness(0.35)");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Milkdrop", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  for (const [name, value] of [
    ["brightness", "35"],
    ["animation speed", "0"],
    ["pattern energy", "20"],
    ["preset blend", "7"],
  ])
    await expect(
      page.getByRole("slider", { name: `Milkdrop ${name}` }),
    ).toHaveValue(value);
  await expect(page.locator(".ambient-visuals")).toHaveAttribute(
    "data-renderer",
    "butterchurn",
  );
  const first = Number(await canvas.getAttribute("data-frame"));
  await page
    .getByRole("slider", { name: "Milkdrop animation speed" })
    .fill("60");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-frame")))
    .toBeGreaterThan(first + 2);
  await page
    .getByRole("button", { name: "Reset controls", exact: true })
    .click();
  await expect(
    page.getByRole("slider", { name: "Milkdrop brightness" }),
  ).toHaveValue("65");
});
test("missing WebGL2 and reduced motion use the existing ambient engine", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type === "webgl2") return null;
      return original.call(this, type as "2d", ...args);
    } as typeof original;
  });
  await page.goto("/lab");
  await page.getByRole("button", { name: "Milkdrop", exact: true }).click();
  const layer = page.locator(".ambient-visuals");
  await expect(layer).toHaveAttribute("data-engine-state", "fallback");
  await expect(layer).toHaveAttribute("data-renderer", "webgl");
  await expect(
    page.getByText("Ambient fallback · Milkdrop unavailable on this display", {
      exact: true,
    }),
  ).toBeVisible();
});
test("reduced motion is static and sleep unmounts Milkdrop", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/lab");
  await page.getByRole("button", { name: "Milkdrop", exact: true }).click();
  await expect(page.locator(".ambient-visuals")).toHaveAttribute(
    "data-engine-state",
    "reduced",
  );
  await expect(page.locator(".ambient-visuals")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  expect(
    await page.locator("canvas.milkdrop-canvas").getAttribute("data-frame"),
  ).toBeNull();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Music wakes the display").uncheck();
  await page.getByRole("button", { name: "Sleep", exact: false }).click();
  await page.getByRole("link", { name: "Display", exact: true }).click();
  await expect(page.locator("canvas.milkdrop-canvas")).toHaveCount(0);
});

test("per-song rotation stays in its collection, survives reload, and yields to a manual preset", async ({
  page,
}) => {
  await page.goto("/lab");
  await page.getByRole("button", { name: "Milkdrop", exact: true }).click();
  const layer = page.locator(".ambient-visuals");
  const toggle = page.getByLabel("Auto-rotate visuals per song");
  await expect(layer).toHaveAttribute("data-preset", "jelly-space");
  await toggle.check();
  await page.getByRole("button", { name: "Pause demo", exact: true }).click();
  await page
    .getByRole("slider", { name: "Demo playback position", exact: true })
    .fill("13000");
  await expect(layer).toHaveAttribute("data-preset", "jelly-space");
  await page
    .getByRole("button", { name: "Next demo track", exact: true })
    .click();
  await expect(layer).toHaveAttribute("data-preset", "cosmic-dust");
  await page.reload();
  // Navigation reloads the demo at its first track; a new track should advance once.
  await expect(toggle).toBeChecked();
  await expect(layer).toHaveAttribute("data-preset", "smoke-rings");
  await toggle.uncheck();
  await expect(layer).toHaveAttribute("data-preset", "smoke-rings");
  await page.getByRole("button", { name: "Balanced", exact: true }).click();
  await expect(layer).toHaveAttribute("data-preset", "gold-diffusion");
  await toggle.check();
  await page
    .getByRole("button", { name: "Next demo track", exact: true })
    .click();
  await expect(layer).toHaveAttribute("data-preset", "tendrils");
  await page
    .getByRole("button", { name: "Reaction diffusion", exact: true })
    .click();
  await expect(toggle).not.toBeChecked();
  await page
    .getByRole("button", { name: "Next demo track", exact: true })
    .click();
  await expect(layer).toHaveAttribute("data-preset", "reaction-diffusion");
});

test("rapid preset changes settle on the latest selection and context loss recovers", async ({
  page,
}) => {
  await page.goto("/lab");
  await page.getByRole("button", { name: "Milkdrop", exact: true }).click();
  const layer = page.locator(".ambient-visuals"),
    canvas = page.locator("canvas.milkdrop-canvas");
  await expect(layer).toHaveAttribute("data-renderer", "butterchurn");
  for (const name of [
    "Smoke rings",
    "Jelly space",
    "Magellan nebula",
    "Cosmic dust",
    "Jelly space",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  await expect(canvas).toHaveAttribute("data-active-preset", "jelly-space");
  await page.waitForTimeout(500);
  await expect(canvas).toHaveAttribute("data-active-preset", "jelly-space");
  await canvas.evaluate((el) => {
    const extension = (el as HTMLCanvasElement)
      .getContext("webgl2")!
      .getExtension("WEBGL_lose_context")!;
    extension.loseContext();
    setTimeout(() => extension.restoreContext(), 800);
  });
  await expect(layer).toHaveAttribute("data-engine-state", "fallback");
  await expect(layer).toHaveAttribute("data-renderer", "butterchurn", {
    timeout: 15000,
  });
  await expect(canvas).toHaveAttribute("data-active-preset", "jelly-space");
  expect((await sample(canvas)).lit).toBeGreaterThan(100);
});

test("Milkdrop remains ambient during lyric breaks and dims behind high-contrast lyrics", async ({
  page,
}) => {
  await page.goto("/lab");
  await page.getByRole("button", { name: "Milkdrop", exact: true }).click();
  await page.getByLabel("Show synchronized lyrics").check();
  await page.getByRole("button", { name: "Pause demo", exact: true }).click();
  await page
    .getByRole("slider", { name: "Demo playback position", exact: true })
    .fill("20000");
  const layer = page.locator(".ambient-visuals");
  await page.getByLabel("High contrast").check();
  await expect(layer).toHaveAttribute("data-renderer", "butterchurn");
  await expect(layer).toHaveCSS("opacity", "0.28");
  await page
    .getByRole("slider", { name: "Demo playback position", exact: true })
    .fill("13000");
  await expect(layer).toHaveAttribute("data-focus", "ambient");
  await expect(layer).toHaveCSS("opacity", "1");
  await expect(page.locator(".artwork")).toHaveCount(0);
  await expect(page.locator(".lyric-hero")).toHaveCount(0);
});

test("Milkdrop controls work in a phone-sized viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/lab");
  await page.getByRole("button", { name: "Milkdrop", exact: true }).click();
  await expect(page.locator(".ambient-visuals")).toHaveAttribute(
    "data-renderer",
    "butterchurn",
  );
  await page.getByRole("button", { name: "Intense", exact: true }).click();
  await page.getByRole("button", { name: "Kaleidoscope", exact: true }).click();
  await page.getByRole("slider", { name: "Milkdrop brightness" }).fill("45");
  await expect(page.locator("canvas.milkdrop-canvas")).toHaveCSS(
    "filter",
    "brightness(0.45)",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/screenshots/milkdrop-phone-controls.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Calm", exact: true }).click();
  await page
    .locator(".preview")
    .screenshot({
      path: "test-results/screenshots/milkdrop-phone-preview.png",
    });
});
