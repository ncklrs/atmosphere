import type { Cue, Playback, LyricResult } from "../playback-core/index";
export function parseLrc(input: string): Cue[] {
  const offset = Number(input.match(/\[offset:([+-]?\d+)\]/i)?.[1] ?? 0);
  const cues: Cue[] = [];
  for (const line of input.split(/\r?\n/)) {
    const timestamps = [
      ...line.matchAll(/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g),
    ];
    const text = line
      .replace(/\[[^\]]*\]/g, "")
      .replace(/<\d+:\d{2}(?:[.:]\d{1,3})?>/g, "")
      .trim();
    const wordTags = [
      ...line.matchAll(/<(\d+):(\d{2})(?:[.:](\d{1,3}))?>([^<]*)/g),
    ];
    for (const m of timestamps) {
      if (Number(m[2]) >= 60) continue;
      const fraction = Number((m[3] ?? "").padEnd(3, "0"));
      const startMs = Math.max(
        0,
        Number(m[1]) * 60000 + Number(m[2]) * 1000 + fraction - offset,
      );
      const words =
        timestamps.length === 1
          ? wordTags
              .filter((w) => Number(w[2]) < 60 && w[4].trim())
              .map((w) => ({
                startMs: Math.max(
                  0,
                  Number(w[1]) * 60000 +
                    Number(w[2]) * 1000 +
                    Number((w[3] ?? "").padEnd(3, "0")) -
                    offset,
                ),
                text: w[4].trim(),
              }))
          : [];
      const validWords =
        words.length > 0 &&
        words.every(
          (word, i) => word.startMs >= (words[i - 1]?.startMs ?? startMs),
        );
      cues.push(validWords ? { startMs, text, words } : { startMs, text });
    }
  }
  return cues
    .sort((a, b) => a.startMs - b.startMs)
    .map((cue, i, all) => ({ ...cue, endMs: all[i + 1]?.startMs }));
}
const canonical = (s: string) =>
  s
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export interface Candidate {
  trackName: string;
  artistName: string;
  albumName?: string;
  duration: number;
  syncedLyrics?: string | null;
  instrumental?: boolean;
}
export function matches(track: Playback, c: Candidate): boolean {
  if (
    !c ||
    typeof c.trackName !== "string" ||
    typeof c.artistName !== "string" ||
    (c.albumName !== undefined && typeof c.albumName !== "string")
  )
    return false;
  return (
    canonical(track.title) === canonical(c.trackName) &&
    canonical(track.artist) === canonical(c.artistName) &&
    track.durationMs > 0 &&
    Number.isFinite(c.duration) &&
    Math.abs(track.durationMs / 1000 - c.duration) <= 3 &&
    (!track.album ||
      !c.albumName ||
      canonical(track.album) === canonical(c.albumName))
  );
}
export interface LyricProvider {
  name: string;
  resolve(track: Playback): Promise<LyricResult | null>;
}
export class LrclibProvider implements LyricProvider {
  name = "LRCLIB";
  constructor(private fetcher: typeof fetch = fetch) {}
  async resolve(track: Playback): Promise<LyricResult | null> {
    if (!track.title || !track.artist || !track.durationMs) return null;
    const query = new URLSearchParams({
      track_name: track.title,
      artist_name: track.artist,
      album_name: track.album,
      duration: String(Math.round(track.durationMs / 1000)),
    });
    const response = await this.fetcher(`https://lrclib.net/api/get?${query}`, {
      signal: AbortSignal.timeout(3000),
      headers: { "User-Agent": "Atmosphere/0.1 (local household prototype)" },
    });
    if (!response.ok) return null;
    const c = (await response.json()) as Candidate;
    if (
      !matches(track, c) ||
      typeof c.syncedLyrics !== "string" ||
      !c.syncedLyrics ||
      c.syncedLyrics.length > 524288
    )
      return null;
    const cues = parseLrc(c.syncedLyrics);
    return cues.length
      ? {
          trackKey: track.trackKey,
          cues,
          provider: this.name,
          attribution: "Lyrics via LRCLIB · lrclib.net",
          timing: cues.some((cue) => cue.words?.length) ? "word" : "line",
        }
      : null;
  }
}
export class LyricResolver {
  private cache = new Map<
    string,
    { expires: number; result: LyricResult | null }
  >();
  private pending = new Map<string, Promise<LyricResult | null>>();
  constructor(
    private provider: LyricProvider,
    private now = Date.now,
  ) {}
  async resolve(track: Playback): Promise<LyricResult | null> {
    const key = track.trackKey;
    const cached = this.cache.get(key);
    if (cached && cached.expires > this.now()) return cached.result;
    const existing = this.pending.get(key);
    if (existing) return existing;
    const request = this.provider
      .resolve(track)
      .catch(() => null)
      .then((result) => {
        if (this.cache.size >= 100)
          this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(key, {
          result,
          expires: this.now() + (result ? 3600000 : 60000),
        });
        this.pending.delete(key);
        return result;
      });
    this.pending.set(key, request);
    return request;
  }
}
