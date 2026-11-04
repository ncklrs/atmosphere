export type PlaybackState = "playing" | "paused" | "stopped" | "unknown";
export interface Playback {
  sourceId: string;
  trackKey: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string | null;
  durationMs: number;
  positionMs: number;
  sampledAtMonotonicMs: number;
  state: PlaybackState;
  confidence: number;
  revision: number;
}
export interface Cue {
  startMs: number;
  endMs?: number;
  text: string;
  words?: { startMs: number; text: string }[];
}
export interface LyricResult {
  trackKey: string;
  cues: Cue[];
  provider: string;
  attribution: string;
  timing: "line" | "word" | "none";
}
export interface Snapshot {
  type: "snapshot";
  sessionId?: string;
  playback: Playback;
  lyrics: LyricResult | null;
  connected: boolean;
  sentAt: number;
}
export const STALE_MS = 6000;
export function parseSnapshot(value: unknown): Snapshot | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Snapshot,
    p = s.playback;
  if (
    s.type !== "snapshot" ||
    typeof s.connected !== "boolean" ||
    (s.sessionId !== undefined &&
      (typeof s.sessionId !== "string" || s.sessionId.length > 128)) ||
    !Number.isFinite(s.sentAt) ||
    !p
  )
    return null;
  if (
    !["sourceId", "trackKey", "title", "artist", "album"].every(
      (key) =>
        typeof p[key as keyof Playback] === "string" &&
        String(p[key as keyof Playback]).length <= 4096,
    )
  )
    return null;
  if (
    !["playing", "paused", "stopped", "unknown"].includes(p.state) ||
    !Number.isInteger(p.revision) ||
    p.revision < 0 ||
    !Number.isFinite(p.positionMs) ||
    p.positionMs < 0 ||
    !Number.isFinite(p.durationMs) ||
    p.durationMs < 0 ||
    !Number.isFinite(p.confidence)
  )
    return null;
  if (s.lyrics !== null) {
    const l = s.lyrics;
    if (
      !l ||
      l.trackKey !== p.trackKey ||
      typeof l.provider !== "string" ||
      typeof l.attribution !== "string" ||
      !["line", "word", "none"].includes(l.timing) ||
      !Array.isArray(l.cues) ||
      l.cues.length > 10000
    )
      return null;
    let last = -1;
    for (const cue of l.cues) {
      if (
        !cue ||
        !Number.isFinite(cue.startMs) ||
        cue.startMs < last ||
        typeof cue.text !== "string" ||
        cue.text.length > 8192 ||
        (cue.endMs !== undefined &&
          (!Number.isFinite(cue.endMs) || cue.endMs < cue.startMs))
      )
        return null;
      last = cue.startMs;
      if (cue.words !== undefined) {
        if (!Array.isArray(cue.words) || cue.words.length > 1000) return null;
        let previous = cue.startMs;
        for (const word of cue.words) {
          if (
            !word ||
            typeof word.text !== "string" ||
            !Number.isFinite(word.startMs) ||
            word.startMs < previous
          )
            return null;
          previous = word.startMs;
        }
      }
    }
  }
  return s;
}
export function positionAt(p: Playback, now: number): number {
  const elapsed =
    p.state === "playing"
      ? Math.max(0, Math.min(STALE_MS, now - p.sampledAtMonotonicMs))
      : 0;
  return Math.max(
    0,
    Math.min(p.durationMs || Infinity, p.positionMs + elapsed),
  );
}
export function reconcile(
  previous: Playback | null,
  sample: Playback,
): Playback {
  if (
    !previous ||
    sample.trackKey !== previous.trackKey ||
    sample.state !== previous.state
  )
    return sample;
  const predicted = positionAt(previous, sample.sampledAtMonotonicMs);
  const drift = sample.positionMs - predicted;
  if (sample.state !== "playing" || Math.abs(drift) > 750) return sample;
  return { ...sample, positionMs: predicted + drift * 0.35 };
}
export function receiveSnapshot(
  p: Playback,
  previousRevision: number,
  now: number,
): Playback | null {
  if (
    p.revision < previousRevision ||
    !Number.isFinite(p.positionMs) ||
    !Number.isFinite(p.durationMs)
  )
    return null;
  return { ...p, sampledAtMonotonicMs: now };
}
export function emptyPlayback(now = 0): Playback {
  return {
    sourceId: "wiim",
    trackKey: "",
    title: "",
    artist: "",
    album: "",
    artworkUrl: null,
    durationMs: 0,
    positionMs: 0,
    sampledAtMonotonicMs: now,
    state: "unknown",
    confidence: 0,
    revision: 0,
  };
}
