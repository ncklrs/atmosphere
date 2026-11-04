import {
  defaultCircadian,
  validTime,
  type CircadianConfig,
  type SceneOverride,
} from "../circadian/index";
import type { Intensity } from "../motion-engine/index";
import {
  isAmbientVisual,
  defaultPrism,
  type PrismControls,
  type AmbientVisual,
} from "../design-system/visuals";
import {
  defaultSoundLayer,
  validateSoundLayer,
  type SoundLayerSettings,
} from "../design-system/sound-layer";
export interface Settings {
  cleanDisplay: boolean;
  showClock: boolean;
  showProgress: boolean;
  trackInfo: "brief" | "always" | "hidden";
  brightness: number;
  favorites: AmbientVisual[];
  trackOffsets: Record<string, number>;
  hiddenLyrics: string[];
  source: "demo" | "gateway";
  intensity: Intensity;
  ambientVisual: AmbientVisual;
  autoVisuals: boolean;
  visualDynamics: number;
  soundLayer: SoundLayerSettings;
  prism: PrismControls;
  composition: string;
  calibrationMs: number;
  lyrics: boolean;
  contrast: boolean;
  circadian: CircadianConfig;
  override: SceneOverride | null;
}
export const defaults: Settings = {
  cleanDisplay: true,
  showClock: true,
  showProgress: false,
  trackInfo: "brief",
  brightness: 100,
  favorites: [],
  trackOffsets: {},
  hiddenLyrics: [],
  source: "demo",
  intensity: "Flow",
  ambientVisual: "Orbit",
  autoVisuals: false,
  visualDynamics: 75,
  soundLayer: defaultSoundLayer,
  prism: defaultPrism,
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
  const bounded = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(0, Math.min(100, value))
      : fallback;
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
    cleanDisplay: s.cleanDisplay !== false,
    showClock: s.showClock !== false,
    showProgress: s.showProgress === true,
    trackInfo:
      s.trackInfo === "always" || s.trackInfo === "hidden"
        ? s.trackInfo
        : "brief",
    brightness: bounded(s.brightness, 100),
    favorites: Array.isArray(s.favorites)
      ? [...new Set(s.favorites.filter(isAmbientVisual))].slice(0, 20)
      : [],
    hiddenLyrics: Array.isArray(s.hiddenLyrics)
      ? [
          ...new Set(
            s.hiddenLyrics.filter(
              (key): key is string =>
                typeof key === "string" && key.length <= 256,
            ),
          ),
        ].slice(-100)
      : [],
    trackOffsets:
      s.trackOffsets &&
      typeof s.trackOffsets === "object" &&
      !Array.isArray(s.trackOffsets)
        ? Object.fromEntries(
            Object.entries(s.trackOffsets)
              .filter(
                ([key, value]) =>
                  key.length <= 256 &&
                  typeof value === "number" &&
                  Number.isFinite(value),
              )
              .slice(-100)
              .map(([key, value]) => [
                key,
                Math.max(-5000, Math.min(5000, value)),
              ]),
          )
        : {},
    autoVisuals: s.autoVisuals === true,
    visualDynamics: bounded(s.visualDynamics, defaults.visualDynamics),
    soundLayer: validateSoundLayer(s.soundLayer),
    prism: {
      light: bounded(s.prism?.light, defaultPrism.light),
      motion: bounded(s.prism?.motion, defaultPrism.motion),
      facetSize: bounded(s.prism?.facetSize, defaultPrism.facetSize),
    },
    source: s.source === "gateway" ? "gateway" : "demo",
    intensity: ["Whisper", "Flow", "Pulse"].includes(s.intensity ?? "")
      ? s.intensity!
      : "Flow",
    ambientVisual: isAmbientVisual(s.ambientVisual)
      ? s.ambientVisual
      : defaults.ambientVisual,
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
