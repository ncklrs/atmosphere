"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { AudioSession } from "../lib/audio/session";
const AudioContextStore = createContext<AudioSession | null>(null);
export function AudioInputProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session] = useState(() => new AudioSession());
  useEffect(() => () => session.stop(), [session]);
  return (
    <AudioContextStore.Provider value={session}>
      {children}
      <AudioIndicator />
    </AudioContextStore.Provider>
  );
}
export function useAudioSession() {
  const session = useContext(AudioContextStore);
  if (!session) throw new Error("AudioInputProvider is required");
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  return { session, state };
}
function AudioIndicator() {
  const { session, state } = useAudioSession();
  if (state.phase === "idle" || state.phase === "error") return null;
  return (
    <div className="audio-session-indicator">
      <span>
        <i className="status-dot on" />
        {state.phase === "computer"
          ? "Computer audio → visuals"
          : state.phase === "line-in"
            ? "Wired input → visuals"
            : state.phase === "microphone"
              ? "Microphone → visuals"
              : state.phase === "loading"
                ? "Connecting audio…"
                : state.phase === "paused"
                  ? "Local audio paused"
                  : state.label}
      </span>
      <button
        type="button"
        onClick={session.stop}
        aria-label="Stop visualizer audio"
      >
        Stop
      </button>
    </div>
  );
}
