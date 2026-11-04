import { test, expect, type Locator } from "@playwright/test";
import { demoSample } from "../../apps/web/lib/audio/demo";
async function fingerprint(canvas: Locator) {
  return canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement,
      ctx = c.getContext("2d")!;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let hash = 2166136261,
      visible = 0;
    for (let i = 0; i < data.length; i += 4) {
      hash = Math.imul(hash ^ data[i], 16777619);
      hash = Math.imul(hash ^ data[i + 3], 16777619);
      if (data[i + 3] > 8) visible++;
    }
    return { hash: hash >>> 0, visible, pixels: c.width * c.height };
  });
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("atmosphere.settings.v1"))
      localStorage.setItem(
        "atmosphere.settings.v1",
        JSON.stringify({
          source: "demo",
          lyrics: false,
          soundLayer: { enabled: true, style: "Halo" },
          override: { scene: "AMBIENT_DAY", expiresAt: 4102444800000 },
        }),
      );
    const metrics = { contexts: [] as AudioContext[], peak: 0, micRequests: 0 };
    Object.assign(window, { __soundTest: metrics });
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        metrics.contexts.push(this);
      }
      createAnalyser() {
        const node = super.createAnalyser(),
          original = node.getByteFrequencyData.bind(node);
        node.getByteFrequencyData = (data) => {
          original(data);
          metrics.peak = Math.max(metrics.peak, ...data);
        };
        return node;
      }
    };
  });
});
test("three layered treatments render over the native engine without automatically creating audio", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/lab");
  await expect(
    page.getByRole("button", { name: "Milkdrop", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".ambient-visuals")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  const canvas = page.locator("canvas.sound-layer");
  const hashes = new Set<number>();
  for (const name of ["Halo", "Ribbons", "Stardust"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(canvas).toHaveAttribute("data-style", name);
    const sample = await fingerprint(canvas);
    expect(sample.visible).toBeGreaterThan(100);
    expect(sample.pixels).toBeLessThan(602000);
    hashes.add(sample.hash);
    await page
      .locator(".preview")
      .screenshot({ path: `test-results/screenshots/sound-${name}.png` });
  }
  expect(hashes.size).toBe(3);
  await expect(canvas).toHaveAttribute("data-input", "ambient");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __soundTest: { contexts: AudioContext[] } })
          .__soundTest.contexts.length,
    ),
  ).toBe(0);
  await page.getByRole("slider", { name: "Sound layer presence" }).fill("40");
  await page.getByRole("slider", { name: "Sound layer size" }).fill("75");
  await page.getByRole("button", { name: "Lower", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Stardust", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("slider", { name: "Sound layer presence" }),
  ).toHaveValue("40");
  await expect(
    page.getByRole("slider", { name: "Sound layer size" }),
  ).toHaveValue("75");
  await expect(
    page.getByRole("button", { name: "Lower", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});
test("real synthesized audio drives Waviz FFT, survives navigation, and closes when stopped", async ({
  page,
}) => {
  await page.goto("/lab");
  await page.getByRole("slider", { name: "Visualizer audio volume" }).fill("0");
  await page
    .getByRole("button", { name: "Try with test audio", exact: true })
    .click();
  await expect(page.locator(".audio-state")).toContainText(
    "Live audio · Original test loop",
  );
  await expect(page.locator("canvas.sound-layer")).toHaveAttribute(
    "data-input",
    "audio",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __soundTest: { peak: number } }).__soundTest
            .peak,
      ),
    )
    .toBeGreaterThan(0);
  for (const style of ["Halo", "Ribbons", "Stardust"]) {
    await page.getByRole("button", { name: style, exact: true }).click();
    await expect(page.locator("canvas.sound-layer")).toHaveAttribute(
      "data-style",
      style,
    );
    await page.waitForTimeout(250);
    expect(
      (await fingerprint(page.locator("canvas.sound-layer"))).visible,
    ).toBeGreaterThan(100);
    await page
      .locator(".preview")
      .screenshot({ path: `test-results/screenshots/sound-live-${style}.png` });
  }
  const first = await fingerprint(page.locator("canvas.sound-layer"));
  await page.waitForTimeout(350);
  expect((await fingerprint(page.locator("canvas.sound-layer"))).hash).not.toBe(
    first.hash,
  );
  await page.getByRole("link", { name: "Display", exact: true }).click();
  await expect(page.locator("canvas.sound-layer")).toHaveAttribute(
    "data-input",
    "audio",
  );
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __soundTest: { contexts: AudioContext[] } })
          .__soundTest.contexts.length,
    ),
  ).toBe(1);
  await page
    .getByRole("button", { name: "Stop visualizer audio", exact: true })
    .click();
  await expect(page.locator("canvas.sound-layer")).toHaveAttribute(
    "data-input",
    "ambient",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __soundTest: { contexts: AudioContext[] } })
            .__soundTest.contexts[0].state,
      ),
    )
    .toBe("closed");
  await expect(page.locator(".audio-session-indicator")).toHaveCount(0);
});
function wav() {
  const rate = 16000,
    length = rate * 3,
    data = Buffer.alloc(44 + length * 2);
  data.write("RIFF", 0);
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++)
    data.writeInt16LE(Math.round(demoSample(i / rate) * 32767), 44 + i * 2);
  return data;
}
test("local audio files play, pause, resume, and disconnect without uploading", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (
      !request.url().startsWith("http://127.0.0.1:") &&
      !request.url().startsWith("blob:") &&
      !request.url().startsWith("data:")
    )
      external.push(request.url());
  });
  await page.goto("/lab");
  await page.getByRole("slider", { name: "Visualizer audio volume" }).fill("0");
  await page.getByLabel("Choose local audio file").setInputFiles({
    name: "original-test.wav",
    mimeType: "audio/wav",
    buffer: wav(),
  });
  await expect(page.locator(".audio-state")).toContainText(
    "Live audio · original-test.wav",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __soundTest: { peak: number } }).__soundTest
            .peak,
      ),
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Pause local audio", exact: true })
    .click();
  await expect(page.locator(".audio-state")).toContainText("Paused");
  await page
    .getByRole("button", { name: "Resume local audio", exact: true })
    .click();
  await expect(page.locator("canvas.sound-layer")).toHaveAttribute(
    "data-input",
    "audio",
  );
  await page
    .getByRole("button", { name: "Disconnect audio", exact: true })
    .click();
  await expect(page.locator(".audio-state")).toContainText(
    "no audio connected",
  );
  expect(external).toEqual([]);
});
test("microphone denial is recoverable and a late permission result is immediately stopped after cancellation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () =>
        Promise.reject(new DOMException("Denied", "NotAllowedError")),
    });
  });
  await page.goto("/lab");
  await page
    .getByRole("button", { name: "Use microphone", exact: true })
    .click();
  await expect(
    page.locator(".audio-source-card").getByRole("alert"),
  ).toContainText("Audio access was not allowed");
  await page.evaluate(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () =>
        new Promise((resolve) => {
          Object.assign(window, {
            __grantLate: () =>
              resolve({
                getTracks: () => [
                  {
                    stop: () => Object.assign(window, { __lateStopped: true }),
                  },
                ],
              }),
          });
        }),
    });
  });
  await page
    .getByRole("button", { name: "Use microphone", exact: true })
    .click();
  await expect(page.locator(".audio-state")).toContainText("Connecting audio");
  await page
    .getByRole("button", { name: "Disconnect audio", exact: true })
    .click();
  await page.evaluate(() =>
    (window as unknown as { __grantLate: () => void }).__grantLate(),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __lateStopped: boolean }).__lateStopped,
      ),
    )
    .toBe(true);
  await expect(page.locator("canvas.sound-layer")).toHaveAttribute(
    "data-input",
    "ambient",
  );
});
test("reduced motion stays static, disabling the layer stops audio, and sleep tears it down", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/lab");
  const canvas = page.locator("canvas.sound-layer");
  await expect(canvas).toHaveAttribute("data-input", "reduced");
  const first = await canvas.getAttribute("data-frame");
  await page.waitForTimeout(350);
  expect(await canvas.getAttribute("data-frame")).toBe(first);
  await page.getByRole("slider", { name: "Visualizer audio volume" }).fill("0");
  await page
    .getByRole("button", { name: "Play test audio", exact: true })
    .click();
  await expect(page.locator(".audio-state")).toContainText("Live audio");
  await page.getByLabel("Enable sound layer").uncheck();
  await expect(canvas).toHaveCount(0);
  await expect(page.locator(".audio-session-indicator")).toHaveCount(0);
  await page.getByLabel("Enable sound layer").check();
  await page
    .getByRole("button", { name: "Play test audio", exact: true })
    .click();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Music wakes the display").uncheck();
  await page.getByRole("button", { name: "Sleep", exact: false }).click();
  await page.getByRole("link", { name: "Display", exact: true }).click();
  await expect(canvas).toHaveCount(0);
  await expect(page.locator(".audio-session-indicator")).toHaveCount(0);
});
test("the layer preserves lyric contrast and art-free breaks, with usable phone controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/lab");
  await page.getByLabel("Show synchronized lyrics").check();
  await page.getByRole("button", { name: "Pause demo", exact: true }).click();
  await page
    .getByRole("slider", { name: "Demo playback position", exact: true })
    .fill("20000");
  await page.getByLabel("High contrast").check();
  await expect(page.locator("canvas.sound-layer")).toHaveCSS(
    "opacity",
    "0.143",
  );
  await page
    .getByRole("slider", { name: "Demo playback position", exact: true })
    .fill("13000");
  await expect(page.locator("canvas.sound-layer")).toHaveCSS("opacity", "0.65");
  await expect(page.locator(".artwork")).toHaveCount(0);
  await expect(page.locator(".lyric-hero")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator(".preview")
    .screenshot({ path: "test-results/screenshots/sound-phone.png" });
});

