import { describe, expect, it } from "vitest";
import {
  defaultMilkdrop,
  milkdropIds,
  milkdropPresets,
  milkdropCollections,
  presetsInCollection,
  advanceMilkdrop,
  parseMilkdropRotation,
} from "../packages/design-system/milkdrop";
import { validateSettings } from "../apps/web/lib/settings";
import { writeAmbientDrive } from "../apps/web/lib/visuals/ambient-drive";
import { existsSync } from "node:fs";
import { join } from "node:path";
describe("Milkdrop preferences and curated scenes", () => {
  it("preserves existing visuals and migrates preferences without selecting the new engine", () => {
    const s = validateSettings({
      source: "gateway",
      ambientVisual: "Prism",
      calibrationMs: 350,
      autoVisuals: true,
    });
    expect(s).toMatchObject({
      source: "gateway",
      ambientVisual: "Prism",
      calibrationMs: 350,
      autoVisuals: true,
      visualEngine: "ambient",
      milkdrop: defaultMilkdrop,
    });
    const invalid = validateSettings({
      visualEngine: "unexpected",
      milkdrop: {
        preset: "bad",
        collection: "bad",
        brightness: -15,
        motion: 1000,
        energy: null,
        blendSeconds: Infinity,
      },
    });
    expect(invalid.visualEngine).toBe("ambient");
    expect(invalid.milkdrop).toEqual({
      ...defaultMilkdrop,
      brightness: 0,
      motion: 100,
    });
    expect(
      validateSettings({
        visualEngine: "milkdrop",
        milkdrop: { ...defaultMilkdrop, motion: 0, energy: 0, blendSeconds: 0 },
      }).milkdrop,
    ).toMatchObject({ motion: 0, energy: 0, blendSeconds: 0 });
  });
  it("ships a credited allowlist and keeps a selected preset inside its collection", () => {
    expect(milkdropIds).toHaveLength(12);
    for (const id of milkdropIds) {
      expect(
        existsSync(
          join(
            "apps/web/node_modules/butterchurn-presets/presets/converted",
            `${milkdropPresets[id].credit}.json`,
          ),
        ),
      ).toBe(true);
    }
    for (const collection of milkdropCollections) {
      const result = validateSettings({
        milkdrop: { ...defaultMilkdrop, collection },
      });
      expect(presetsInCollection(collection)).toHaveLength(4);
      expect(milkdropPresets[result.milkdrop.preset].collection).toBe(
        collection,
      );
    }
  });
  it("rotates only on a new track, stays in the selected collection, and supports pinning", () => {
    let state = advanceMilkdrop(null, "a", defaultMilkdrop, true)!;
    expect(advanceMilkdrop(state, "a", defaultMilkdrop, true)).toBe(state);
    expect(advanceMilkdrop(state, "", defaultMilkdrop, true)).toBe(state);
    const seen = new Set([state.preset]);
    for (const track of ["b", "c", "d"]) {
      state = advanceMilkdrop(state, track, defaultMilkdrop, true)!;
      seen.add(state.preset);
    }
    expect(seen.size).toBe(4);
    expect(advanceMilkdrop(state, "e", defaultMilkdrop, true)?.preset).toBe(
      defaultMilkdrop.preset,
    );
    expect(
      advanceMilkdrop(
        state,
        "d",
        { preset: "tendrils", collection: "Balanced" },
        true,
      )?.preset,
    ).toBe("tendrils");
    expect(advanceMilkdrop(state, "d", defaultMilkdrop, false)?.preset).toBe(
      defaultMilkdrop.preset,
    );
    expect(parseMilkdropRotation({ track: "a", preset: "nebula" })).toEqual({
      track: "a",
      preset: "nebula",
    });
    expect(
      parseMilkdropRotation({ track: "a", preset: "../external" }),
    ).toBeNull();
    expect(parseMilkdropRotation({ track: "", preset: "nebula" })).toBeNull();
  });
  it("generates bounded, silent animation data with no rhythmic envelope", () => {
    const left = new Uint8Array(1024),
      right = new Uint8Array(1024);
    writeAmbientDrive(left, right, 0, 0);
    expect([...left, ...right].every((x) => x === 128)).toBe(true);
    writeAmbientDrive(left, right, 0, 100);
    expect(Math.min(...left, ...right)).toBeGreaterThanOrEqual(82);
    expect(Math.max(...left, ...right)).toBeLessThanOrEqual(174);
    const first = left.slice();
    writeAmbientDrive(left, right, 10, 100);
    expect(left).not.toEqual(first);
    expect(left).not.toEqual(right);
    const again = left.slice();
    writeAmbientDrive(left, right, 10, 100);
    expect(left).toEqual(again);
  });
});
