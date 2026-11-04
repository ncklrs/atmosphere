import { describe, expect, it } from "vitest";
import {
  writeWordFrame,
  wordTreatment,
  wordTreatments,
  type WordFrame,
} from "../packages/motion-engine/word-motion";
const frame = (
  elapsed: number,
  ordinal = 0,
  treatment = wordTreatments[0] as (typeof wordTreatments)[number],
  reduced = false,
  timed = false,
  duration = 5000,
) =>
  writeWordFrame(
    {} as WordFrame,
    elapsed,
    duration,
    ordinal,
    6,
    treatment,
    "Flow",
    reduced,
    timed,
  );
describe("word-level choreography", () => {
  it("offers five distinct entrances and staggers words without inventing timestamps", () => {
    expect(new Set(wordTreatments.map((_, i) => wordTreatment(i))).size).toBe(
      5,
    );
    expect(frame(120, 0).opacity).toBeGreaterThan(frame(120, 5).opacity);
    expect(frame(200, 0, "slide").x).toBeLessThan(0);
    expect(frame(200, 1, "slide").x).toBeGreaterThan(0);
    expect(frame(200, 0, "unfold").scaleX).toBeLessThan(1);
    expect(frame(200, 0, "scatter").rotate).not.toBe(0);
    expect(frame(200, 0, "reveal").clip).toBeGreaterThan(0);
  });
  it("reproduces seeks, reaches readable holds and removes transforms for reduced motion", () => {
    for (const treatment of wordTreatments) {
      const entered = frame(250, 3, treatment);
      frame(9000, 0, treatment);
      expect(frame(250, 3, treatment)).toEqual(entered);
      expect(frame(1500, 5, treatment)).toEqual({
        x: 0,
        y: 0,
        rotate: 0,
        tilt: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        clip: 0,
      });
      expect(frame(-100, 3, treatment, true)).toEqual(
        frame(9000, 3, treatment, true),
      );
      expect(frame(250, 5, treatment, false, false, 400).opacity).toBe(1);
    }
  });
  it("uses the actual timestamp as the entrance origin when real word cues exist", () => {
    expect(frame(-1, 5, "rise", false, true).opacity).toBe(0);
    expect(frame(100, 5, "rise", false, true).opacity).toBeGreaterThan(0);
    expect(frame(100, 5, "rise", false, false).opacity).toBe(0);
  });
});
