"use client";
import { useEffect, useState } from "react";
import type { Playback } from "../../../packages/playback-core/index";
import { visualTrackIdentity } from "../../../packages/design-system/visual-rotation";
import {
  advanceMilkdrop,
  parseMilkdropRotation,
  type MilkdropRotation,
} from "../../../packages/design-system/milkdrop";
import type { Settings } from "./settings";
export const milkdropRotationKey = "atmosphere.milkdrop-rotation.v1";
export function useSongMilkdrop(
  playback: Playback,
  settings: Settings,
  ready: boolean,
) {
  const [rotation, setRotation] = useState<MilkdropRotation | null>(null);
  const [loaded, setLoaded] = useState(false);
  const track = visualTrackIdentity(playback);
  useEffect(() => {
    try {
      setRotation(
        parseMilkdropRotation(
          JSON.parse(localStorage.getItem(milkdropRotationKey) ?? "null"),
        ),
      );
    } catch {
      /* Optional persistence. */
    }
    setLoaded(true);
  }, []);
  const { preset, collection } = settings.milkdrop;
  const enabled = settings.autoVisuals && settings.visualEngine === "milkdrop";
  useEffect(() => {
    if (!ready || !loaded) return;
    setRotation((previous) =>
      advanceMilkdrop(previous, track, { preset, collection }, enabled),
    );
  }, [ready, loaded, track, preset, collection, enabled]);
  useEffect(() => {
    if (!loaded || !rotation) return;
    try {
      localStorage.setItem(milkdropRotationKey, JSON.stringify(rotation));
    } catch {
      /* Session rotation still works. */
    }
  }, [loaded, rotation]);
  return enabled ? (rotation?.preset ?? preset) : preset;
}
