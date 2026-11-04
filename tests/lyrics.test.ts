import { describe, expect, it, vi } from "vitest";
import {
  LrclibProvider,
  LyricResolver,
  matches,
  parseLrc,
} from "../packages/lyrics/index";
import { demoPlayback } from "../packages/fixtures/index";
describe("LRC", () => {
  it("parses multiple stamps, offsets, tags, unicode and fractional precision", () => {
    const cues = parseLrc(
      "[ar:Test]\n[offset:-500]\n[00:02.5][00:10.123]A little lumière\n[00:04.25]水\n[00:61.00]invalid",
    );
    expect(cues.map((c) => [c.startMs, c.text])).toEqual([
      [3000, "A little lumière"],
      [4750, "水"],
      [10623, "A little lumière"],
    ]);
    expect(cues[0].endMs).toBe(4750);
  });
  it("preserves empty timestamped lines as gaps and never invents words", () => {
    const cues = parseLrc("[00:00.00]Hello\n[00:03.00]\n[00:06]Again");
    expect(cues[1].text).toBe("");
    expect(cues.every((c) => !c.words)).toBe(true);
    expect(parseLrc("No timecodes")).toEqual([]);
  });
  it("uses actual enhanced-LRC word timestamps and advances positive offsets", () => {
    expect(
      parseLrc("[offset:+250]\n[00:02.00]<00:02.00>Only <00:02.75>time")[0],
    ).toMatchObject({
      startMs: 1750,
      text: "Only time",
      words: [
        { startMs: 1750, text: "Only" },
        { startMs: 2500, text: "time" },
      ],
    });
  });
});
describe("provider safety", () => {
  const p = demoPlayback(0, 0);
  const candidate = {
    trackName: p.title,
    artistName: p.artist,
    albumName: p.album,
    duration: 96,
    syncedLyrics: "[00:01]Original fixture",
  };
  it("requires title artist and duration confidence", () => {
    expect(matches(p, candidate)).toBe(true);
    expect(matches(p, { ...candidate, artistName: "Wrong" })).toBe(false);
    expect(matches(p, { ...candidate, duration: 101 })).toBe(false);
    expect(matches(p, { ...candidate, albumName: "Wrong" })).toBe(false);
  });
  it("uses actual timestamps and rejects mismatches", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(candidate)));
    const provider = new LrclibProvider(fetcher);
    const result = await provider.resolve(p);
    expect(result?.timing).toBe("line");
    expect(result?.cues[0].startMs).toBe(1000);
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ ...candidate, trackName: "Wrong" })),
    );
    expect(await provider.resolve(p)).toBeNull();
  });
  it("deduplicates, caches and retries outages after the negative TTL", async () => {
    let now = 0;
    const resolve = vi.fn().mockRejectedValue(new Error("offline"));
    const resolver = new LyricResolver({ name: "mock", resolve }, () => now);
    expect(
      await Promise.all([resolver.resolve(p), resolver.resolve(p)]),
    ).toEqual([null, null]);
    expect(resolve).toHaveBeenCalledTimes(1);
    await resolver.resolve(p);
    expect(resolve).toHaveBeenCalledTimes(1);
    now = 3001;
    await resolver.resolve(p);
    expect(resolve).toHaveBeenCalledTimes(2);
    now = 6002;
    await resolver.resolve(p);
    expect(resolve).toHaveBeenCalledTimes(2);
    now = 9002;
    await resolver.resolve(p);
    expect(resolve).toHaveBeenCalledTimes(3);
  });
});

describe("temporary lyric lookup failures", () => {
  it("does not turn service failures into a confirmed lyric miss", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("unavailable", { status: 503 }));
    const provider = new LrclibProvider(fetcher);
    await expect(provider.resolve(demoPlayback(0, 0))).rejects.toThrow("503");
    fetcher.mockResolvedValue(new Response("missing", { status: 404 }));
    expect(await provider.resolve(demoPlayback(0, 0))).toBeNull();
  });
  it("recovers promptly after a transient failure while keeping confirmed misses cached", async () => {
    let now = 0;
    const track = demoPlayback(0, 0);
    const result = {
      trackKey: track.trackKey,
      cues: [{ startMs: 0, text: "Fixture" }],
      provider: "Fixture",
      attribution: "Fixture",
      timing: "line" as const,
    };
    const resolve = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue(result);
    const resolver = new LyricResolver({ name: "Fixture", resolve }, () => now);
    expect(await resolver.resolve(track)).toBeNull();
    now = 3001;
    expect(await resolver.resolve(track)).toEqual(result);
    const missing = vi.fn().mockResolvedValue(null);
    const misses = new LyricResolver(
      { name: "Fixture", resolve: missing },
      () => now,
    );
    await misses.resolve(track);
    now += 15000;
    await misses.resolve(track);
    expect(missing).toHaveBeenCalledTimes(1);
  });
});
