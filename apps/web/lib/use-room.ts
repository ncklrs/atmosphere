"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { validateSettings, type Settings } from "./settings";
const roomUrl = (action: string) =>
  `/api/room/${action}${location.pathname === "/remote" ? "?controller=1" : ""}`;
interface RoomState {
  sessionId?: string;
  controllerUrls?: string[];
  enabled: boolean;
  owner: boolean;
  code?: string;
  revision: number;
  settings: Settings | null;
  error?: string;
  paired?: boolean;
}
export function useRoom(
  settings: Settings,
  ready: boolean,
  apply: (settings: Settings) => void,
) {
  const [room, setRoom] = useState<RoomState>({
    enabled: false,
    owner: false,
    revision: 0,
    settings: null,
  });
  const current = useRef(room),
    latest = useRef(settings),
    applyRef = useRef(apply),
    queue = useRef<Partial<Settings>>({}),
    busy = useRef(false),
    mounted = useRef(false),
    sequence = useRef(0);
  useEffect(() => {
    latest.current = settings;
    applyRef.current = apply;
  }, [settings, apply]);
  const accept = useCallback((state: RoomState) => {
    if (!mounted.current) return;
    if (
      state.sessionId === current.current.sessionId &&
      state.revision < current.current.revision
    )
      return;
    const next = { ...state, paired: true };
    current.current = next;
    setRoom(next);
    if (
      state.enabled &&
      state.settings &&
      !busy.current &&
      !Object.keys(queue.current).length
    )
      applyRef.current(validateSettings(state.settings));
  }, []);
  const request = useCallback(async (action: string, data: unknown) => {
    const result = await fetch(roomUrl(action), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const response = await result.json();
    if (!result.ok) throw new Error(response.error ?? "Room update failed.");
    return response;
  }, []);
  const flush = useCallback(async () => {
    if (busy.current || !current.current.enabled || !current.current.paired)
      return;
    busy.current = true;
    let inFlight: Partial<Settings> = {};
    try {
      while (Object.keys(queue.current).length) {
        const patch = queue.current;
        inFlight = patch;
        queue.current = {};
        const state = await request("settings", { patch });
        inFlight = {};
        busy.current = false;
        accept(state);
        busy.current = true;
      }
    } catch (error) {
      queue.current = { ...inFlight, ...queue.current };
      if (mounted.current)
        setRoom((r) => ({
          ...r,
          error: error instanceof Error ? error.message : "Room update failed.",
        }));
    } finally {
      busy.current = false;
    }
  }, [accept, request]);
  const publish = useCallback(
    (patch: Partial<Settings>) => {
      if (!current.current.enabled || !current.current.paired) return;
      queue.current = { ...queue.current, ...patch };
      void flush();
    },
    [flush],
  );
  useEffect(() => {
    if (!ready) return;
    mounted.current = true;
    const run = ++sequence.current;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const result = await fetch(roomUrl("state"), {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(3000),
          ]),
        });
        const data = await result.json();
        if (!mounted.current || run !== sequence.current) return;
        if (result.ok) {
          setRoom((r) => (r.error ? { ...r, error: undefined } : r));
          if (Object.keys(queue.current).length) void flush();
          if (
            data.sessionId !== current.current.sessionId ||
            data.revision !== current.current.revision ||
            !current.current.paired
          )
            accept(data);
        } else if (result.status === 401) {
          queue.current = {};
          current.current = {
            ...current.current,
            paired: false,
            enabled: !!data.enabled,
          };
          setRoom((r) => ({
            ...r,
            paired: false,
            enabled: !!data.enabled,
            error: undefined,
          }));
        } else {
          setRoom((r) => ({
            ...r,
            error: data.error ?? "Room connection unavailable. Reconnecting…",
          }));
        }
      } catch {
        if (mounted.current && run === sequence.current)
          setRoom((r) => ({
            ...r,
            error: "Room connection lost. Reconnecting…",
          }));
      }
      if (mounted.current && run === sequence.current)
        timer = setTimeout(poll, 1000);
    };
    void poll();
    return () => {
      mounted.current = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [ready, accept, flush]);
  const enable = useCallback(async () => {
    try {
      accept(await request("enable", { settings: latest.current }));
    } catch (e) {
      setRoom((r) => ({
        ...r,
        error: e instanceof Error ? e.message : "Could not enable controls.",
      }));
    }
  }, [accept, request]);
  const disable = useCallback(async () => {
    try {
      accept(await request("disable", {}));
    } catch (e) {
      setRoom((r) => ({
        ...r,
        error: e instanceof Error ? e.message : "Could not revoke controls.",
      }));
    }
  }, [accept, request]);
  const pair = useCallback(
    async (code: string) => {
      await request("pair", { code });
      const result = await fetch(roomUrl("state"), { cache: "no-store" });
      if (!result.ok) throw new Error("Pairing could not be confirmed.");
      accept(await result.json());
    },
    [accept, request],
  );
  return { ...room, publish, enable, disable, pair };
}
