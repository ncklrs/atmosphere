import type { Intensity } from "./index";
export const wordTreatments = [
  "rise",
  "slide",
  "unfold",
  "scatter",
  "reveal",
] as const;
export type WordTreatment = (typeof wordTreatments)[number];
export interface WordFrame {
  x: number;
  y: number;
  rotate: number;
  tilt: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  clip: number;
}
export function wordTreatment(index: number): WordTreatment {
  return wordTreatments[
    ((index % wordTreatments.length) + wordTreatments.length) %
      wordTreatments.length
  ];
}
export function writeWordFrame(
  target: WordFrame,
  elapsedMs: number,
  durationMs: number,
  ordinal: number,
  count: number,
  treatment: WordTreatment,
  intensity: Intensity,
  reduced = false,
  timed = false,
) {
  target.x = target.y = target.rotate = target.tilt = target.clip = 0;
  target.scaleX = target.scaleY = target.opacity = 1;
  if (reduced) return target;
  const duration = Math.max(1, durationMs);
  const stagger = timed
    ? 0
    : (Math.min(420, duration * 0.15) * ordinal) / Math.max(1, count - 1);
  const progress = Math.max(
    0,
    Math.min(1, (elapsedMs - stagger) / Math.min(650, duration * 0.3)),
  );
  if (progress >= 1) return target;
  const remaining = Math.pow(1 - progress, 3);
  const amount =
    intensity === "Whisper" ? 0.35 : intensity === "Pulse" ? 1.2 : 0.85;
  const side = ordinal % 2 === 0 ? -1 : 1;
  target.opacity = Math.min(1, progress * 4);
  if (treatment === "rise") {
    target.y = remaining * 48 * amount;
    target.tilt = remaining * -65 * amount;
  } else if (treatment === "slide") {
    target.x = remaining * side * 62 * amount;
    target.rotate = remaining * side * 6 * amount;
  } else if (treatment === "unfold") {
    target.scaleX = 1 - remaining * 0.8 * amount;
    target.scaleY = 1 + remaining * 0.12 * amount;
    target.y = remaining * -18 * amount;
  } else if (treatment === "scatter") {
    target.x = remaining * side * (25 + (ordinal % 3) * 14) * amount;
    target.y = remaining * ((ordinal % 3) - 1) * 42 * amount;
    target.rotate = remaining * side * (10 + (ordinal % 4) * 4) * amount;
    target.scaleX = target.scaleY = 1 - remaining * 0.35 * amount;
  } else {
    target.clip = (1 - progress) * 100;
    target.opacity = 1;
  }
  return target;
}
