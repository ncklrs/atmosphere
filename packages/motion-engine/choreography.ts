import type { Cue } from "../playback-core/index";
import type { Intensity } from "./index";

export type Treatment = "cascade" | "split" | "monument" | "margin" | "horizon";
export function phraseSignature(text: string): number {
  let hash = 2166136261;
  const normalized = text
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  for (const char of normalized)
    hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619);
  return hash >>> 0;
}

export function splitPhrase(text: string): [string, string] {
  const words = text.trim().split(/\s+/u);
  if (words.length < 4) return ["", text.trim()];
  let split = Math.ceil(words.length * 0.45);
  const punctuation = words
    .map((word, i) =>
      /[,:;.!?—–]$/u.test(word) && i >= 1 && i < words.length - 2 ? i + 1 : -1,
    )
    .filter(
      (i) => i > 0 && i >= words.length * 0.25 && i <= words.length * 0.75,
    );
  if (punctuation.length) {
    split = punctuation.reduce((best, i) =>
      Math.abs(i - words.length / 2) < Math.abs(best - words.length / 2)
        ? i
        : best,
    );
    return [words.slice(0, split).join(" "), words.slice(split).join(" ")];
  }
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

export function choreography(cue: Cue, _index: number, intensity: Intensity) {
  void _index;
  const signature = phraseSignature(cue.text);
  const duration = Math.max(
    400,
    (cue.endMs ?? cue.startMs + 8000) - cue.startMs,
  );
  const words = cue.text.trim().split(/\s+/u).length;
  const steady = words / (duration / 1000) > 3.2 || cue.text.length > 100;
  const treatments: Treatment[] = ["cascade", "split", "margin", "horizon"];
  const treatment: Treatment =
    words < 4
      ? "monument"
      : steady
        ? "horizon"
        : treatments[signature % treatments.length];
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
    treatment,
    signature,
    steady,
    phrases,
    typeScale:
      lengthScale *
      (intensity === "Pulse" ? 1.13 : intensity === "Whisper" ? 0.86 : 1),
    dense: steady || longestWord > 20,
  };
}

export interface ChoreographyFrame {
  leadX: number;
  leadY: number;
  focusX: number;
  focusY: number;
  scale: number;
  leadRotate: number;
  focusRotate: number;
}
export function writeChoreographyFrame(
  target: ChoreographyFrame,
  elapsedMs: number,
  durationMs: number,
  intensity: Intensity,
  reduced = false,
  index = 0,
) {
  if (reduced) {
    target.leadX = target.leadY = target.focusX = target.focusY = 0;
    target.scale = 1;
    target.leadRotate = target.focusRotate = 0;
    return target;
  }
  const amount = reduced
    ? 0
    : intensity === "Whisper"
      ? 0.18
      : intensity === "Pulse"
        ? 1
        : 0.65;
  const direction = ((index % 6) + 6) % 6;
  const side = direction % 2 === 0 ? -1 : 1;
  const enter = Math.max(0, Math.min(1, elapsedMs / 1100));
  const arrival = (1 - enter) ** 3;
  const hold = Math.max(
    0,
    Math.min(1, (elapsedMs - 1100) / Math.max(1000, durationMs - 1100)),
  );
  target.leadX = amount * 6 * hold;
  target.leadY = amount * -4 * hold;
  target.focusX = amount * -side * 8 * hold;
  target.focusY = amount * -14 * hold;
  target.leadRotate = amount * -side * 1.5;
  target.focusRotate = amount * side * (3 - hold);
  target.scale = 1 + amount * (-0.02 * arrival + 0.01 * hold);
  return target;
}
