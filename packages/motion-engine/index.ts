import type { Cue } from "../playback-core/index";
export type Intensity = "Whisper" | "Flow" | "Pulse";
export function cueAt(cues: Cue[], positionMs: number): number {
  let low = 0,
    high = cues.length - 1,
    found = -1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (cues[mid].startMs <= positionMs) {
      found = mid;
      low = mid + 1;
    } else high = mid - 1;
  }
  if (
    found >= 0 &&
    cues[found].endMs !== undefined &&
    positionMs >= cues[found].endMs!
  )
    return -1;
  return found;
}
export function timeline(cues: Cue[], positionMs: number) {
  const index = cueAt(cues, positionMs),
    cue = cues[index];
  return {
    index,
    progress: cue
      ? Math.min(
          1,
          Math.max(
            0,
            (positionMs - cue.startMs) /
              Math.max(
                1,
                (cue.endMs ?? cues[index + 1]?.startMs ?? cue.startMs + 8000) -
                  cue.startMs,
              ),
          ),
        )
      : 0,
    word: cue?.words
      ? cue.words.reduce(
          (active, word, i) => (word.startMs <= positionMs ? i : active),
          -1,
        )
      : -1,
  };
}
export function composition(width: number, height: number) {
  const ratio = width / height;
  return height <= 520 && ratio > 1.3
    ? "Companion"
    : ratio < 0.8
      ? "Portrait"
      : ratio < 1.3
        ? "Canvas"
        : "Cinema";
}
