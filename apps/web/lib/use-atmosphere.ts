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
export function useAtmosphere() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [ready, setReady] = useState(false);
  const [playback, setPlayback] = useState<Playback>(() => demoPlayback(0, 0));
  const [lyrics, setLyrics] = useState<LyricResult | null>(() => demoLyrics(0));
  const [position, setPosition] = useState(6500);
  const [connection, setConnection] = useState("Offline demo");
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
    updatePlayback(demoPlayback(0, performance.now()));
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
    let disposed = false,
      socket: WebSocket | undefined,
      retry: ReturnType<typeof setTimeout>,
      backoff = 500,
      lastMessage = performance.now();
    const connect = () => {
      if (disposed) return;
      socket = new WebSocket("ws://127.0.0.1:8787/events");
      socket.onopen = () => {
        backoff = 500;
        lastMessage = performance.now();
      };
      socket.onmessage = (event) => {
        try {
          if (typeof event.data !== "string" || event.data.length > 1048576)
            throw new Error("Oversized snapshot");
          const snapshot = parseSnapshot(JSON.parse(event.data));
          if (!snapshot) throw new Error("Invalid snapshot");
          const next = receiveSnapshot(
            snapshot.playback,
            playbackRef.current.revision,
            performance.now(),
          );
          // A gateway restart can reset revisions; the new socket establishes a new session.
          if (next) {
            updatePlayback(next);
            setLyrics(
              snapshot.lyrics?.trackKey === next.trackKey
                ? snapshot.lyrics
                : null,
            );
            setConnection(
              snapshot.connected ? "Gateway connected" : "Device unavailable",
            );
            lastMessage = performance.now();
          }
        } catch {
          setConnection("Invalid gateway message");
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (!disposed) {
          setConnection("Reconnecting");
          retry = setTimeout(() => {
            updatePlayback({ ...playbackRef.current, revision: 0 });
            connect();
          }, backoff);
          backoff = Math.min(10000, backoff * 2);
        }
      };
    };
    connect();
    const heartbeat = setInterval(() => {
      if (performance.now() - lastMessage > 6500) {
        setConnection("Gateway stale");
        socket?.close();
      }
    }, 2000);
    const controller = new AbortController();
    void fetch("http://127.0.0.1:8787/capabilities", {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((value) => {
        if (!disposed) setCapabilities(value);
      })
      .catch(() => {});
    return () => {
      disposed = true;
      clearTimeout(retry);
      clearInterval(heartbeat);
      controller.abort();
      socket?.close();
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
  return {
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
