"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  demoLyrics,
  demoPlayback,
  tracks,
} from "../../../packages/fixtures/index";
import {
  emptyPlayback,
  positionAt,
  parseSnapshot,
  receiveSnapshot,
  type LyricResult,
  type Playback,
} from "../../../packages/playback-core/index";
import {
  defaults,
  storageKey,
  validateSettings,
  type Settings,
} from "./settings";
import { useSongVisual } from "./use-song-visual";
export function useAtmosphere() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [ready, setReady] = useState(false);
  const [playback, setPlayback] = useState<Playback>(() => emptyPlayback());
  const [lyrics, setLyrics] = useState<LyricResult | null>(null);
  const [position, setPosition] = useState(0);
  const [connection, setConnection] = useState("Connecting");
  const [clock, setClock] = useState<Date | null>(null);
  const [capabilities, setCapabilities] = useState<Record<
    string,
    unknown
  > | null>(null);
  const playbackRef = useRef(playback),
    demoIndex = useRef(0);
  const updatePlayback = useCallback((next: Playback) => {
    playbackRef.current = next;
    setPlayback(next);
    setPosition(next.positionMs);
  }, []);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setSettings(validateSettings(JSON.parse(stored)));
    } catch {
      /* Storage may be disabled. */
    }
    setReady(true);
  }, [updatePlayback]);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(settings));
      } catch {
        /* Settings still work for this session. */
      }
    }
  }, [settings, ready]);
  useEffect(() => {
    if (!ready) return;
    if (settings.source === "demo") {
      updatePlayback(
        demoPlayback(
          demoIndex.current,
          performance.now(),
          playbackRef.current.revision + 1,
        ),
      );
      setLyrics(demoLyrics(demoIndex.current));
      setConnection("Offline demo");
      setCapabilities(null);
      return;
    }
    updatePlayback(emptyPlayback(performance.now()));
    setLyrics(null);
    setConnection("Connecting");
    let disposed = false;
    let retry: ReturnType<typeof setTimeout>;
    let backoff = 500;
    let session: string | undefined;
    let revision = 0;
    const controller = new AbortController();
    const sample = async () => {
      try {
        const response = await fetch("/api/gateway/state", {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(3000),
          ]),
        });
        if (!response.ok) throw new Error("Gateway unavailable");
        const snapshot = parseSnapshot(await response.json());
        if (!snapshot) throw new Error("Invalid snapshot");
        if (disposed) return;
        if (snapshot.sessionId !== session) {
          revision = 0;
          session = snapshot.sessionId;
        }
        const next = receiveSnapshot(
          snapshot.playback,
          revision,
          performance.now(),
        );
        if (next) {
          revision = next.revision;
          updatePlayback(next);
          setLyrics(
            snapshot.lyrics?.trackKey === next.trackKey
              ? snapshot.lyrics
              : null,
          );
          setConnection(
            snapshot.connected ? "Gateway connected" : "Device unavailable",
          );
        }
        backoff = 500;
      } catch {
        if (disposed) return;
        revision = 0;
        setLyrics(null);
        updatePlayback({
          ...playbackRef.current,
          state: "unknown",
          sampledAtMonotonicMs: performance.now(),
        });
        setConnection("Reconnecting");
        backoff = Math.min(3000, backoff * 2);
      }
      if (!disposed) retry = setTimeout(sample, backoff);
    };
    void sample();
    void fetch("/api/gateway/capabilities", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((value) => {
        if (!disposed) setCapabilities(value);
      })
      .catch(() => {});
    return () => {
      disposed = true;
      clearTimeout(retry);
      controller.abort();
    };
  }, [settings.source, ready, updatePlayback]);
  useEffect(() => {
    const timer = setInterval(() => {
      const now = performance.now(),
        p = playbackRef.current;
      const current = positionAt(p, now);
      if (settings.source === "demo" && p.state === "playing") {
        if (current >= p.durationMs) {
          demoIndex.current = (demoIndex.current + 1) % tracks.length;
          updatePlayback(demoPlayback(demoIndex.current, now, p.revision + 1));
          setLyrics(demoLyrics(demoIndex.current));
        } else {
          const next = { ...p, positionMs: current, sampledAtMonotonicMs: now };
          playbackRef.current = next;
          setPosition(current);
        }
      } else setPosition(current);
      setClock(new Date());
    }, 100);
    return () => clearInterval(timer);
  }, [settings.source, updatePlayback]);
  const transport = useCallback(
    (action: "toggle" | "next" | "previous" | "seek", value = 0) => {
      if (settings.source !== "demo") return;
      const p = playbackRef.current,
        now = performance.now();
      if (action === "next" || action === "previous") {
        demoIndex.current =
          (demoIndex.current + (action === "next" ? 1 : tracks.length - 1)) %
          tracks.length;
        updatePlayback(demoPlayback(demoIndex.current, now, p.revision + 1));
        setLyrics(demoLyrics(demoIndex.current));
      } else
        updatePlayback({
          ...p,
          positionMs:
            action === "seek"
              ? Math.min(p.durationMs, Math.max(0, value))
              : positionAt(p, now),
          state:
            action === "toggle"
              ? p.state === "playing"
                ? "paused"
                : "playing"
              : p.state,
          sampledAtMonotonicMs: now,
          revision: p.revision + 1,
        });
    },
    [settings.source, updatePlayback],
  );
  const updateSettings = useCallback(
    (patch: Partial<Settings>) =>
      setSettings((previous) => validateSettings({ ...previous, ...patch })),
    [],
  );
  const visual = useSongVisual(playback, settings, ready);
  return {
    visual,
    ready,
    settings,
    updateSettings,
    playback,
    lyrics,
    position,
    clock,
    connection,
    transport,
    capabilities,
    demoIndex: playback.trackKey.startsWith("demo:")
      ? Number(playback.trackKey.slice(5)) || 0
      : 0,
  };
}
