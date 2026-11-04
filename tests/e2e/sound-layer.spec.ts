import { openLabPanels } from "./lab-panels";
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
  await openLabPanels(page);
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
  await openLabPanels(page);
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
  await openLabPanels(page);
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
  await openLabPanels(page);
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
  await expect(page.locator(".audio-state")).toContainText("no audio input");
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
  await openLabPanels(page);
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
  await openLabPanels(page);
  const canvas = page.locator("canvas.sound-layer");
  await expect(canvas).toHaveAttribute("data-input", "reduced");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // Reduced motion may repaint the same image after hydration/resize; compare pixels,
  // not draw-call counts, to detect actual animation.
  const first = await fingerprint(canvas);
  await page.waitForTimeout(350);
  expect(await fingerprint(canvas)).toEqual(first);
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
  await openLabPanels(page);
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
  await openLabPanels(page);
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
  await openLabPanels(page);
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

async function mockWiredInput(
  page: import("@playwright/test").Page,
  mismatch = false,
) {
  await page.addInitScript(
    ({ mismatch }) => {
      const hardware = {
        present: true,
        calls: [] as MediaStreamConstraints[],
        stream: null as MediaStream | null,
      };
      Object.assign(window, { __wired: hardware });
      Object.defineProperty(navigator.mediaDevices, "enumerateDevices", {
        configurable: true,
        value: async () => [
          {
            kind: "audioinput",
            deviceId: "default",
            label: "Default microphone",
          },
          {
            kind: "audioinput",
            deviceId: "builtin-mic",
            label: "Built-in microphone",
          },
          ...(hardware.present
            ? [
                {
                  kind: "audioinput",
                  deviceId: "usb-line",
                  label: "USB Stereo Line Input",
                },
              ]
            : []),
        ],
      });
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: async (constraints: MediaStreamConstraints) => {
          hardware.calls.push(constraints);
          const context = new AudioContext(),
            destination = context.createMediaStreamDestination(),
            oscillator = context.createOscillator();
          oscillator.frequency.value = 220;
          oscillator.connect(destination);
          oscillator.start();
          void context.resume();
          const stream = destination.stream;
          hardware.stream = stream;
          const track = stream.getAudioTracks()[0],
            stop = track.stop.bind(track),
            settings = track.getSettings.bind(track);
          track.getSettings = () => ({
            ...settings(),
            deviceId: mismatch ? "builtin-mic" : "usb-line",
          });
          track.stop = () => {
            stop();
            oscillator.stop();
            void context.close();
          };
          return stream;
        },
      });
    },
    { mismatch },
  );
}

test("wired input requires a specific selection, analyzes only that input, and releases it on unplug", async ({
  page,
}) => {
  await mockWiredInput(page);
  await page.goto("/lab");
  await openLabPanels(page);
  await page.getByText("Choose another audio input", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Connect wired input", exact: true }),
  ).toBeDisabled();
  await expect(
    page
      .getByLabel("Wired audio input")
      .getByRole("option", { name: "Default microphone", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __wired: { calls: unknown[] } }).__wired.calls
          .length,
    ),
  ).toBe(0);
  await page.getByLabel("Wired audio input").selectOption("usb-line");
  await page
    .getByRole("button", { name: "Connect wired input", exact: true })
    .click();
  await expect(page.locator(".audio-state")).toContainText(
    "Live audio · USB Stereo Line Input",
  );
  await expect(page.locator("canvas.sound-layer")).toHaveAttribute(
    "data-input",
    "audio",
  );
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __wired: { calls: MediaStreamConstraints[] } })
          .__wired.calls,
    ),
  ).toEqual([
    {
      audio: {
        deviceId: { exact: "usb-line" },
        channelCount: { ideal: 2 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    },
  ]);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __soundTest: { peak: number } }).__soundTest
            .peak,
      ),
    )
    .toBeGreaterThan(0);
  await page.getByRole("link", { name: "Display", exact: true }).click();
  await expect(page.locator(".audio-session-indicator")).toContainText(
    "Wired input → visuals",
  );
  await page.getByRole("link", { name: "Visual lab", exact: true }).click();
  await openLabPanels(page, true);
  await page.getByText("Choose another audio input", { exact: true }).click();
  await expect(page.getByLabel("Wired audio input")).toHaveValue("usb-line");
  await page.evaluate(() => {
    (window as unknown as { __wired: { present: boolean } }).__wired.present =
      false;
    navigator.mediaDevices.dispatchEvent(new Event("devicechange"));
  });
  await expect(page.locator(".audio-session-indicator")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Connect wired input", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as { __wired: { stream: MediaStream } }
        ).__wired.stream.getAudioTracks()[0].readyState,
    ),
  ).toBe("ended");
});

test("a wired request never falls back to a different microphone returned by the browser", async ({
  page,
}) => {
  await mockWiredInput(page, true);
  await page.goto("/lab");
  await openLabPanels(page);
  await page.getByText("Choose another audio input", { exact: true }).click();
  await page.getByLabel("Wired audio input").selectOption("usb-line");
  await page
    .getByRole("button", { name: "Connect wired input", exact: true })
    .click();
  await expect(
    page.locator(".audio-source-card").getByRole("alert"),
  ).toContainText("selected wired input could not be opened or confirmed");
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as {
            __wired: { stream: MediaStream; calls: unknown[] };
          }
        ).__wired.stream.getAudioTracks()[0].readyState,
    ),
  ).toBe("ended");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __wired: { calls: unknown[] } }).__wired.calls
          .length,
    ),
  ).toBe(1);
  await expect(page.locator("canvas.sound-layer")).toHaveAttribute(
    "data-input",
    "ambient",
  );
  await expect(page.locator(".audio-session-indicator")).toHaveCount(0);
});

