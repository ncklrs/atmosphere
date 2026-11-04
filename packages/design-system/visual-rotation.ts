import type { Playback } from "../playback-core/index";
import { ambientVisuals, isAmbientVisual, type AmbientVisual } from "./visuals";
export interface VisualRotation {
  track: string;
  visual: AmbientVisual;
}
export function visualTrackIdentity(playback: Playback): string {
  if (!playback.title.trim() || !playback.artist.trim()) return "";
  return JSON.stringify([
    playback.sourceId,
    playback.title.trim().toLowerCase(),
    playback.artist.trim().toLowerCase(),
  ]);
}
export function parseVisualRotation(value: unknown): VisualRotation | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Partial<VisualRotation>;
  return typeof state.track === "string" &&
    state.track.length > 0 &&
    state.track.length <= 20000 &&
    isAmbientVisual(state.visual)
    ? { track: state.track, visual: state.visual }
    : null;
}
export function advanceVisual(
  previous: VisualRotation | null,
  track: string,
  manual: AmbientVisual,
  enabled: boolean,
  favorites: readonly AmbientVisual[] = [],
): VisualRotation | null {
  if (!track) return previous;
  const collection = favorites.length
    ? ambientVisuals.filter((v) => favorites.includes(v))
    : ambientVisuals;
  const visual =
    !enabled || !previous
      ? manual
      : previous.track === track
        ? previous.visual
        : collection[
            (collection.indexOf(previous.visual) + 1) % collection.length
          ];
  return previous?.track === track && previous.visual === visual
    ? previous
    : { track, visual };
}
