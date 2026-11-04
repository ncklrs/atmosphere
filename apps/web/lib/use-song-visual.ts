"use client";
import { useEffect, useState } from "react";
import type { Playback } from "../../../packages/playback-core/index";
import {
  advanceVisual,
  parseVisualRotation,
  visualTrackIdentity,
  type VisualRotation,
} from "../../../packages/design-system/visual-rotation";
import type { Settings } from "./settings";
export const rotationStorageKey = "atmosphere.visual-rotation.v1";
export function useSongVisual(
  playback: Playback,
  settings: Settings,
  ready: boolean,
) {
  const [rotation, setRotation] = useState<VisualRotation | null>(null);
  const [loaded, setLoaded] = useState(false);
  const track = visualTrackIdentity(playback);
  useEffect(() => {
    try {
      setRotation(
        parseVisualRotation(
          JSON.parse(localStorage.getItem(rotationStorageKey) ?? "null"),
        ),
      );
    } catch {
      /* Optional local persistence. */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!ready || !loaded) return;
    setRotation((previous) =>
      advanceVisual(
        previous,
        track,
        settings.ambientVisual,
        settings.autoVisuals,
      ),
    );
  }, [ready, loaded, track, settings.ambientVisual, settings.autoVisuals]);
  useEffect(() => {
    if (!loaded || !rotation) return;
    try {
      localStorage.setItem(rotationStorageKey, JSON.stringify(rotation));
    } catch {
      /* Session rotation still works. */
    }
  }, [loaded, rotation]);
  return settings.autoVisuals
    ? (rotation?.visual ?? settings.ambientVisual)
    : settings.ambientVisual;
}
