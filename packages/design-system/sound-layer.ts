import type { AmbientVisual } from "./visuals";
export const soundStyles = ["Auto", "Halo", "Ribbons", "Stardust"] as const;
export type SoundStyle = (typeof soundStyles)[number];
export const soundPlacements = ["Auto", "Center", "Lower", "Right"] as const;
export type SoundPlacement = (typeof soundPlacements)[number];
export interface SoundLayerSettings {
  enabled: boolean;
  style: SoundStyle;
  placement: SoundPlacement;
  strength: number;
  size: number;
  sensitivity: number;
}
export const defaultSoundLayer: SoundLayerSettings = {
  enabled: false,
  style: "Auto",
  placement: "Auto",
  strength: 65,
  size: 55,
  sensitivity: 55,
};
const pairedStyles: Record<AmbientVisual, Exclude<SoundStyle, "Auto">> = {
  Bloom: "Ribbons",
  Tide: "Ribbons",
  Orbit: "Halo",
  Nova: "Stardust",
  Prism: "Halo",
  Voyage: "Stardust",
  Ink: "Ribbons",
  Architecture: "Halo",
  Landscape: "Ribbons",
};
export function resolveSoundStyle(style: SoundStyle, visual: AmbientVisual) {
  return style === "Auto" ? pairedStyles[visual] : style;
}
export function validateSoundLayer(value: unknown): SoundLayerSettings {
  const s =
    value && typeof value === "object"
      ? (value as Partial<SoundLayerSettings>)
      : {};
  const bound = (input: unknown, fallback: number) =>
    typeof input === "number" && Number.isFinite(input)
      ? Math.max(0, Math.min(100, input))
      : fallback;
  return {
    enabled: s.enabled === true,
    style: soundStyles.includes(s.style!) ? s.style! : "Auto",
    placement: soundPlacements.includes(s.placement!) ? s.placement! : "Auto",
    strength: bound(s.strength, defaultSoundLayer.strength),
    size: bound(s.size, defaultSoundLayer.size),
    sensitivity: bound(s.sensitivity, defaultSoundLayer.sensitivity),
  };
}
export function soundGeometry(
  width: number,
  height: number,
  settings: SoundLayerSettings,
  lyrics: boolean,
) {
  const radius = Math.min(width, height) * (0.16 + settings.size * 0.0018);
  const placement =
    settings.placement === "Auto"
      ? lyrics
        ? "Right"
        : "Center"
      : settings.placement;
  const x =
    placement === "Right"
      ? Math.min(width - radius * 1.2, width * 0.74)
      : width * 0.5;
  const y =
    placement === "Lower"
      ? Math.min(height - radius * 1.2, height * 0.7)
      : height * 0.48;
  return { x, y, radius };
}
