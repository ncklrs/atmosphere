import { describe, expect, it } from "vitest";
import { artworkPalette } from "../packages/design-system/artwork-palette";
describe("artwork colors", () => {
  it("extracts the dominant color and creates a readable accent and dark shade", () => {
    const red = artworkPalette(
      new Uint8ClampedArray([
        220, 30, 40, 255, 220, 30, 40, 255, 20, 20, 200, 255,
      ]),
    );
    expect(red?.[1]).toBe("#dc1e28");
    expect(red?.[0]).not.toBe(red?.[1]);
    expect(red?.[2]).toBe("#280507");
    expect(artworkPalette([20, 60, 230, 255])?.[1]).toBe("#143ce6");
  });
  it("ignores transparent pixels and falls back when no usable art is present", () => {
    expect(artworkPalette([240, 20, 30, 0, 0, 0, 0, 255])).toBeNull();
    expect(artworkPalette([])).toBeNull();
    expect(artworkPalette([255, 255, 255, 255])?.[0]).toBe("#ffffff");
  });
});
