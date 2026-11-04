import { test, expect } from "@playwright/test";
import { demoPlayback, demoLyrics } from "../../packages/fixtures/index";
test("a paired phone changes the display and loses access when revoked", async ({
  browser,
  baseURL,
}) => {
  const owner = await browser.newContext(),
    phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const display = await owner.newPage(),
    remote = await phone.newPage();
  await owner.addInitScript(() =>
    localStorage.setItem(
      "atmosphere.settings.v1",
      JSON.stringify({
        source: "gateway",
        override: { scene: "AMBIENT_DAY", expiresAt: 4102444800000 },
      }),
    ),
  );
  for (const context of [owner, phone])
    await context.route("**/api/gateway/state", (route) =>
      route.fulfill({
        json: {
          type: "snapshot",
          playback: { ...demoPlayback(0, 0), state: "paused" },
          lyrics: demoLyrics(0),
          connected: true,
          sentAt: Date.now(),
        },
      }),
    );
  const headers = { Origin: baseURL! };
  try {
    await owner.request.post(`${baseURL}/api/room/disable`, {
      headers,
      data: {},
    });
    await display.goto(`${baseURL}/settings`);
    await display
      .getByRole("button", { name: "Enable phone controls", exact: true })
      .click();
    const code = await display.locator(".pair-code").innerText();
    expect(code).toMatch(/^\d{6}$/);
    await remote.goto(`${baseURL}/remote`);
    await expect(remote.getByLabel("Pairing code")).toBeVisible();
    const denied = await phone.request.post(
      `${baseURL}/api/room/settings?controller=1`,
      { headers, data: { patch: { brightness: 5 } } },
    );
    expect(denied.status()).toBe(401);
    const csrf = await phone.request.post(
      `${baseURL}/api/room/pair?controller=1`,
      { headers: { Origin: "https://elsewhere.invalid" }, data: { code } },
    );
    expect(csrf.status()).toBe(403);
    await remote.getByLabel("Pairing code").fill(code);
    await remote
      .getByRole("button", { name: "Pair display", exact: true })
      .click();
    await expect(
      remote.getByText("Connected to your display", { exact: true }),
    ).toBeVisible();
    await display.goto(`${baseURL}/display`);
    await remote.getByRole("button", { name: "Ink", exact: true }).click();
    await expect(display.locator(".ambient-visuals")).toHaveAttribute(
      "data-visual",
      "Ink",
    );
    let interrupted = false;
    await remote.route("**/api/room/settings?controller=1", async (route) => {
      if (!interrupted) {
        interrupted = true;
        await route.abort();
      } else await route.continue();
    });
    await remote.getByLabel("Display brightness").fill("20");
    await expect
      .poll(async () =>
        Number(
          await display
            .locator(".brightness-layer")
            .evaluate((el) => (el as HTMLElement).style.opacity),
        ),
      )
      .toBeGreaterThan(0.7);
    await remote
      .getByText("Lyric timing & corrections", { exact: true })
      .click();
    await remote.getByLabel("This song lyric timing").fill("1000");
    await expect
      .poll(async () => {
        const state = await (
          await owner.request.get(`${baseURL}/api/room/state`)
        ).json();
        return state.settings.trackOffsets["demo:0"];
      })
      .toBe(1000);
    await remote.reload();
    await expect(
      remote.getByText("Connected to your display", { exact: true }),
    ).toBeVisible();
    await expect(remote.getByLabel("Display brightness")).toHaveValue("20");
    const state = await (
      await phone.request.get(`${baseURL}/api/room/state?controller=1`)
    ).json();
    expect(state).not.toHaveProperty("code");
    expect(state.owner).toBe(false);
    await owner.request.post(`${baseURL}/api/room/disable`, {
      headers,
      data: {},
    });
    await expect(remote.getByLabel("Pairing code")).toBeVisible();
  } finally {
    await owner.request.post(`${baseURL}/api/room/disable`, {
      headers,
      data: {},
    });
    await owner.close();
    await phone.close();
  }
});
