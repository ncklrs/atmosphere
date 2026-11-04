import { describe, expect, it } from "vitest";
import {
  choreography,
  splitPhrase,
  writeChoreographyFrame,
  type ChoreographyFrame,
} from "../packages/motion-engine/choreography";
const frame = (
  elapsed: number,
  intensity: "Whisper" | "Flow" | "Pulse" = "Flow",
  reduced = false,
  index = 0,
) =>
  writeChoreographyFrame(
    {
      leadX: 0,
      leadY: 0,
      focusX: 0,
      focusY: 0,
      scale: 1,
      leadRotate: 0,
      focusRotate: 0,
    },
    elapsed,
    9000,
    intensity,
    reduced,
    index,
  );
describe("lyric choreography", () => {
  it("chooses layouts from content and reading time, keeping repeated text recognizable", () => {
    const cue = {
      startMs: 0,
      endMs: 8000,
      text: "Let the room become a river",
    };
    expect(choreography(cue, 0, "Flow")).toEqual(choreography(cue, 12, "Flow"));
    expect(
      choreography({ startMs: 0, text: "Only light" }, 0, "Flow").treatment,
    ).toBe("monument");
    expect(choreography({ ...cue, endMs: 1200 }, 0, "Flow")).toMatchObject({
      treatment: "horizon",
      steady: true,
    });
    expect(splitPhrase("Hold the light, let it find us")).toEqual([
      "Hold the light,",
      "let it find us",
    ]);
  });
  it("groups phrases without changing or timing words", () => {
    for (const text of [
      "Let the room become a river",
      "In the green beyond the glass",
      "Only light",
      "水の中で breathe a little",
    ])
      expect(splitPhrase(text).filter(Boolean).join(" ")).toBe(text);
    const cue = {
      startMs: 0,
      text: "Only time",
      words: [
        { startMs: 0, text: "Only" },
        { startMs: 750, text: "time" },
      ],
    };
    expect(choreography(cue, 1, "Pulse").phrases).toEqual(["", "Only time"]);
    expect(cue.words[1].startMs).toBe(750);
  });
  it("recomputes arrival and growth identically after seeks and pauses", () => {
    const settled = frame(4500);
    frame(100);
    frame(8000);
    expect(frame(4500)).toEqual(settled);
    expect(frame(0).scale).toBeLessThan(frame(4500).scale);
    expect(frame(-1000)).toEqual(frame(0));
    expect(frame(20000)).toEqual(frame(9000));
  });
  it("limits intensity and removes transforms for reduced motion", () => {
    expect(Math.abs(frame(3000, "Whisper").focusY)).toBeLessThan(
      Math.abs(frame(3000, "Pulse").focusY),
    );
    expect(frame(0, "Pulse", true)).toEqual(frame(8000, "Pulse", true));
    expect(frame(3000, "Pulse", true).scale).toBe(1);
  });
  it("keeps phrase motion restrained while preserving opposite cue tilts", () => {
    const left = frame(4000, "Flow", false, 0);
    const right = frame(4000, "Flow", false, 1);
    expect(left.focusRotate).toBeLessThan(0);
    expect(right.focusRotate).toBeGreaterThan(0);
    expect(Math.abs(left.focusRotate)).toBeLessThan(3);
    expect(left.focusX * right.focusX).toBeLessThan(0);
    const arrived = frame(400, "Pulse", false, 3);
    frame(7000, "Pulse", false, 4);
    expect(frame(400, "Pulse", false, 3)).toEqual(arrived);
    expect(frame(0, "Pulse", true, 3).focusRotate).toBe(0);
  });
  it("shrinks long text and flags exceptionally dense lines", () => {
    expect(
      choreography({ startMs: 0, text: "A brief line" }, 0, "Flow").typeScale,
    ).toBeGreaterThan(
      choreography(
        {
          startMs: 0,
          text: "A significantly longer lyric phrase with many words stretching across the entire canvas",
        },
        0,
        "Flow",
      ).typeScale,
    );
    expect(
      choreography({ startMs: 0, text: "x".repeat(120) }, 0, "Flow").dense,
    ).toBe(true);
  });
  it("reuses frame storage in the animation callback", () => {
    const target: ChoreographyFrame = {
      leadX: 0,
      leadY: 0,
      focusX: 0,
      focusY: 0,
      scale: 1,
      leadRotate: 0,
      focusRotate: 0,
    };
    expect(writeChoreographyFrame(target, 1000, 9000, "Flow")).toBe(target);
  });
});