test("an accepted test microphone stream is disconnected and its track ends on Stop", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        // A locally generated silent stream; no physical microphone permission/capture.
        const context = new AudioContext(),
          destination = context.createMediaStreamDestination();
        Object.assign(window, {
          __testMic: { stream: destination.stream, context },
        });
        const track = destination.stream.getAudioTracks()[0],
          stop = track.stop.bind(track);
        track.stop = () => {
          stop();
          void context.close();
        };
        return destination.stream;
      },
    });
  });
  await page.goto("/lab");
  await page
    .getByRole("button", { name: "Use microphone", exact: true })
    .click();
  await expect(page.locator(".audio-state")).toContainText(
    "Live audio · Room microphone",
  );
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
          window as unknown as { __testMic: { stream: MediaStream } }
        ).__testMic.stream.getAudioTracks()[0].readyState,
    ),
  ).toBe("ended");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as { __soundTest: { contexts: AudioContext[] } }
        ).__soundTest.contexts.every((context) => context.state === "closed"),
      ),
    )
    .toBe(true);
});

test("unavailable Web Audio leaves an actionable error and keeps the original background", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto("/lab");
  await page
    .getByRole("button", { name: "Play test audio", exact: true })
    .click();
  await expect(
    page.locator(".audio-source-card").getByRole("alert"),
  ).toContainText("Could not start this audio source");
  await expect(page.locator(".ambient-visuals")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  await expect(page.locator(".audio-session-indicator")).toHaveCount(0);
});
