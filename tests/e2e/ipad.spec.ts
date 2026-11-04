import { test, expect } from "@playwright/test";
import { demoPlayback, demoLyrics } from "../../packages/fixtures/index";
import { defaults } from "../../apps/web/lib/settings";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(AbortSignal, "any", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(AbortSignal, "timeout", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "platform", {
      configurable: true,
      value: "MacIntel",
    });
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      value: 5,
    });
    localStorage.setItem(
      "atmosphere.settings.v1",
      JSON.stringify({ source: "gateway", soundLayer: { enabled: true } }),
    );
  });
  await page.route("**/api/gateway/state", (route) =>
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
  await page.route("**/api/ipad/setup", (route) =>
    route.fulfill({
      json: {
        origin: "https://192.168.0.162:3443",
        fingerprint: "AA:BB:CC",
        expires: "Test certificate",
        name: "Atmosphere iPad Local Test CA",
        certificateUrl: "/api/ipad/certificate",
      },
    }),
  );
});
test("gateway playback and tablet rendering work without newer Safari abort helpers", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/display");
  await expect(page.locator(".now-playing h2")).toHaveText("The space between");
  const canvas = page.locator("canvas.generative-canvas");
  await expect(canvas).toHaveAttribute("data-quality", "tablet");
  const pixels = await canvas.evaluate(
    (el) => (el as HTMLCanvasElement).width * (el as HTMLCanvasElement).height,
  );
  expect(pixels).toBeLessThan(262000);
  expect(errors).toEqual([]);
});
test("unsecured iPad setup explains certificate trust without starting capture", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    }),
  );
  await page.goto("/ipad");
  await expect(
    page.getByRole("heading", { name: "1. Set up trusted HTTPS", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Download iPad test certificate",
      exact: true,
    }),
  ).toHaveAttribute("href", "/api/ipad/certificate");
  await expect(
    page.getByRole("button", { name: "Start iPad microphone", exact: true }),
  ).toHaveCount(0);
});
test("a paired iPad starts local microphone analysis and keeps it when entering Display", async ({
  page,
}) => {
  let settings = {
      ...defaults,
      source: "gateway",
      soundLayer: { ...defaults.soundLayer, enabled: false },
    },
    paired = false,
    revision = 1;
  await page.route("**/api/room/*", async (route) => {
    const action = new URL(route.request().url()).pathname.split("/").pop();
    if (action === "pair") {
      paired = true;
      await route.fulfill({ json: { ok: true } });
      return;
    }
    if (!paired) {
      await route.fulfill({ status: 401, json: { enabled: true } });
      return;
    }
    if (action === "settings") {
      settings = { ...settings, ...route.request().postDataJSON().patch };
      revision++;
    }
    await route.fulfill({
      json: {
        sessionId: "ipad",
        enabled: true,
        owner: false,
        revision,
        settings,
      },
    });
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        const context = new AudioContext(),
          out = context.createMediaStreamDestination(),
          osc = context.createOscillator();
        osc.connect(out);
        osc.start();
        void context.resume();
        Object.assign(window, { __ipadStream: out.stream });
        const track = out.stream.getAudioTracks()[0],
          stop = track.stop.bind(track);
        track.stop = () => {
          stop();
          osc.stop();
          void context.close();
        };
        return out.stream;
      },
    });
  });
  await page.goto("/ipad");
  await page.getByLabel("Pairing code", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Pair iPad", exact: true }).click();
  await expect(
    page.getByText("Connected to your room.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start iPad microphone", exact: true })
    .click();
  await expect(page.getByText(/Microphone connected/)).toBeVisible();
  await expect
    .poll(async () =>
      Number(
        await page
          .getByRole("meter", { name: "Microphone input level" })
          .getAttribute("value"),
      ),
    )
    .toBeGreaterThan(0.01);
  await page
    .getByRole("link", { name: "Enter display ↗", exact: true })
    .click();
  await expect(page.locator("canvas.sound-layer")).toHaveAttribute(
    "data-input",
    "audio",
  );
  await page
    .getByRole("button", { name: "Stop visualizer audio", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as { __ipadStream: MediaStream }
        ).__ipadStream.getAudioTracks()[0].readyState,
    ),
  ).toBe("ended");
});
