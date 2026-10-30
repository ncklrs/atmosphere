import { describe, expect, it } from "vitest";
import { demoPlayback } from "../packages/fixtures/index";
import {
  positionAt,
  parseSnapshot,
  receiveSnapshot,
  reconcile,
} from "../packages/playback-core/index";
import { composition, timeline } from "../packages/motion-engine/index";
describe("playback clock", () => {
  it("rejects malformed and out-of-order wire lyrics before rendering", () => {
    const snapshot = {
      type: "snapshot",
      playback: demoPlayback(0, 0),
      lyrics: null,
      connected: true,
      sentAt: 0,
    };
    expect(parseSnapshot(snapshot)).not.toBeNull();
    expect(
      parseSnapshot({
        ...snapshot,
        playback: { ...snapshot.playback, title: { bad: true } },
      }),
    ).toBeNull();
    expect(
      parseSnapshot({
        ...snapshot,
        lyrics: {
          trackKey: "demo:0",
          provider: "test",
          attribution: "test",
          timing: "line",
          cues: [
            { startMs: 2000, text: "second" },
            { startMs: 1000, text: "first" },
          ],
        },
      }),
    ).toBeNull();
  });
  it("interpolates only playing and caps stale observations", () => {
    const p = demoPlayback(0, 1000);
    expect(positionAt(p, 2000)).toBe(7500);
    expect(positionAt(p, 30000)).toBe(12500);
    expect(positionAt({ ...p, state: "paused" }, 2000)).toBe(6500);
    expect(positionAt({ ...p, positionMs: 95000 }, 4000)).toBe(96000);
  });
  it("smooths drift but immediately snaps seeks, tracks, pauses and resumes", () => {
    const p = demoPlayback(0, 1000);
    const sample = { ...p, positionMs: 7700, sampledAtMonotonicMs: 2000 };
    expect(reconcile(p, sample).positionMs).toBe(7570);
    expect(reconcile(p, { ...sample, positionMs: 40000 }).positionMs).toBe(
      40000,
    );
    expect(reconcile(p, { ...sample, state: "paused" }).positionMs).toBe(7700);
    expect(reconcile(p, { ...sample, trackKey: "new" }).positionMs).toBe(7700);
  });
  it("reanchors to the browser clock and rejects old messages", () => {
    const p = demoPlayback(0, 0, 5);
    expect(receiveSnapshot(p, 4, 500)?.sampledAtMonotonicMs).toBe(500);
    expect(receiveSnapshot(p, 6, 500)).toBeNull();
  });
});
describe("pure lyric timeline", () => {
  const cues = [
    { startMs: 1000, endMs: 3000, text: "One" },
    {
      startMs: 5000,
      endMs: 8000,
      text: "Two",
      words: [{ startMs: 5000, text: "Two" }],
    },
  ];
  it("recomputes on forward and backward seek and respects instrumental gaps", () => {
    expect(timeline(cues, 0).index).toBe(-1);
    expect(timeline(cues, 5500)).toMatchObject({ index: 1, word: 0 });
    expect(timeline(cues, 2000)).toMatchObject({ index: 0, word: -1 });
    expect(timeline(cues, 4000).index).toBe(-1);
    expect(timeline(cues, 9000).index).toBe(-1);
  });
  it("selects the requested compositions from aspect and size", () => {
    expect(composition(1920, 1080)).toBe("Cinema");
    expect(composition(1920, 1200)).toBe("Cinema");
    expect(composition(1080, 1920)).toBe("Portrait");
    expect(composition(1024, 1024)).toBe("Canvas");
    expect(composition(800, 360)).toBe("Companion");
  });
});
