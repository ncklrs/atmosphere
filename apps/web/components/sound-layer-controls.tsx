"use client";
import {
  soundStyles,
  soundPlacements,
  resolveSoundStyle,
  type SoundLayerSettings,
} from "../../../packages/design-system/sound-layer";
import type { AmbientVisual } from "../../../packages/design-system/visuals";
import { useAudioSession } from "./audio-input-provider";
export default function SoundLayerControls({
  settings,
  visual,
  onChange,
}: {
  settings: SoundLayerSettings;
  visual: AmbientVisual;
  onChange: (patch: Partial<SoundLayerSettings>) => void;
}) {
  const { session, state } = useAudioSession();
  const active = ["demo", "file", "microphone"].includes(state.phase);
  const change = (patch: Partial<SoundLayerSettings>) => {
    if (patch.enabled === false) session.stop();
    onChange(patch);
  };
  return (
    <section className="sound-controls" aria-label="Sound layer controls">
      <div className="sound-heading">
        <span className="eyebrow">SOUND + ATMOSPHERE</span>
        <span className="sound-badge">Waviz prototype</span>
      </div>
      <label className="switch-row">
        Add a sound layer
        <input
          aria-label="Enable sound layer"
          type="checkbox"
          checked={settings.enabled}
          onChange={(event) => change({ enabled: event.target.checked })}
        />
      </label>
      {settings.enabled && (
        <>
          <fieldset className="choice">
            <legend>Sound treatment</legend>
            <div>
              {soundStyles.map((style) => (
                <button
                  type="button"
                  key={style}
                  className={style === settings.style ? "selected" : ""}
                  aria-pressed={style === settings.style}
                  onClick={() => change({ style })}
                >
                  {style}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="helper">
            {settings.style === "Auto"
              ? `${resolveSoundStyle(settings.style, visual)} pairs with ${visual}. `
              : ""}
            Your original background stays underneath. Colors follow the album
            palette.
          </p>
          <fieldset className="choice">
            <legend>Sound placement</legend>
            <div>
              {soundPlacements.map((placement) => (
                <button
                  type="button"
                  key={placement}
                  className={placement === settings.placement ? "selected" : ""}
                  aria-pressed={placement === settings.placement}
                  onClick={() => change({ placement })}
                >
                  {placement}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="prism-controls">
            <legend>Shape the layer</legend>
            {(
              [
                ["strength", "Presence"],
                ["size", "Size"],
                ["sensitivity", "Response"],
              ] as const
            ).map(([key, label]) => (
              <label className="field" key={key}>
                {label}
                <span>{settings[key]}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  aria-label={`Sound layer ${label.toLowerCase()}`}
                  value={settings[key]}
                  onChange={(event) =>
                    change({ [key]: Number(event.target.value) })
                  }
                />
              </label>
            ))}
          </fieldset>
          <div className="audio-source-card">
            <div className="audio-state" role="status">
              <i className={`status-dot ${active ? "on" : ""}`} />
              <strong>
                {state.phase === "loading"
                  ? "Connecting audio…"
                  : state.phase === "error"
                    ? "Audio unavailable"
                    : active
                      ? `Live audio · ${state.label}`
                      : state.phase === "paused"
                        ? `Paused · ${state.label}`
                        : "Ambient preview · no audio connected"}
              </strong>
            </div>
            <p className="helper">
              The WiiM sends track details, not sound. Connect an input to make
              the layer react.
            </p>
            <div className="audio-source-actions">
              <button
                type="button"
                disabled={state.phase === "loading"}
                onClick={() => void session.startDemo()}
              >
                Play test audio
              </button>
              <label className="audio-file-button">
                Choose audio file
                <input
                  aria-label="Choose local audio file"
                  type="file"
                  accept="audio/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void session.startFile(file);
                    event.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                disabled={state.phase === "loading"}
                onClick={() => void session.startMicrophone()}
              >
                Use microphone
              </button>
              {(state.phase === "file" || state.phase === "paused") && (
                <button type="button" onClick={() => void session.toggleFile()}>
                  {state.phase === "paused"
                    ? "Resume local audio"
                    : "Pause local audio"}
                </button>
              )}
              {state.phase !== "idle" && (
                <button type="button" onClick={session.stop}>
                  Disconnect audio
                </button>
              )}
            </div>
            <label className="field">
              Test / file volume<span>{state.volume}%</span>
              <input
                type="range"
                aria-label="Visualizer audio volume"
                min={0}
                max={100}
                value={state.volume}
                onChange={(event) =>
                  session.setVolume(Number(event.target.value))
                }
              />
            </label>
            {state.error && (
              <p className="audio-error" role="alert">
                {state.error}
              </p>
            )}
            <p className="helper">
              Test audio plays a quiet original loop. Files and microphone audio
              stay in this browser. Microphone input is never played through
              your speakers. Test/file audio is separate from WiiM playback.
              Inputs stay connected when you enter Display; Stop disconnects
              them.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

export function SoundQuickStart() {
  const { session, state } = useAudioSession();
  const connected = !["idle", "error"].includes(state.phase);
  return (
    <div className="sound-quick-start">
      <span>{connected ? state.label : "Hear the new layer react"}</span>
      <button
        type="button"
        onClick={() => {
          if (connected) session.stop();
          else void session.startDemo();
        }}
      >
        {connected ? "Stop audio preview" : "Try with test audio"}
        <span aria-hidden="true"> ↗</span>
      </button>
    </div>
  );
}
