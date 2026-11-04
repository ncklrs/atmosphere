import { test, expect, type Locator } from "@playwright/test";
async function pixels(canvas: Locator) {
  return canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement,
      gl = c.getContext("webgl")!;
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const data = new Uint8Array(c.width * c.height * 4);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    let hash = 0;
    for (let i = 0; i < data.length; i += 4)
      hash = (hash * 31 + data[i] + data[i + 1] + data[i + 2]) | 0;
    return hash;
  });
}
test("Prism controls persist, alter the field, and stop motion independently of lyrics", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("atmosphere.settings.v1"))
      localStorage.setItem(
        "atmosphere.settings.v1",
        JSON.stringify({
          source: "demo",
          ambientVisual: "Prism",
          override: { scene: "AMBIENT_DAY", expiresAt: 4102444800000 },
        }),
      );
  });
  await page.goto("/lab");
  await page.getByRole("button", { name: "Pause demo" }).click();
  const canvas = page.locator("canvas.generative-canvas");
  await expect(page.locator(".ambient-visuals")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  await expect(canvas).toHaveAttribute("data-active-visual", "Prism");
  await expect(canvas).toHaveAttribute("data-transition", "settled");
  await page.getByLabel("Prism motion speed").fill("0");
  await expect(page.locator(".ambient-visuals")).toHaveAttribute(
    "data-still",
    "true",
  );
  await expect.poll(() => pixels(canvas)).not.toBe(0);
  await page.waitForTimeout(200);
  const before = await pixels(canvas);
  await page.waitForTimeout(300);
  expect(await pixels(canvas)).toBe(before);
  await page.getByLabel("Prism facet size").fill("25");
  await expect.poll(() => pixels(canvas)).not.toBe(before);
  await page.getByLabel("Prism light intensity").fill("30");
  await page.reload();
  await expect(page.getByLabel("Prism motion speed")).toHaveValue("0");
  await expect(page.getByLabel("Prism light intensity")).toHaveValue("30");
  await expect(page.getByLabel("Prism facet size")).toHaveValue("25");
  await expect(page.getByLabel("Show synchronized lyrics")).toBeChecked();
});
