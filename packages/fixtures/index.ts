import type { Playback, LyricResult } from "../playback-core/index";
export const tracks = [
  {
    title: "The space between",
    artist: "Soft Signal",
    album: "Rooms of light",
    durationMs: 96000,
    palette: 0,
    lines: [
      "Let the room become a river",
      "Let the evening settle in",
      "There is light along the edges",
      "Of the space we’re living in",
      "Every sound becomes a color",
      "Every shadow learns to swim",
      "Leave the windows open wider",
      "Let the quiet pull us in",
    ],
  },
  {
    title: "After the sun",
    artist: "Dayform",
    album: "A warmer horizon",
    durationMs: 96000,
    palette: 1,
    lines: [
      "Copper skies above the rooftops",
      "Slowly turning into blue",
      "All the day’s unfinished stories",
      "Find a place beside you",
      "We are only passing weather",
      "We are only borrowed light",
      "Let the city breathe a little",
      "Let the gold become the night",
    ],
  },
  {
    title: "Still water",
    artist: "Field Study",
    album: "Collected silences",
    durationMs: 96000,
    palette: 2,
    lines: [
      "In the hush beneath the branches",
      "In the green beyond the glass",
      "There’s a world that moves in circles",
      "There’s a moment we can hold",
      "Let the water keep its secrets",
      "Let the current take its time",
      "Every ripple finds the shoreline",
      "Every silence has a shape",
    ],
  },
];
export function demoPlayback(
  index: number,
  now: number,
  revision = 1,
): Playback {
  const t = tracks[index % tracks.length];
  return {
    sourceId: "demo",
    trackKey: `demo:${index % tracks.length}`,
    title: t.title,
    artist: t.artist,
    album: t.album,
    artworkUrl: null,
    durationMs: t.durationMs,
    positionMs: 6500,
    sampledAtMonotonicMs: now,
    state: "playing",
    confidence: 1,
    revision,
  };
}
export function demoLyrics(index: number): LyricResult {
  return {
    trackKey: `demo:${index % tracks.length}`,
    cues: tracks[index % tracks.length].lines.map((text, i) => ({
      startMs: 3000 + i * 11000,
      endMs: 12000 + i * 11000,
      text,
    })),
    provider: "Original demo",
    attribution: "Original synthetic lyrics · Atmosphere",
    timing: "line",
  };
}
