import type { Cue } from "../playback-core/index";
import type { Intensity } from "./index";

export type Treatment = "cascade" | "split" | "monument" | "margin" | "horizon";
const sequence: Treatment[] = [
  "cascade",
  "split",
  "monument",
  "margin",
  "horizon",
  "split",
  "margin",
  "monument",
];

export function splitPhrase(text: string): [string, string] {
  const words = text.trim().split(/\s+/u);
  if (words.length < 4) return ["", text.trim()];
  let split = Math.ceil(words.length * 0.45);
  for (let i = 2; i < words.length - 1; i++) {
    if (
      /^(become|becomes|along|into|beneath|beyond|above|beside|through|around|open|pull|take|finds|learns)$/i.test(
        words[i],
      ) &&
      Math.abs(i - words.length / 2) <= 2
    ) {
      split = i;
      break;
    }
  }
  return [words.slice(0, split).join(" "), words.slice(split).join(" ")];
}

export function choreography(cue: Cue, index: number, intensity: Intensity) {
  const phrases = cue.words?.length ? ["", cue.text] : splitPhrase(cue.text);
  const longestWord = Math.max(
    ...cue.text.split(/\s+/u).map((word) => [...word].length),
  );
  const density = Math.max(phrases[1].length, longestWord * 2.3);
  const lengthScale = Math.min(
    1.15,
    Math.max(0.48, Math.sqrt(22 / Math.max(12, density))),
  );
  return {
    treatment:
      sequence[((index % sequence.length) + sequence.length) % sequence.length],
    phrases,
    typeScale:
      lengthScale *
      (intensity === "Pulse" ? 1.13 : intensity === "Whisper" ? 0.86 : 1),
    dense: cue.text.length > 100 || longestWord > 20,
  };
}

export interface ChoreographyFrame {
  leadX: number;
  leadY: number;
  focusX: number;
  focusY: number;
  scale: number;
}
export function writeChoreographyFrame(
  target: ChoreographyFrame,
  elapsedMs: number,
  durationMs: number,
  intensity: Intensity,
  reduced = false,
) {
  if (reduced) {
    target.leadX = target.leadY = target.focusX = target.focusY = 0;
    target.scale = 1;
    return target;
  }
  const amount = reduced
    ? 0
    : intensity === "Whisper"
      ? 0.18
      : intensity === "Pulse"
        ? 1
        : 0.65;
  const enter = Math.max(0, Math.min(1, elapsedMs / 650));
  const arrival = (1 - enter) ** 3;
  const hold = Math.max(
    0,
    Math.min(1, (elapsedMs - 650) / Math.max(1000, durationMs - 650)),
  );
  target.leadX = amount * (-26 * arrival + 6 * hold);
  target.leadY = amount * (18 * arrival - 4 * hold);
  target.focusX = amount * (32 * arrival - 8 * hold);
  target.focusY = amount * (46 * arrival - 14 * hold);
  target.scale = 1 + amount * (-0.16 * arrival + 0.035 * hold);
  return target;
}
