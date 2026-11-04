import type { MilkdropPreset } from "../../../../packages/design-system/milkdrop";
// Literal imports keep only this curated set in the build, split by preset.
const loaders = {
  "cosmic-dust": () =>
    import(
      "butterchurn-presets/presets/converted/Geiss - Cosmic Dust 2 - Trails 5b.json"
    ),
  "smoke-rings": () =>
    import("butterchurn-presets/presets/converted/Geiss - Smoke Rings.json"),
  nebula: () =>
    import(
      "butterchurn-presets/presets/converted/TonyMilkdrop - Magellan's Nebula [Flexi - fancy + $this shall not retain].json"
    ),
  "jelly-space": () =>
    import(
      "butterchurn-presets/presets/converted/Flexi + stahlregen - jelly space.json"
    ),
  "gold-diffusion": () =>
    import(
      "butterchurn-presets/presets/converted/Geiss - Diffuser (Gold Mix).json"
    ),
  tendrils: () =>
    import(
      "butterchurn-presets/presets/converted/Geiss - Cauldron - Tendrils (saturation remix).json"
    ),
  "spiral-artifact": () =>
    import(
      "butterchurn-presets/presets/converted/Geiss - Spiral Artifact.json"
    ),
  "reaction-diffusion": () =>
    import(
      "butterchurn-presets/presets/converted/Geiss - Reaction Diffusion 2.json"
    ),
  hyperspace: () =>
    import(
      "butterchurn-presets/presets/converted/flexi - hyperspaceflight (bn cn Jelly 4).json"
    ),
  kaleidoscope: () =>
    import(
      "butterchurn-presets/presets/converted/Rovastar + Geiss - Hyperkaleidoscope Glow 2 motion blur (Jelly).json"
    ),
  sherwin: () =>
    import(
      "butterchurn-presets/presets/converted/Flexi, martin + geiss - dedicated to the sherwin maxawow.json"
    ),
  "spiral-ornament": () =>
    import(
      "butterchurn-presets/presets/converted/Stahlregen - Old school, baby (Spiral Ornament)_1.json"
    ),
} satisfies Record<MilkdropPreset, () => Promise<{ default: object }>>;
export async function loadMilkdropPreset(id: MilkdropPreset): Promise<object> {
  const loaded = await loaders[id]();
  // Butterchurn fills defaults and mutates nested shapes; retain pristine imports.
  const preset: { baseVals: Record<string, number> } = structuredClone(
    loaded.default,
  );
  // Ambient input has no musical loudness envelope. Disable the stock volume
  // gate so wave-based presets do not disappear after their initial transient.
  preset.baseVals.modwavealphabyvolume = 0;
  return preset;
}
