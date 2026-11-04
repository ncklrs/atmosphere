import { haloSpectrum } from "../apps/web/lib/visuals/spectrum";
import { describe, expect, it } from "vitest";
import {
  defaultSoundLayer,
  resolveSoundStyle,
  soundGeometry,
  validateSoundLayer,
} from "../packages/design-system/sound-layer";
import { validateSettings } from "../apps/web/lib/settings";
import { demoSample, demoSeconds } from "../apps/web/lib/audio/demo";
describe("sound-layer preferences and composition", () => {
  it("retires legacy engine preferences and preserves the original visual and playback settings", () => {
    const migrated = validateSettings({
      visualEngine: "milkdrop",
      milkdrop: { preset: "jelly-space" },
      ambientVisual: "Prism",
      source: "gateway",
      autoVisuals: true,
      calibrationMs: 300,
    });
    expect(migrated).toMatchObject({
      ambientVisual: "Prism",
      source: "gateway",
      autoVisuals: true,
      calibrationMs: 300,
      soundLayer: defaultSoundLayer,
    });
    expect(migrated).not.toHaveProperty("visualEngine");
    expect(migrated).not.toHaveProperty("milkdrop");
    expect(
      validateSoundLayer({
        enabled: true,
        style: "external",
        placement: "bad",
        strength: -1,
        size: Infinity,
        sensitivity: 150,
      }),
    ).toEqual({
      ...defaultSoundLayer,
      enabled: true,
      strength: 0,
      sensitivity: 100,
    });
    expect(
      validateSoundLayer({ strength: 0, size: 0, sensitivity: 0 }),
    ).toMatchObject({ strength: 0, size: 0, sensitivity: 0 });
  });
  it("pairs treatments with existing scenes and keeps radial geometry inside desktop and phone bounds", () => {
    expect(resolveSoundStyle("Auto", "Orbit")).toBe("Halo");
    expect(resolveSoundStyle("Auto", "Tide")).toBe("Ribbons");
    expect(resolveSoundStyle("Auto", "Nova")).toBe("Stardust");
    expect(resolveSoundStyle("Ribbons", "Orbit")).toBe("Ribbons");
    for (const [width, height] of [
      [1920, 1080],
      [390, 844],
      [800, 480],
    ]) {
      for (const placement of ["Auto", "Center", "Right", "Lower"] as const) {
        const { x, y, radius } = soundGeometry(
          width,
          height,
          { ...defaultSoundLayer, size: 100, placement },
          true,
        );
        expect(x - radius).toBeGreaterThanOrEqual(0);
        expect(x + radius).toBeLessThanOrEqual(width);
        expect(y - radius).toBeGreaterThanOrEqual(0);
        expect(y + radius).toBeLessThanOrEqual(height);
      }
    }
  });
  it("synthesizes a bounded original loop with changing musical energy and a quiet seam", () => {
    let peak = 0,
      power = 0;
    for (let i = 0; i < 8000; i++) {
      const sample = demoSample(i / 1000);
      expect(Number.isFinite(sample)).toBe(true);
      peak = Math.max(peak, Math.abs(sample));
      power += sample * sample;
    }
    expect(peak).toBeGreaterThan(0.2);
    expect(peak).toBeLessThanOrEqual(0.8);
    expect(power).toBeGreaterThan(1);
    expect(demoSample(0)).toBe(0);
    expect(Math.abs(demoSample(demoSeconds))).toBe(0);
  });
});

it("frequency spokes stay at zero in silence, mirror the signal, and cap their excursion", () => {
  const silence = haloSpectrum(new Uint8Array(1024), 4, 100);
  expect(silence.every((value) => value === 0)).toBe(true);
  const signal = new Uint8Array(1024);
  signal.fill(255, 4, 32);
  const bands = haloSpectrum(signal, 4, 100);
  expect(Math.max(...bands)).toBe(100);
  expect(bands.slice(0, 24)).toEqual(bands.slice(24, 48).reverse());
  expect(bands.slice(0, 48)).toEqual(bands.slice(48));
  expect(
    haloSpectrum(new Uint8Array(0), 4, 100).every((value) => value === 0),
  ).toBe(true);
});
