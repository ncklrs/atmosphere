import {
  defaultCircadian,
  validTime,
  type CircadianConfig,
  type SceneOverride,
} from "../../../packages/circadian/index";
import type { Intensity } from "../../../packages/motion-engine/index";
import type { AmbientVisual } from "../components/ambient-visuals";
export interface Settings {
  source: "demo" | "gateway";
  intensity: Intensity;
  ambientVisual: AmbientVisual;
  composition: string;
  calibrationMs: number;
  lyrics: boolean;
  contrast: boolean;
  circadian: CircadianConfig;
  override: SceneOverride | null;
}
export const defaults: Settings = {
  source: "demo",
  intensity: "Flow",
  ambientVisual: "Bloom",
  composition: "Auto",
  calibrationMs: 0,
  lyrics: true,
  contrast: false,
  circadian: defaultCircadian,
  override: null,
};
export const storageKey = "atmosphere.settings.v1";
export function validateSettings(input: unknown): Settings {
  if (!input || typeof input !== "object") return defaults;
  const s = input as Partial<Settings>;
  const c = { ...defaultCircadian, ...(s.circadian ?? {}) };
  try {
    new Intl.DateTimeFormat("en", { timeZone: c.timezone }).format();
  } catch {
    c.timezone = defaultCircadian.timezone;
  }
  if (!validTime(c.sleep)) c.sleep = defaultCircadian.sleep;
  if (!validTime(c.wake)) c.wake = defaultCircadian.wake;
  if (
    typeof c.latitude !== "number" ||
    !Number.isFinite(c.latitude) ||
    Math.abs(c.latitude) > 90
  )
    c.latitude = null;
  if (
    typeof c.longitude !== "number" ||
    !Number.isFinite(c.longitude) ||
    Math.abs(c.longitude) > 180
  )
    c.longitude = null;
  for (const key of [
    "sunriseOffsetMin",
    "duskOffsetMin",
    "nightOffsetMin",
  ] as const)
    if (!Number.isFinite(c[key]) || Math.abs(c[key]) > 180)
      c[key] = defaultCircadian[key];
  c.transitionMin = Number.isFinite(c.transitionMin)
    ? Math.min(30, Math.max(15, c.transitionMin))
    : 20;
  c.musicWake = c.musicWake !== false;
  const override =
    s.override &&
    ["AMBIENT_DAY", "AMBIENT_DUSK", "AMBIENT_NIGHT", "SLEEP"].includes(
      s.override.scene,
    ) &&
    Number.isFinite(s.override.expiresAt)
      ? s.override
      : null;
  return {
    source: s.source === "gateway" ? "gateway" : "demo",
    intensity: ["Whisper", "Flow", "Pulse"].includes(s.intensity ?? "")
      ? s.intensity!
      : "Flow",
    ambientVisual: ["Bloom", "Tide", "Orbit"].includes(s.ambientVisual ?? "")
      ? s.ambientVisual!
      : "Bloom",
    composition: ["Cinema", "Canvas", "Portrait", "Companion"].includes(
      s.composition ?? "",
    )
      ? s.composition!
      : "Auto",
    calibrationMs: Number.isFinite(s.calibrationMs)
      ? Math.max(-5000, Math.min(5000, s.calibrationMs!))
      : 0,
    lyrics: s.lyrics !== false,
    contrast: s.contrast === true,
    circadian: c,
    override,
  };
}
