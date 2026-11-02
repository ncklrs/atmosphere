import { describe, expect, it } from "vitest";
import { validateSettings } from "../apps/web/lib/settings";
describe("ambient visual preferences", () => {
  it("migrates existing local preferences without changing the live source or calibration", () => {
    expect(
      validateSettings({
        source: "gateway",
        calibrationMs: 250,
        intensity: "Pulse",
        lyrics: false,
      }),
    ).toMatchObject({
      source: "gateway",
      calibrationMs: 250,
      intensity: "Pulse",
      lyrics: false,
      ambientVisual: "Bloom",
    });
  });
  it("persists supported presets and rejects malformed visual names", () => {
    expect(validateSettings({ ambientVisual: "Orbit" }).ambientVisual).toBe(
      "Orbit",
    );
    expect(validateSettings({ ambientVisual: "Tide" }).ambientVisual).toBe(
      "Tide",
    );
    expect(
      validateSettings({ ambientVisual: "url(untrusted)" }).ambientVisual,
    ).toBe("Bloom");
  });
});
