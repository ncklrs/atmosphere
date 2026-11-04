import { describe, expect, it } from "vitest";
import {
  emptyVisualFrame,
  prepareVisualScore,
  writeVisualScore,
  type VisualScoreSource,
} from "../packages/motion-engine/visual-score";
import { validateSettings } from "../apps/web/lib/settings";
const cues = prepareVisualScore([
  { startMs: 1000, endMs: 4000, text: "We return to the light" },
  { startMs: 4000, endMs: 7000, text: "A different road" },
  { startMs: 7000, endMs: 12000, text: "" },
  { startMs: 12000, endMs: 15000, text: "We return to the light" },
]);
const source: VisualScoreSource = {
  cues,
  positionMs: 1300,
  playing: true,
  amount: 100,
  intensity: "Pulse",
};
const at = (positionMs: number, patch: Partial<VisualScoreSource> = {}) =>
  writeVisualScore(emptyVisualFrame(), { ...source, ...patch }, positionMs);
describe("lyric-driven visual direction", () => {
  it("swells around actual phrase entrances, releases smoothly, and gives repeated lines more weight", () => {
    expect(at(1000).phrase).toBe(0);
    expect(at(1300).phrase).toBeGreaterThan(at(3500).phrase);
    expect(cues[0].weight).toBeGreaterThan(cues[1].weight);
    expect(at(1300).x).not.toBe(at(4300).x);
    expect(at(1300).chapter).not.toBe(at(4300).chapter);
  });
  it("opens empty lyrics and real cue gaps into ambient space", () => {
    expect(at(11000).space).toBeGreaterThan(at(7100).space);
    expect(at(9000)).toMatchObject({ phrase: 0, word: 0, drive: 0 });
    const gap = prepareVisualScore([
      { startMs: 0, endMs: 1000, text: "Hello" },
      { startMs: 8000, endMs: 9000, text: "Again" },
    ]);
    expect(at(6000, { cues: gap }).space).toBe(1);
  });
  it("uses real word tags and never invents beats or word pulses from line timing", () => {
    expect(at(1300).word).toBe(0);
    const tagged = prepareVisualScore([
      {
        startMs: 1000,
        endMs: 4000,
        text: "Hello again",
        words: [
          { startMs: 1000, text: "Hello" },
          { startMs: 2000, text: "again" },
        ],
      },
    ]);
    expect(at(2100, { cues: tagged }).word).toBeGreaterThan(
      at(1950, { cues: tagged }).word,
    );
  });
  it("reproduces seeks and pauses exactly, and zero/reduced motion removes all dynamics", () => {
    const expected = at(2300);
    at(13000);
    expect(at(2300)).toEqual(expected);
    expect(at(2300, { playing: false })).toEqual(expected);
    expect(at(2300, { amount: 0 })).toMatchObject({
      phrase: 0,
      word: 0,
      drive: 0,
      space: 0,
    });
    expect(
      writeVisualScore(emptyVisualFrame(), source, 2300, true),
    ).toMatchObject({ phrase: 0, word: 0, drive: 0, space: 0 });
    expect(at(1300, { intensity: "Whisper" }).phrase).toBeLessThan(
      at(1300).phrase,
    );
  });
  it("keeps untimed songs ambient, bounds settings, and handles missing legacy preferences", () => {
    expect(at(50000, { cues: [] })).toMatchObject({
      phrase: 0,
      word: 0,
      drive: 0,
      space: 1,
    });
    expect(validateSettings({}).visualDynamics).toBe(75);
    expect(validateSettings({ visualDynamics: Infinity }).visualDynamics).toBe(
      75,
    );
    expect(validateSettings({ visualDynamics: -4 }).visualDynamics).toBe(0);
    expect(validateSettings({ visualDynamics: 120 }).visualDynamics).toBe(100);
  });
});
