import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("atmosphere.settings.v1"))
      localStorage.setItem(
        "atmosphere.settings.v1",
        JSON.stringify({
          source: "demo",
          override: { scene: "AMBIENT_DAY", expiresAt: 4102444800000 },
        }),
      );
  });
});
test("clean display fills the room, hides chrome, and wakes on keyboard", async ({
  page,
}) => {
  await page.goto("/display");
  await expect(page.locator(".app")).toHaveClass(/clean-display/);
  await expect(page.locator(".section-index")).toBeHidden();
  await expect(page.locator(".scene-progress")).toBeHidden();
  await page.locator("main").click({ position: { x: 10, y: 200 } });
  await expect(page.locator(".app")).toHaveClass(/chrome-quiet/, {
    timeout: 6500,
  });
  await expect(page.locator(".app-header")).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(page.locator(".app")).toHaveClass(/chrome-awake/);
  await expect(
    page.getByRole("link", { name: "Visual lab", exact: true }),
  ).toBeVisible();
  const dimensions = await page.locator(".display-main").evaluate((el) => ({
    height: el.getBoundingClientRect().height,
    viewport: innerHeight,
  }));
  expect(Math.abs(dimensions.height - dimensions.viewport)).toBeLessThan(2);
});
test("lab has compact common controls, favorites and persistent display choices", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/lab");
  await expect(page.getByLabel("Song dynamics", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Prism motion speed")).toHaveCount(0);
  await expect(page.getByLabel("Enable sound layer")).toBeHidden();
  await page.getByRole("button", { name: "Favorite Ink", exact: true }).click();
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Ink", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Orbit", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Ink", exact: true }).click();
  await page.getByText("Display preferences", { exact: true }).click();
  await page.getByLabel("Show idle clock").uncheck();
  await page.getByLabel("Show song progress").check();
  await page.reload();
  await page.getByText("Display preferences", { exact: true }).click();
  await expect(page.getByLabel("Show idle clock")).not.toBeChecked();
  await expect(page.getByLabel("Show song progress")).toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("per-song correction and wrong-lyrics suppression persist independently", async ({
  page,
}) => {
  await page.goto("/lab");
  await page.getByRole("button", { name: "Pause demo", exact: true }).click();
  await page.getByText("Lyric timing & corrections", { exact: true }).click();
  await page.getByLabel("This song lyric timing").fill("850");
  await page
    .getByRole("button", { name: "Wrong lyrics? Hide this song", exact: true })
    .click();
  await expect(page.locator(".lyric-hero")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Next demo track", exact: true })
    .click();
  await expect(page.getByLabel("This song lyric timing")).toHaveValue("0");
  await expect(page.locator(".lyric-hero")).toBeVisible();
  await page
    .getByRole("button", { name: "Previous demo track", exact: true })
    .click();
  await expect(page.getByLabel("This song lyric timing")).toHaveValue("850");
  await expect(page.locator(".lyric-hero")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Restore this song’s lyrics", exact: true })
    .click();
  await expect(page.locator(".lyric-hero")).toBeVisible();
});
