import { describe, expect, it } from "vitest";
import { demoPlayback } from "../packages/fixtures/index";
import {
  advanceVisual,
  visualTrackIdentity,
  parseVisualRotation,
} from "../packages/design-system/visual-rotation";
import { ambientVisuals } from "../packages/design-system/visuals";
import { validateSettings } from "../apps/web/lib/settings";
describe("per-song visual rotation", () => {
  it("advances without repeats through the library and holds during gaps and seeks", () => {
    let state = advanceVisual(null, "a", "Prism", true)!;
    expect(state.visual).toBe("Prism");
    expect(advanceVisual(state, "a", "Orbit", true)).toBe(state);
    expect(advanceVisual(state, "", "Orbit", true)).toBe(state);
    const seen = new Set([state.visual]);
    for (let i = 0; i < ambientVisuals.length - 1; i++) {
      state = advanceVisual(state, String(i), "Orbit", true)!;
      seen.add(state.visual);
    }
    expect(seen.size).toBe(ambientVisuals.length);
    expect(advanceVisual(state, "wrap", "Orbit", true)?.visual).toBe("Prism");
    expect(advanceVisual(state, "manual", "Bloom", false)?.visual).toBe(
      "Bloom",
    );
  });
  it("rotates only through favorites when a collection is selected", () => {
    const favorites = ["Ink", "Architecture"] as const;
    const first = advanceVisual(null, "one", "Ink", true, favorites)!;
    const second = advanceVisual(first, "two", "Ink", true, favorites)!;
    expect(second.visual).toBe("Architecture");
    expect(advanceVisual(second, "three", "Ink", true, favorites)?.visual).toBe(
      "Ink",
    );
    expect(
      advanceVisual(second, "four", "Nova", false, favorites)?.visual,
    ).toBe("Nova");
  });
  it("ignores metadata enrichment and rejects invalid persisted state", () => {
    const p = demoPlayback(0, 0);
    expect(visualTrackIdentity(p)).toBe(
      visualTrackIdentity({
        ...p,
        durationMs: 96001,
        trackKey: "new",
        album: "New edition",
        positionMs: 0,
      }),
    );
    expect(visualTrackIdentity({ ...p, title: "" })).toBe("");
    expect(parseVisualRotation({ track: "a", visual: "wrong" })).toBeNull();
    expect(validateSettings({}).autoVisuals).toBe(false);
    expect(validateSettings({ autoVisuals: true }).autoVisuals).toBe(true);
  });
});