test("unplugged wired devices produce an error without starting the default input", async ({
  page,
}) => {
  await mockWiredInput(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () =>
        Promise.reject(
          new DOMException("Device removed", "OverconstrainedError"),
        ),
    }),
  );
  await page.goto("/lab");
  await openLabPanels(page);
  await page.getByText("Choose another audio input", { exact: true }).click();
  await page.getByLabel("Wired audio input").selectOption("usb-line");
  await page
    .getByRole("button", { name: "Connect wired input", exact: true })
    .click();
  await expect(
    page.locator(".audio-source-card").getByRole("alert"),
  ).toContainText("selected wired input could not be opened or confirmed");
  await expect(page.locator(".audio-session-indicator")).toHaveCount(0);
});

test("computer audio uses real FFT without microphone capture and releases video and audio", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const capture = {
      stream: null as MediaStream | null,
      options: null as unknown,
      mic: 0,
    };
    Object.assign(window, { __computer: capture });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () => {
        capture.mic++;
        throw new Error("No microphone");
      },
    });
    Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
      configurable: true,
      value: async (options: unknown) => {
        capture.options = options;
        const context = new AudioContext(),
          destination = context.createMediaStreamDestination(),
          oscillator = context.createOscillator();
        oscillator.connect(destination);
        oscillator.start();
        void context.resume();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 10;
        const video = canvas.captureStream().getVideoTracks()[0];
        const stream = new MediaStream([
          ...destination.stream.getAudioTracks(),
          video,
        ]);
        capture.stream = stream;
        const track = stream.getAudioTracks()[0],
          stop = track.stop.bind(track);
        track.stop = () => {
          stop();
          oscillator.stop();
          void context.close();
        };
        return stream;
      },
    });
  });
  await page.goto("/lab");
  await openLabPanels(page);
  await page
    .getByRole("button", { name: "Use computer audio", exact: true })
    .click();
  await expect(page.locator(".audio-state")).toContainText(
    "Live audio · Computer audio",
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
  expect(
    await page.evaluate(() => {
      const c = (
        window as unknown as {
          __computer: { stream: MediaStream; options: unknown; mic: number };
        }
      ).__computer;
      return {
        video: c.stream.getVideoTracks()[0].readyState,
        audio: c.stream.getAudioTracks()[0].readyState,
        options: c.options,
        mic: c.mic,
      };
    }),
  ).toMatchObject({
    video: "ended",
    audio: "live",
    mic: 0,
    options: { video: true, systemAudio: "include", windowAudio: "system" },
  });
  await page.getByRole("link", { name: "Display", exact: true }).click();
  await expect(page.locator(".audio-session-indicator")).toContainText(
    "Computer audio → visuals",
  );
  await page
    .getByRole("button", { name: "Stop visualizer audio", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as { __computer: { stream: MediaStream } }
        ).__computer.stream.getAudioTracks()[0].readyState,
    ),
  ).toBe("ended");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as { __soundTest: { contexts: AudioContext[] } }
        ).__soundTest.contexts.every((c) => c.state === "closed"),
      ),
    )
    .toBe(true);
});

test("a screen shared without audio gives clear guidance and releases its video", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
      configurable: true,
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 10;
        const stream = canvas.captureStream();
        Object.assign(window, { __noAudio: stream });
        return stream;
      },
    });
  });
  await page.goto("/lab");
  await openLabPanels(page);
  await page
    .getByRole("button", { name: "Use computer audio", exact: true })
    .click();
  await expect(
    page.locator(".audio-source-card").getByRole("alert"),
  ).toContainText("No shared audio was provided");
  expect(
    await page.evaluate(() =>
      (window as unknown as { __noAudio: MediaStream }).__noAudio
        .getTracks()
        .every((t) => t.readyState === "ended"),
    ),
  ).toBe(true);
  await expect(page.locator(".audio-session-indicator")).toHaveCount(0);
});

test("cancelled computer sharing stays disconnected without microphone fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
      configurable: true,
      value: () =>
        Promise.reject(new DOMException("Cancelled", "NotAllowedError")),
    });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () => {
        throw new Error("Unexpected microphone request");
      },
    });
  });
  await page.goto("/lab");
  await openLabPanels(page);
  await page
    .getByRole("button", { name: "Use computer audio", exact: true })
    .click();
  await expect(
    page.locator(".audio-source-card").getByRole("alert"),
  ).toContainText("cancelled or blocked");
  await expect(page.locator(".audio-session-indicator")).toHaveCount(0);
});

test("a late computer sharing grant is stopped after cancellation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
      configurable: true,
      value: () =>
        new Promise<MediaStream>((resolve) => {
          Object.assign(window, {
            __grantComputer: () => {
              const canvas = document.createElement("canvas");
              canvas.width = canvas.height = 10;
              const stream = canvas.captureStream();
              Object.assign(window, { __lateComputer: stream });
              resolve(stream);
            },
          });
        }),
    });
  });
  await page.goto("/lab");
  await openLabPanels(page);
  await page
    .getByRole("button", { name: "Use computer audio", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Stop visualizer audio", exact: true })
    .click();
  await page.evaluate(() =>
    (window as unknown as { __grantComputer: () => void }).__grantComputer(),
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { __lateComputer: MediaStream }).__lateComputer
          .getTracks()
          .every((t) => t.readyState === "ended"),
      ),
    )
    .toBe(true);
  await expect(page.locator(".audio-session-indicator")).toHaveCount(0);
});
