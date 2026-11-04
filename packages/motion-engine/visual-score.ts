import type { Cue } from "../playback-core/index";
import { cueAt, type Intensity } from "./index";
export interface ScoredCue extends Cue {
  weight: number;
  direction: number;
}
export interface VisualScoreSource {
  cues: ScoredCue[];
  positionMs: number;
  playing: boolean;
  amount: number;
  intensity: Intensity;
}
export interface VisualScoreFrame {
  phase: "track" | "phrase" | "break";
  phrase: number;
  word: number;
  drive: number;
  space: number;
  x: number;
  y: number;
  chapter: number;
}
const clamp = (n: number) =>
  Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
export function prepareVisualScore(cues: Cue[]): ScoredCue[] {
  const counts = new Map<string, number>();
  const keys = cues.map((c) =>
    c.text
      .toLocaleLowerCase("en")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim(),
  );
  for (const key of keys) if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  return cues.map((cue, i) => ({
    ...cue,
    endMs: cue.endMs ?? cues[i + 1]?.startMs ?? cue.startMs + 8000,
    weight: keys[i]
      ? Math.min(
          1,
          0.32 +
            Math.min(20, keys[i].split(" ").length) * 0.018 +
            Math.min(3, (counts.get(keys[i]) ?? 1) - 1) * 0.18,
        )
      : 0,
    direction: ((i * 0.61803398875) % 1) * Math.PI * 2,
  }));
}
export function emptyVisualFrame(): VisualScoreFrame {
  return {
    phase: "track",
    phrase: 0,
    word: 0,
    drive: 0,
    space: 0,
    x: 0,
    y: 0,
    chapter: 0,
  };
}
export function writeVisualScore(
  out: VisualScoreFrame,
  source: VisualScoreSource,
  positionMs = source.positionMs,
  still = false,
): VisualScoreFrame {
  const amount = still
    ? 0
    : clamp(source.amount / 100) *
      (source.intensity === "Whisper"
        ? 0.45
        : source.intensity === "Pulse"
          ? 1
          : 0.75);
  const index = cueAt(source.cues, positionMs),
    cue = source.cues[index];
  out.phase = source.cues.length ? "break" : "track";
  out.phrase = out.word = out.drive = out.x = out.y = out.chapter = 0;
  out.space = amount * 0.35;
  if (!cue?.text.trim()) {
    let before = -1;
    if (index >= 0) before = index;
    else {
      let lo = 0,
        hi = source.cues.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        if (source.cues[mid].startMs <= positionMs) {
          before = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
    }
    const start =
      before >= 0
        ? source.cues[before].text.trim()
          ? source.cues[before].endMs!
          : source.cues[before].startMs
        : 0;
    out.space = amount * (0.35 + 0.65 * clamp((positionMs - start) / 4500));
    return out;
  }
  out.phase = "phrase";
  const age = Math.max(0, positionMs - cue.startMs) / 1000;
  const duration = Math.max(0.4, (cue.endMs! - cue.startMs) / 1000);
  const progress = clamp(age / duration);
  out.phrase =
    amount * cue.weight * (1 - Math.exp(-age * 8)) * Math.exp(-age * 0.85);
  out.drive = amount * cue.weight * Math.sin(Math.PI * progress);
  out.space = amount * 0.12;
  out.x = Math.cos(cue.direction) * 0.42;
  out.y = Math.sin(cue.direction) * 0.28;
  out.chapter = (index % 5) / 4;
  if (cue.words?.length) {
    let start = -1;
    for (const word of cue.words) {
      if (word.startMs > positionMs) break;
      start = word.startMs;
    }
    if (start >= 0) {
      const wordAge = (positionMs - start) / 1000;
      out.word =
        amount * 0.35 * (1 - Math.exp(-wordAge * 20)) * Math.exp(-wordAge * 5);
    }
  }
  return out;
}
