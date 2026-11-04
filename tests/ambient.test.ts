import { describe, expect, it } from "vitest";
import { ambientVisuals } from "../packages/design-system/visuals";
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
      ambientVisual: "Orbit",
    });
  });
  it("persists supported presets and rejects malformed visual names", () => {
    for (const visual of ambientVisuals) {
      expect(validateSettings({ ambientVisual: visual }).ambientVisual).toBe(
        visual,
      );
    }
    expect(
      validateSettings({ ambientVisual: "url(untrusted)" }).ambientVisual,
    ).toBe("Orbit");
  });
});

it("migrates and bounds independent Prism controls", () => {
  expect(
    validateSettings({ source: "gateway", ambientVisual: "Prism" }),
  ).toMatchObject({
    source: "gateway",
    ambientVisual: "Prism",
    prism: { light: 55, motion: 30, facetSize: 70 },
  });
  expect(
    validateSettings({ prism: { light: -10, motion: 0, facetSize: 120 } })
      .prism,
  ).toEqual({ light: 0, motion: 0, facetSize: 100 });
  expect(
    validateSettings({ prism: { light: "bad", motion: null } }).prism,
  ).toEqual({ light: 55, motion: 30, facetSize: 70 });
});
