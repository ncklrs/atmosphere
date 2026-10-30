import { test, expect, type WebSocketRoute } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const settings = {
  circadian: { timezone: "UTC" },
  override: { scene: "AMBIENT_DAY", expiresAt: 4102444800000 },
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript((value) => {
    if (!localStorage.getItem("atmosphere.settings.v1"))
      localStorage.setItem("atmosphere.settings.v1", JSON.stringify(value));
  }, settings);
});
for (const [width, height, layout] of [
  [1920, 1080, "Cinema"],
  [1920, 1200, "Cinema"],
  [1080, 1920, "Portrait"],
  [1024, 1024, "Canvas"],
  [800, 480, "Companion"],
] as const) {
  test(`display ${width}x${height} ${layout}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height });
    await page.goto("/display");
    await expect(page.locator(".display-scene")).toHaveAttribute(
      "data-layout",
      layout,
    );
    await expect(page.locator(".lyric-hero")).toContainText(
      "Let the room become a river",
    );
    await page.getByRole("button", { name: "Pause demo" }).click();
    const position = await page
      .getByRole("slider", { name: "Demo playback position" })
      .inputValue();
    await page.waitForTimeout(350);
    expect(
      await page
        .getByRole("slider", { name: "Demo playback position" })
        .inputValue(),
    ).toBe(position);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await mkdir("test-results/screenshots", { recursive: true });
    await expect(page.locator(".art-frame")).toHaveCSS("opacity", "1");
    await expect(page.locator(".lyric-hero")).toHaveCSS("opacity", "1");
    await page.screenshot({
      path: `test-results/screenshots/display-${width}x${height}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}
test("demo seeks, skips and handles lyric gaps", async ({ page }) => {
  await page.goto("/display");
  await page.getByRole("button", { name: "Pause demo" }).click();
  await page
    .getByRole("slider", { name: "Demo playback position" })
    .fill("20000");
  await expect(page.locator(".lyric-hero")).toContainText(
    "Let the evening settle in",
  );
  await page
    .getByRole("slider", { name: "Demo playback position" })
    .fill("13000");
  await expect(page.locator(".lyric-hero")).toContainText("Between the lines");
  await page.getByRole("button", { name: "Next demo track" }).click();
  await expect(page.locator(".now-playing h2")).toHaveText("After the sun");
});
test("lab settings persist and reduced motion is honored", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/lab");
  await page.getByRole("button", { name: "Pulse", exact: true }).click();
  await page.getByLabel("Show synchronized lyrics").uncheck();
  await expect(page.locator(".lyric-hero")).toContainText("Between the lines");
  await page.getByRole("button", { name: "Portrait", exact: true }).click();
  await expect(page.locator(".display-scene")).toHaveAttribute(
    "data-layout",
    "Portrait",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Pulse", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page
      .locator(".sound-bars i")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await expect(page.locator(".art-frame")).toHaveCSS("opacity", "1");
  await expect(page.locator(".lyric-hero")).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: "test-results/screenshots/lab.png",
    fullPage: true,
  });
});
test("settings sleep override and diagnostics are transparent", async ({
  page,
}) => {
  await page.goto("/settings");
  await page.getByLabel("Music wakes the display").uncheck();
  await page.getByRole("button", { name: "Sleep", exact: false }).click();
  await page.getByRole("link", { name: "Display", exact: true }).click();
  await expect(page.locator(".display-scene")).toHaveAttribute(
    "data-scene",
    "SLEEP",
  );
  await page.getByRole("button", { name: "Wake for one hour" }).click();
  await expect(page.locator(".sleep-note")).toHaveCount(0);
  await page.getByRole("link", { name: "Diagnostics", exact: true }).click();
  await expect(page.getByText("Unverified · disabled").first()).toBeVisible();
});
test("gateway source connects and survives websocket reconnect", async ({
  page,
}) => {
  const sockets: WebSocketRoute[] = [];
  await page.routeWebSocket("ws://127.0.0.1:8787/events", (ws) => {
    ws.connectToServer();
    sockets.push(ws);
  });
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Local gateway", exact: true })
    .click();
  await page.getByRole("link", { name: "Diagnostics", exact: true }).click();
  await expect(
    page.getByText("Gateway connected", { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.locator("dd").filter({ hasText: "Original demo" }),
  ).toBeVisible();
  const count = sockets.length;
  sockets.at(-1)!.close();
  await expect.poll(() => sockets.length).toBeGreaterThan(count);
  await expect(
    page.getByText("Gateway connected", { exact: false }).first(),
  ).toBeVisible();
});
test("offline demo has no external asset dependencies", async ({
  page,
  context,
}) => {
  await page.goto("/display");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Next demo track" }).click();
  await expect(page.locator(".now-playing h2")).toHaveText("After the sun");
  await page.getByRole("button", { name: "Pause demo" }).click();
  await expect(page.locator(".display-scene")).toHaveAttribute(
    "data-state",
    "paused",
  );
});
