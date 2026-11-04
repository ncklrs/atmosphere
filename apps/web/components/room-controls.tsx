"use client";
import Link from "next/link";
import { useState } from "react";
import type { useAtmosphere } from "../lib/use-atmosphere";
import {
  DisplayPreferences,
  LyricCorrections,
  VisualPicker,
} from "./experience-controls";
type Model = ReturnType<typeof useAtmosphere>;
export function RoomConnection({ model }: { model: Model }) {
  const room = model.room;
  return (
    <section className="room-connection">
      <h2>Phone controls</h2>
      <p className="helper">
        Pair a phone on the same Wi-Fi to change this display’s background,
        energy, brightness and lyrics. Playback stays in Spotify Connect.
      </p>
      {room.owner ? (
        <>
          {room.enabled ? (
            <>
              <p className="pair-code">{room.code}</p>
              {room.controllerUrls?.map((url) => (
                <p key={url}>
                  <a className="controller-url" href={url}>
                    {url}
                  </a>
                </p>
              ))}
              <p className="helper">
                Open the controller link on your phone while connected to the
                same Wi-Fi, then enter this code. If no link is listed, use this
                computer’s Wi-Fi address on port 3211 at /remote.
              </p>
              <button type="button" onClick={() => void room.disable()}>
                Disable & unpair controllers
              </button>
            </>
          ) : (
            <button type="button" onClick={() => void room.enable()}>
              Enable phone controls
            </button>
          )}
        </>
      ) : (
        <Link className="text-link" href="/remote">
          Open phone controller ↗
        </Link>
      )}
      {room.error && (
        <p role="alert" className="audio-error">
          {room.error}
        </p>
      )}
    </section>
  );
}
export default function RemoteControls({ model }: { model: Model }) {
  const { settings, updateSettings, room } = model;
  const [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [pairing, setPairing] = useState(false);
  const paired = !!room.paired && room.enabled;
  return (
    <main className="workspace remote-workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR ROOM / CONTROLLER</p>
          <h1>Set the mood.</h1>
        </div>
      </div>
      {!paired ? (
        <section className="pair-panel">
          <h2>{room.owner ? "Connect your room" : "Pair with your display"}</h2>
          <p>
            On the display computer, enable Phone controls in Settings. Enter
            its six-digit code here.
          </p>
          {room.owner ? (
            <button type="button" onClick={() => void room.enable()}>
              Enable phone controls
            </button>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setPairing(true);
                setError("");
                try {
                  await room.pair(code);
                } catch (reason) {
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : "Pairing failed.",
                  );
                } finally {
                  setPairing(false);
                }
              }}
            >
              <label className="field">
                Pairing code
                <input
                  aria-label="Pairing code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </label>
              <button type="submit" disabled={pairing}>
                {pairing ? "Pairing…" : "Pair display"}
              </button>
            </form>
          )}
          {error && <p role="alert">{error}</p>}
        </section>
      ) : (
        <>
          <div className="remote-status" role="status">
            <i className={`status-dot ${room.error ? "" : "on"}`} />
            {room.error ?? "Connected to your display"}
          </div>
          <p className="remote-track">
            <strong>{model.playback.title || "Your room"}</strong>
            <span>{model.playback.artist || "Ready when you are"}</span>
          </p>
          <VisualPicker
            settings={settings}
            visual={model.visual}
            onChange={updateSettings}
          />
          <label className="switch-row">
            Auto per song
            <input
              aria-label="Auto-rotate visuals per song"
              type="checkbox"
              checked={settings.autoVisuals}
              onChange={(e) =>
                updateSettings({ autoVisuals: e.target.checked })
              }
            />
          </label>
          <fieldset className="choice">
            <legend>Energy</legend>
            <div>
              {(["Whisper", "Flow", "Pulse"] as const).map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={settings.intensity === value}
                  onClick={() => updateSettings({ intensity: value })}
                >
                  {value}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="field">
            Brightness<span>{settings.brightness}%</span>
            <input
              aria-label="Display brightness"
              type="range"
              min={0}
              max={100}
              value={settings.brightness}
              onChange={(e) =>
                updateSettings({ brightness: Number(e.target.value) })
              }
            />
          </label>
          <label className="field">
            Song dynamics<span>{settings.visualDynamics}%</span>
            <input
              aria-label="Song dynamics"
              type="range"
              min={0}
              max={100}
              value={settings.visualDynamics}
              onChange={(e) =>
                updateSettings({ visualDynamics: Number(e.target.value) })
              }
            />
          </label>
          <label className="switch-row">
            Show synchronized lyrics
            <input
              type="checkbox"
              checked={settings.lyrics}
              onChange={(e) => updateSettings({ lyrics: e.target.checked })}
            />
          </label>
          <DisplayPreferences settings={settings} onChange={updateSettings} />
          <LyricCorrections
            settings={settings}
            trackKey={model.playback.trackKey}
            hasLyrics={!!model.lyrics}
            onChange={updateSettings}
          />
          <p className="helper">
            Changes apply to the paired display. The controller does not play
            audio or change Spotify playback.
          </p>
        </>
      )}
      {room.error && !paired && (
        <p className="audio-error" role="alert">
          {room.error}
        </p>
      )}
    </main>
  );
}
