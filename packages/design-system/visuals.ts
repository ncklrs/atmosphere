export const visualPresets = {
  Bloom: {
    mode: 0,
    description:
      "Layered aurora curtains, luminous ribbons, and drifting light.",
    fallback: "Bloom",
  },
  Tide: {
    mode: 1,
    description:
      "Liquid contours with glinting caustics and slow tidal currents.",
    fallback: "Tide",
  },
  Orbit: {
    mode: 2,
    description:
      "A galactic vortex with spiraling dust and a luminous accretion ring.",
    fallback: "Orbit",
  },
  Nova: {
    mode: 3,
    description:
      "A living stellar corona with flowing plasma and radiant filaments.",
    fallback: "Orbit",
  },
  Prism: {
    mode: 4,
    description:
      "Faceted glass, spectral light sheets, and shifting crystalline reflections.",
    fallback: "Tide",
  },
  Voyage: {
    mode: 5,
    description:
      "Travel through layered stars and clouds of interstellar color.",
    fallback: "Bloom",
  },
} as const;
export type AmbientVisual = keyof typeof visualPresets;
export const ambientVisuals = Object.keys(visualPresets) as AmbientVisual[];
export function isAmbientVisual(value: unknown): value is AmbientVisual {
  return typeof value === "string" && Object.hasOwn(visualPresets, value);
}
