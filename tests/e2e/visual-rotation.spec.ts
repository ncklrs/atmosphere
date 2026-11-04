import { openLabPanels } from "./lab-panels";
import { test, expect } from "@playwright/test";
import { demoPlayback } from "../../packages/fixtures/index";
test("automatic backgrounds change per song, survive reload, and yield to manual selection", async ({
  page,
}) => {
  let song = "First",
    revision = 10,
    position = 1000;
  await page.addInitScript(() => {
    if (!localStorage.getItem("atmosphere.settings.v1"))
      localStorage.setItem(
        "atmosphere.settings.v1",
        JSON.stringify({
          source: "gateway",
          ambientVisual: "Prism",
          override: { scene: "AMBIENT_DAY", expiresAt: 4102444800000 },
        }),
      );
  });
  await page.route("**/api/gateway/state", (route) =>
    route.fulfill({
      json: {
        type: "snapshot",
        sessionId: "rotation",
        playback: {
          ...demoPlayback(0, 0, revision),
          sourceId: "wiim",
          trackKey: song,
          title: song,
          artist: "Fixture",
          positionMs: position,
        },
        lyrics: null,
        connected: true,
        sentAt: Date.now(),
      },
    }),
  );
  await page.goto("/lab");
  await openLabPanels(page);
  const toggle = page.getByLabel("Auto-rotate visuals per song"),
    layer = page.locator(".ambient-visuals");
  await expect(page.locator(".now-playing h2")).toHaveText("First");
  await toggle.check();
  await expect(layer).toHaveAttribute("data-visual", "Prism");
  revision++;
  position = 30000;
  await page.waitForTimeout(650);
  await expect(layer).toHaveAttribute("data-visual", "Prism");
  song = "Second";
  revision++;
  await expect(layer).toHaveAttribute("data-visual", "Voyage");
  await page.reload();
  await openLabPanels(page);
  await expect(toggle).toBeChecked();
  await expect(layer).toHaveAttribute("data-visual", "Voyage");
  await toggle.uncheck();
  await expect(layer).toHaveAttribute("data-visual", "Voyage");
  await toggle.check();
  song = "Third";
  revision++;
  await expect(layer).toHaveAttribute("data-visual", "Ink");
  await page.getByRole("button", { name: "Nova", exact: true }).click();
  await expect(toggle).not.toBeChecked();
  song = "Fourth";
  revision++;
  await expect(page.locator(".now-playing h2")).toHaveText("Fourth");
  await expect(layer).toHaveAttribute("data-visual", "Nova");
});
