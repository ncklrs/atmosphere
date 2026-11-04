import type { VisualRotation } from "./visual-rotation";

// Titles are shortened for the room controls; credits retain the upstream names.
export const milkdropPresets = {
  "jelly-space": {
    title: "Jelly space",
    collection: "Calm",
    credit: "Flexi + stahlregen - jelly space",
    description: "Elastic fields and flowing, luminous ribbons.",
  },
  "cosmic-dust": {
    title: "Cosmic dust",
    collection: "Calm",
    credit: "Geiss - Cosmic Dust 2 - Trails 5b",
    description: "Soft trails drifting through a field of color.",
  },
  "smoke-rings": {
    title: "Smoke rings",
    collection: "Calm",
    credit: "Geiss - Smoke Rings",
    description: "Expanding rings and slowly folding smoke.",
  },
  nebula: {
    title: "Magellan nebula",
    collection: "Calm",
    credit:
      "TonyMilkdrop - Magellan's Nebula [Flexi - fancy + $this shall not retain]",
    description: "Clouds of light with a deep-space feel.",
  },
  "gold-diffusion": {
    title: "Gold diffusion",
    collection: "Balanced",
    credit: "Geiss - Diffuser (Gold Mix)",
    description: "Warm, liquid feedback with intricate diffusion.",
  },
  tendrils: {
    title: "Plasma tendrils",
    collection: "Balanced",
    credit: "Geiss - Cauldron - Tendrils (saturation remix)",
    description: "Branching currents and curling plasma.",
  },
  "spiral-artifact": {
    title: "Spiral artifact",
    collection: "Balanced",
    credit: "Geiss - Spiral Artifact",
    description: "Glowing spirals traced through a layered field of color.",
  },
  "reaction-diffusion": {
    title: "Reaction diffusion",
    collection: "Balanced",
    credit: "Geiss - Reaction Diffusion 2",
    description: "Organic, evolving cells and luminous liquid boundaries.",
  },
  hyperspace: {
    title: "Hyperspace",
    collection: "Intense",
    credit: "flexi - hyperspaceflight (bn cn Jelly 4)",
    description: "A flowing passage through layers of light.",
  },
  kaleidoscope: {
    title: "Kaleidoscope",
    collection: "Intense",
    credit: "Rovastar + Geiss - Hyperkaleidoscope Glow 2 motion blur (Jelly)",
    description: "Mirrored patterns, glowing edges, and deep feedback.",
  },
  sherwin: {
    title: "Sherwin flow",
    collection: "Intense",
    credit: "Flexi, martin + geiss - dedicated to the sherwin maxawow",
    description: "Richly layered color and continually shifting forms.",
  },
  "spiral-ornament": {
    title: "Spiral ornament",
    collection: "Intense",
    credit: "Stahlregen - Old school, baby (Spiral Ornament)_1",
    description: "Ornamental spirals woven into a living tunnel.",
  },
} as const;
export type MilkdropPreset = keyof typeof milkdropPresets;
export const milkdropCollections = ["Calm", "Balanced", "Intense"] as const;
export type MilkdropCollection = (typeof milkdropCollections)[number];
export const milkdropIds = Object.keys(milkdropPresets) as MilkdropPreset[];
export const presetsInCollection = (collection: MilkdropCollection) =>
  milkdropIds.filter((id) => milkdropPresets[id].collection === collection);
export function isMilkdropPreset(value: unknown): value is MilkdropPreset {
  return typeof value === "string" && Object.hasOwn(milkdropPresets, value);
}
export interface MilkdropSettings {
  preset: MilkdropPreset;
  collection: MilkdropCollection;
  brightness: number;
  motion: number;
  energy: number;
  blendSeconds: number;
}
export const defaultMilkdrop: MilkdropSettings = {
  preset: "jelly-space",
  collection: "Calm",
  brightness: 65,
  motion: 50,
  energy: 35,
  blendSeconds: 4,
};
export interface MilkdropRotation extends Omit<VisualRotation, "visual"> {
  preset: MilkdropPreset;
}
export function parseMilkdropRotation(value: unknown): MilkdropRotation | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Partial<MilkdropRotation>;
  return typeof state.track === "string" &&
    state.track.length > 0 &&
    state.track.length <= 20000 &&
    isMilkdropPreset(state.preset)
    ? { track: state.track, preset: state.preset }
    : null;
}
export function advanceMilkdrop(
  previous: MilkdropRotation | null,
  track: string,
  settings: Pick<MilkdropSettings, "preset" | "collection">,
  enabled: boolean,
): MilkdropRotation | null {
  if (!track) return previous;
  const pool = presetsInCollection(settings.collection);
  const preset =
    !enabled || !previous || !pool.includes(previous.preset)
      ? settings.preset
      : previous.track === track
        ? previous.preset
        : pool[(pool.indexOf(previous.preset) + 1) % pool.length];
  return previous?.track === track && previous.preset === preset
    ? previous
    : { track, preset };
}
