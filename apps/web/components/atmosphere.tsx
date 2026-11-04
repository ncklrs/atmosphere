"use client";
import Link from "next/link";
import RemoteControls, { RoomConnection } from "./room-controls";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { MotionConfig, useReducedMotion } from "motion/react";
import { useArtworkPalette } from "../lib/use-artwork-palette";
import { useAtmosphere } from "../lib/use-atmosphere";
import { composition, timeline } from "../../../packages/motion-engine/index";
import { schedule, type AmbientScene } from "../../../packages/circadian/index";
import {
  palettes,
  trackPaletteIndex,
} from "../../../packages/design-system/index";
import AmbientVisuals from "./ambient-visuals";
import {
  VisualPicker,
  DisplayPreferences,
  LyricCorrections,
} from "./experience-controls";
import { defaultPrism } from "../../../packages/design-system/visuals";
import { defaults } from "../lib/settings";
import LyricStage from "./lyric-stage";
import { prepareVisualScore } from "../../../packages/motion-engine/visual-score";
import { choreography } from "../../../packages/motion-engine/choreography";
import { useAudioSession } from "./audio-input-provider";
import SoundLayerControls, { SoundQuickStart } from "./sound-layer-controls";
const SoundLayerCanvas = dynamic(() => import("./sound-layer-canvas"), {
  ssr: false,
});
type View = "display" | "lab" | "settings" | "diagnostics" | "remote";
type Model = ReturnType<typeof useAtmosphere>;
const formatTime = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
const sceneNames: Record<AmbientScene, string> = {
  AMBIENT_DAY: "Daylight",
  AMBIENT_DUSK: "Golden hour",
  AMBIENT_NIGHT: "After dark",
  SLEEP: "Sleep",
};
function Mark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
function Transport({
  model,
  compact = false,
}: {
  model: Model;
  compact?: boolean;
}) {
  const { playback: p, position, transport, settings } = model;
  return (
    <div className={`transport ${compact ? "compact" : ""}`}>
      <div className="transport-buttons">
        <button
          aria-label="Previous demo track"
          disabled={settings.source !== "demo"}
          onClick={() => transport("previous")}
        >
          ↤
        </button>
        <button
          className="play-button"
          aria-label={p.state === "playing" ? "Pause demo" : "Play demo"}
          disabled={settings.source !== "demo"}
          onClick={() => transport("toggle")}
        >
          {p.state === "playing" ? "Ⅱ" : "▶"}
        </button>
        <button
          aria-label="Next demo track"
          disabled={settings.source !== "demo"}
          onClick={() => transport("next")}
        >
          ↦
        </button>
      </div>
      <div className="seek">
        <span>{formatTime(position)}</span>
        <input
          aria-label="Demo playback position"
          type="range"
          min={0}
          max={p.durationMs || 1}
          value={Math.min(position, p.durationMs || 1)}
          disabled={settings.source !== "demo"}
          onChange={(e) => transport("seek", Number(e.target.value))}
        />
        <span>{formatTime(p.durationMs)}</span>
      </div>
    </div>
  );
}
function DisplayScene({
  model,
  preview = false,
}: {
  model: Model;
  preview?: boolean;
}) {
  const {
    playback: p,
    lyrics,
    settings,
    position,
    clock,
    demoIndex,
    connection,
  } = model;
  const container = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState("Cinema");
  const reduced = useReducedMotion();
  const audio = useAudioSession();
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      setLayout(composition(box.width, box.height));
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const minuteEpoch = clock
    ? Math.floor(clock.getTime() / 60000) * 60000
    : 1793376000000;
  const ambient = useMemo(
    () =>
      schedule(
        new Date(minuteEpoch),
        settings.circadian,
        settings.override,
        p.state === "playing",
      ),
    [minuteEpoch, settings.circadian, settings.override, p.state],
  );
  const isSleep = ambient.scene === "SLEEP" && !ambient.musicAwake;
  useEffect(() => {
    if (
      model.ready &&
      (isSleep || !settings.soundLayer.enabled) &&
      !["idle", "error"].includes(audio.state.phase)
    )
      audio.session.stop();
  }, [
    isSleep,
    model.ready,
    settings.soundLayer.enabled,
    audio.session,
    audio.state.phase,
  ]);
  const [trackNotice, setTrackNotice] = useState(true);
  useEffect(() => {
    setTrackNotice(true);
    const timer = setTimeout(() => setTrackNotice(false), 8000);
    return () => clearTimeout(timer);
  }, [p.trackKey]);
  const calibration =
    settings.calibrationMs + (settings.trackOffsets[p.trackKey] ?? 0);
  const active = p.state === "playing" || p.state === "paused";
  const cues =
    settings.lyrics &&
    !settings.hiddenLyrics.includes(p.trackKey) &&
    lyrics?.trackKey === p.trackKey
      ? lyrics.cues
      : [];
  const { index, word } = timeline(cues, position + calibration);
  const current = cues[index];
  const hasLine = !!(active && current && current.text.trim());
  const ambientBreak = active && !hasLine;
  const treatment = hasLine
    ? choreography(current, index, settings.intensity).treatment
    : null;
  const chosen =
    settings.composition === "Auto" ? layout : settings.composition;
  const extractedPalette = useArtworkPalette(
    settings.source === "gateway" ? p.artworkUrl : null,
  );
  const palette =
    extractedPalette ??
    palettes[
      settings.source === "demo"
        ? demoIndex % palettes.length
        : trackPaletteIndex(p.trackKey || "ambient")
    ];
  const scoreCues = useMemo(
    () =>
      prepareVisualScore(
        lyrics?.trackKey === p.trackKey &&
          !settings.hiddenLyrics.includes(p.trackKey)
          ? lyrics.cues
          : [],
      ),
    [lyrics, p.trackKey, settings.hiddenLyrics],
  );
  const score = useMemo(
    () => ({
      cues: scoreCues,
      positionMs: position + calibration,
      playing: p.state === "playing",
      amount: active ? settings.visualDynamics : 0,
      intensity: settings.intensity,
    }),
    [
      scoreCues,
      position,
      calibration,
      p.state,
      settings.visualDynamics,
      active,
      settings.intensity,
    ],
  );
  const time =
    clock?.toLocaleTimeString("en-US", {
      timeZone: settings.circadian.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) ?? "—:—";
  const scene = isSleep
    ? "SLEEP"
    : active
      ? p.state === "paused"
        ? "PAUSED"
        : "ACTIVE"
      : ambient.scene;
  return (
    <div
      ref={container}
      className={`display-scene ${settings.cleanDisplay ? "clean-scene" : ""} layout-${chosen.toLowerCase()} ${isSleep ? "sleeping" : ""} ${settings.contrast ? "high-contrast" : ""}`}
      data-track-mode={settings.trackInfo}
      data-track-info={
        settings.trackInfo === "always" ||
        (settings.trackInfo === "brief" && trackNotice)
          ? "visible"
          : "hidden"
      }
      data-clock={settings.showClock ? "visible" : "hidden"}
      data-progress={settings.showProgress ? "visible" : "hidden"}
      data-layout={chosen}
      data-scene={scene}
      data-state={p.state}
      data-palette={extractedPalette ? "artwork" : "fallback"}
      style={
        {
          "--accent": palette[0],
          "--album-1": palette[1],
          "--album-2": palette[2],
        } as React.CSSProperties
      }
    >
      <div className="palette-backdrop" />
      <AmbientVisuals
        score={score}
        prism={settings.prism}
        palette={palette}
        identity={p.trackKey || "ambient"}
        visual={model.visual}
        intensity={settings.intensity}
        focus={hasLine ? "lyrics" : "ambient"}
        sleep={isSleep}
      />
      {!isSleep && settings.soundLayer.enabled && (
        <SoundLayerCanvas
          score={score}
          controls={settings.soundLayer}
          visual={model.visual}
          palette={palette}
          lyrics={hasLine}
          session={audio.session}
        />
      )}
      <div className="scene-topline">
        <span className="eyebrow">
          <i className={`status-dot ${p.state === "playing" ? "on" : ""}`} />
          {settings.source === "demo"
            ? "ORIGINAL DEMO"
            : connection.toUpperCase()}
        </span>
        <span className="eyebrow scene-label">
          {scene === "ACTIVE" ? "A ROOM FOR SOUND" : scene.replaceAll("_", " ")}
        </span>
      </div>
      <div
        className={`scene-composition ${hasLine ? `choreographed choreo-${treatment}` : ambientBreak ? "ambient-break" : "ambient-idle"}`}
        data-choreography={treatment ?? "ambient"}
        data-intensity={settings.intensity}
      >
        {!ambientBreak && (
          <div className={`lyric-column ${hasLine ? "" : "ambient-column"}`}>
            <div className="section-index">
              <span>{active ? "IN THIS MOMENT" : "LET THE ROOM BREATHE"}</span>
              <span>
                {active && index >= 0
                  ? `${String(index + 1).padStart(2, "0")} / ${String(cues.length).padStart(2, "0")}`
                  : "○"}
              </span>
            </div>
            {hasLine ? (
              <LyricStage
                cue={current}
                index={index}
                positionMs={position + calibration}
                playing={p.state === "playing"}
                intensity={settings.intensity}
                reduced={!!reduced}
                word={word}
              />
            ) : (
              <div className="ambient-copy">
                <span
                  className="ambient-time"
                  style={{
                    transform: `translate(${(Math.floor((clock?.getMinutes() ?? 0) / 10) % 3) - 1}px, ${Math.floor((clock?.getMinutes() ?? 0) / 20) - 1}px)`,
                  }}
                >
                  {time}
                </span>
                <h1>
                  {sceneNames[ambient.scene]}
                  <span className="accent">.</span>
                </h1>
                <p>Nothing to do. Just be here.</p>
              </div>
            )}
            <div className="lyric-footnote">
              <span>
                {p.state === "paused"
                  ? "Ⅱ PAUSED · TIMELINE FROZEN"
                  : hasLine
                    ? lyrics?.timing === "word"
                      ? "WORD-SYNCHRONIZED"
                      : "LINE-SYNCHRONIZED"
                    : "ROOM TO LISTEN"}
              </span>
              <div
                className={`sound-bars ${p.state !== "playing" ? "still" : ""}`}
                aria-hidden="true"
              >
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="scene-bottom">
        <div className="now-playing">
          <div>
            <h2>{p.title || "Your room, in a different light"}</h2>
            <p>
              {p.artist || "Atmosphere"}
              <span> / </span>
              {p.album || sceneNames[ambient.scene]}
            </p>
          </div>
        </div>
        <div className="scene-progress">
          <span>{formatTime(position)}</span>
          <div>
            <i
              style={{
                transform: `scaleX(${p.durationMs ? position / p.durationMs : 0})`,
              }}
            />
          </div>
          <span>{formatTime(p.durationMs)}</span>
        </div>
        <span className="source-caption">
          {settings.source === "demo"
            ? "SYNTHETIC SESSION"
            : "WIIM · READ ONLY"}
        </span>
      </div>
      <div
        className="brightness-layer"
        aria-hidden="true"
        style={{
          opacity: isSleep
            ? 1
            : 1 - (ambient.intensity * settings.brightness) / 100,
        }}
      />
      {isSleep && (
        <div className="sleep-note">
          <span>Display sleeping</span>
          <button
            onClick={() =>
              model.updateSettings({
                override: {
                  scene: "AMBIENT_NIGHT",
                  expiresAt: Date.now() + 3600000,
                },
              })
            }
          >
            Wake for one hour
          </button>
        </div>
      )}
      {preview && (
        <span className="preview-label">
          {chosen} / {scene}
        </span>
      )}
    </div>
  );
}
function Choice({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="choice">
      <legend>{title}</legend>
      <div>
        {options.map((option) => (
          <button
            type="button"
            key={option}
            className={value === option ? "selected" : ""}
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
function Lab({ model }: { model: Model }) {
  const { settings, updateSettings } = model;
  return (
    <main className="workspace lab">
      <div className="page-heading">
        <div>
          <p className="eyebrow">THE VISUAL LAB / 01</p>
          <h1>
            Make room
            <br />
            for <span className="serif accent">feeling.</span>
          </h1>
        </div>
        <p>
          A live canvas for sound, type, and light.
          <br />
          Find the atmosphere that feels like you.
        </p>
      </div>
      <div className="lab-grid">
        <div className="lab-stage">
          <div className="preview">
            <DisplayScene model={model} preview />
          </div>
          <Transport model={model} />
          {settings.soundLayer.enabled && <SoundQuickStart />}
          <p className="caption">
            {settings.source === "demo"
              ? "Original demo lyrics. Controls don’t affect your WiiM."
              : "Live from your WiiM. Playback stays in your music app."}
          </p>
        </div>
        <aside className="control-panel">
          <p className="eyebrow">COMPOSE YOUR ROOM</p>
          <label className="switch-row">
            Auto per song
            <input
              type="checkbox"
              aria-label="Auto-rotate visuals per song"
              checked={settings.autoVisuals}
              onChange={(event) =>
                updateSettings({
                  autoVisuals: event.target.checked,
                  ...(!event.target.checked
                    ? { ambientVisual: model.visual }
                    : {}),
                })
              }
            />
          </label>
          <p className="helper">
            {settings.autoVisuals
              ? `Now showing ${model.visual}. A new background for each song.`
              : "Choose a background, or rotate automatically when songs change."}
          </p>
          <VisualPicker
            settings={settings}
            visual={model.visual}
            onChange={updateSettings}
          />
          <label className="field song-dynamics-control">
            Song dynamics<span>{settings.visualDynamics}%</span>
            <input
              type="range"
              aria-label="Song dynamics"
              min={0}
              max={100}
              value={settings.visualDynamics}
              onChange={(event) =>
                model.updateSettings({
                  visualDynamics: Number(event.target.value),
                })
              }
            />
          </label>
          <p className="helper">
            Phrase swells, repeated-line emphasis, open instrumental breaks and
            a fresh color sweep for each song. Uses lyrics and album colors; no
            microphone needed. Zero keeps the original ambient motion.
          </p>
          <Choice
            title="Motion intensity"
            options={["Whisper", "Flow", "Pulse"]}
            value={settings.intensity}
            onChange={(value) =>
              updateSettings({ intensity: value as typeof settings.intensity })
            }
          />
          <p className="helper">
            {settings.intensity === "Whisper"
              ? "Quiet placements. Soft scale. Almost still."
              : settings.intensity === "Flow"
                ? "A new composition for every line. Phrases sweep in at different angles, expand, and find their place."
                : "Bolder scale, sweeping entrances, and full-canvas lyric moments."}
          </p>
          <label className="switch-row">
            Show synchronized lyrics
            <input
              type="checkbox"
              checked={settings.lyrics}
              onChange={(e) => updateSettings({ lyrics: e.target.checked })}
            />
          </label>
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
          <DisplayPreferences settings={settings} onChange={updateSettings} />
          <LyricCorrections
            settings={settings}
            trackKey={model.playback.trackKey}
            hasLyrics={!!model.lyrics}
            onChange={updateSettings}
          />
          <details className="experience-details">
            <summary>Fine tuning</summary>{" "}
            {model.visual === "Prism" && (
              <fieldset className="prism-controls">
                <legend>Shape Prism</legend>
                {(
                  [
                    ["light", "Light intensity"],
                    ["motion", "Motion speed"],
                    ["facetSize", "Facet size"],
                  ] as const
                ).map(([key, label]) => (
                  <label className="field" key={key}>
                    {label}
                    <span>
                      {key === "motion" && settings.prism[key] === 0
                        ? "Still"
                        : `${settings.prism[key]}%`}
                    </span>
                    <input
                      aria-label={`Prism ${label.toLowerCase()}`}
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={settings.prism[key]}
                      onChange={(event) =>
                        updateSettings({
                          prism: {
                            ...settings.prism,
                            [key]: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </label>
                ))}
                <p className="helper">
                  Larger facets feel quieter. Set motion to zero for a still
                  background.
                </p>
              </fieldset>
            )}
            <Choice
              title="Composition"
              options={["Auto", "Cinema", "Canvas", "Portrait", "Companion"]}
              value={settings.composition}
              onChange={(value) => updateSettings({ composition: value })}
            />
            <label className="switch-row">
              High contrast
              <input
                type="checkbox"
                checked={settings.contrast}
                onChange={(e) => updateSettings({ contrast: e.target.checked })}
              />
            </label>
            <div className="panel-rule" />
            <label className="field">
              Lyric calibration{" "}
              <span>
                {settings.calibrationMs > 0 ? "+" : ""}
                {settings.calibrationMs} ms
              </span>
              <input
                aria-label="Lyric calibration"
                type="range"
                min={-5000}
                max={5000}
                step={50}
                value={settings.calibrationMs}
                onChange={(e) =>
                  updateSettings({ calibrationMs: Number(e.target.value) })
                }
              />
            </label>
            <p className="helper">
              Positive values advance the lyrics. Adjust against your room’s
              audio delay.
            </p>
          </details>
          <details className="experience-details audio-experiments">
            <summary>Audio experiments</summary>{" "}
            <SoundLayerControls
              settings={settings.soundLayer}
              visual={model.visual}
              onChange={(patch) =>
                updateSettings({
                  soundLayer: { ...settings.soundLayer, ...patch },
                })
              }
            />
          </details>
          <button
            className="reset-visuals"
            type="button"
            onClick={() =>
              updateSettings({
                intensity: defaults.intensity,
                visualDynamics: defaults.visualDynamics,
                prism: defaultPrism,
                soundLayer: defaults.soundLayer,
              })
            }
          >
            Reset visual tuning
          </button>
          <Link className="text-link" href="/display">
            Enter display <span>↗</span>
          </Link>
        </aside>
      </div>
    </main>
  );
}
function SettingsPage({ model }: { model: Model }) {
  const { settings, updateSettings, clock } = model;
  const c = settings.circadian;
  const [timezone, setTimezone] = useState(c.timezone),
    [error, setError] = useState("");
  useEffect(() => setTimezone(c.timezone), [c.timezone]);
  const patch = (input: Partial<typeof c>) =>
    updateSettings({ circadian: { ...c, ...input } });
  const ambient = schedule(clock ?? new Date(), c, settings.override);
  return (
    <main className="workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ROOM PREFERENCES / 02</p>
          <h1>
            In tune with
            <br />
            <span className="serif accent">your day.</span>
          </h1>
        </div>
        <p>
          Saved locally. Shared with paired controllers.
          <br />
          No account. No cloud. Just your room.
        </p>
      </div>
      <RoomConnection model={model} />
      <div className="settings-grid">
        <section className="settings-section">
          <h2>
            <span>01</span> The sound source
          </h2>
          <Choice
            title="Playback source"
            options={["Offline demo", "Local gateway"]}
            value={
              settings.source === "demo" ? "Offline demo" : "Local gateway"
            }
            onChange={(value) =>
              updateSettings({
                source: value === "Local gateway" ? "gateway" : "demo",
              })
            }
          />
          <p className="helper">
            Gateway: 127.0.0.1:8787. Set WIIM_HOST on the server to connect your
            Mini. Live playback is controlled in your music app.
          </p>
          <h2>
            <span>02</span> The rhythm of the day
          </h2>
          <label className="field">
            IANA timezone
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              onBlur={() => {
                try {
                  new Intl.DateTimeFormat("en", {
                    timeZone: timezone,
                  }).format();
                  patch({ timezone });
                  setError("");
                } catch {
                  setError(
                    "Enter a valid IANA timezone, such as America/New_York.",
                  );
                }
              }}
            />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="field-pair">
            <label className="field">
              Approx. latitude
              <input
                type="number"
                min={-90}
                max={90}
                step="any"
                placeholder="Optional"
                value={c.latitude ?? ""}
                onChange={(e) =>
                  patch({
                    latitude:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="field">
              Approx. longitude
              <input
                type="number"
                min={-180}
                max={180}
                step="any"
                placeholder="Optional"
                value={c.longitude ?? ""}
                onChange={(e) =>
                  patch({
                    longitude:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
          <p className="helper">
            Coordinates stay on this computer and paired controllers. Without
            solar events, use 08:00 day / 18:00 dusk / 21:00 night.
          </p>
          <div className="field-pair">
            <label className="field">
              Sleep at
              <input
                type="time"
                value={c.sleep}
                onChange={(e) => patch({ sleep: e.target.value })}
              />
            </label>
            <label className="field">
              Wake at
              <input
                type="time"
                value={c.wake}
                onChange={(e) => patch({ wake: e.target.value })}
              />
            </label>
          </div>
          <div className="field-pair">
            <label className="field">
              Sunrise offset (min)
              <input
                type="number"
                min={-180}
                max={180}
                value={c.sunriseOffsetMin}
                onChange={(e) =>
                  patch({ sunriseOffsetMin: Number(e.target.value) })
                }
              />
            </label>
            <label className="field">
              Dusk offset (min)
              <input
                type="number"
                min={-180}
                max={180}
                value={c.duskOffsetMin}
                onChange={(e) =>
                  patch({ duskOffsetMin: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <label className="field">
            Night after sunset (min)
            <input
              type="number"
              min={-180}
              max={180}
              value={c.nightOffsetMin}
              onChange={(e) =>
                patch({ nightOffsetMin: Number(e.target.value) })
              }
            />
          </label>
          <label className="switch-row">
            Music wakes the display
            <input
              type="checkbox"
              checked={c.musicWake}
              onChange={(e) => patch({ musicWake: e.target.checked })}
            />
          </label>
        </section>
        <aside className="settings-section">
          <p className="eyebrow">RIGHT NOW</p>
          <div className="scene-card">
            <div className="mini-sun" />
            <h3>{sceneNames[ambient.scene]}</h3>
            <p>{Math.round(ambient.intensity * 100)}% software intensity</p>
            <span>
              {ambient.solar ? "Solar schedule" : "Fallback schedule"} ·{" "}
              {c.timezone}
            </span>
          </div>
          <h2>
            <span>03</span> Set the mood
          </h2>
          <p className="helper">
            Override the schedule for one hour. It expires automatically.
          </p>
          <div className="scene-choices">
            {Object.entries(sceneNames).map(([scene, name]) => (
              <button
                key={scene}
                aria-pressed={
                  settings.override?.scene === scene &&
                  settings.override.expiresAt > (clock?.getTime() ?? 0)
                }
                onClick={() =>
                  updateSettings({
                    override: {
                      scene: scene as AmbientScene,
                      expiresAt: Date.now() + 3600000,
                    },
                  })
                }
              >
                {name}
                <span>↗</span>
              </button>
            ))}
          </div>
          <button
            className="text-link"
            onClick={() => updateSettings({ override: null })}
          >
            Return to schedule <span>↗</span>
          </button>
          <p className="helper capability-note">
            Software dimming adjusts the picture. Physical backlight and panel
            power are unverified and disabled. Sleep paints black; it does not
            switch the monitor off.
          </p>
        </aside>
      </div>
    </main>
  );
}
function Diagnostics({ model }: { model: Model }) {
  return (
    <main className="workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SYSTEM OBSERVATORY / 03</p>
          <h1>
            A little
            <br />
            <span className="serif accent">transparency.</span>
          </h1>
        </div>
        <p>
          What this display knows.
          <br />
          And what still needs a real-world test.
        </p>
      </div>
      <div className="diagnostic-summary">
        <div>
          <i className="status-dot on" /> {model.connection}
        </div>
        <span>
          {model.settings.source === "demo"
            ? "Original synthetic session"
            : "Local read-only source"}
        </span>
      </div>
      <div className="diagnostic-grid">
        <section>
          <h2>Playback observation</h2>
          <dl>
            {Object.entries({
              Source: model.playback.sourceId,
              Track: model.playback.title || "No track",
              State: model.playback.state,
              Position: `${Math.round(model.position)} ms`,
              Revision: model.playback.revision,
              Confidence: `${Math.round(model.playback.confidence * 100)}%`,
              "Lyric provider": model.lyrics?.provider ?? "Unavailable",
              Timing: model.lyrics?.timing ?? "none",
              Attribution: model.lyrics?.attribution ?? "—",
            }).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h2>Capability evidence</h2>
          <dl>
            <div>
              <dt>Software dimming</dt>
              <dd>Available</dd>
            </div>
            <div>
              <dt>Physical backlight</dt>
              <dd>Unverified · disabled</dd>
            </div>
            <div>
              <dt>Panel power / wake</dt>
              <dd>Unverified · disabled</dd>
            </div>
            <div>
              <dt>Real WiiM handoff</dt>
              <dd>Needs hardware test</dd>
            </div>
            <div>
              <dt>Audio drift & 60fps</dt>
              <dd>Needs room measurement</dd>
            </div>
            <div>
              <dt>Album artwork</dt>
              <dd>Spotify CDN only · local fallback</dd>
            </div>
          </dl>
          {model.capabilities && (
            <details>
              <summary>Gateway capability response</summary>
              <pre>{JSON.stringify(model.capabilities, null, 2)}</pre>
            </details>
          )}
        </section>
      </div>
      <div className="diagnostic-note">
        <p className="eyebrow">VALIDATION CHECKPOINT</p>
        <h2>Bring your room into the loop.</h2>
        <p>
          Start the gateway with your WiiM’s private IP. Test two-account
          Spotify Connect handoff, pause, seek, skip, network recovery, and
          reboot. Record firmware and timing observations before calling the
          hardware compatible.
        </p>
      </div>
    </main>
  );
}
export default function Atmosphere({ view }: { view: View }) {
  const model = useAtmosphere();
  const [fullscreen, setFullscreen] = useState(false);
  const [quiet, setQuiet] = useState(false);
  useEffect(() => {
    if (view !== "display" || !model.settings.cleanDisplay) return;
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setQuiet(false);
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (
          !(
            document.activeElement?.matches(":focus-visible") &&
            document.activeElement?.closest(".app-header,.display-dock")
          )
        )
          setQuiet(true);
      }, 4500);
    };
    for (const event of ["pointermove", "pointerdown", "keydown", "focusout"])
      window.addEventListener(event, wake);
    wake();
    return () => {
      clearTimeout(timer);
      for (const event of ["pointermove", "pointerdown", "keydown", "focusout"])
        window.removeEventListener(event, wake);
    };
  }, [view, model.settings.cleanDisplay]);
  useEffect(() => {
    const change = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      <div
        className={`app view-${view} ${fullscreen ? "is-fullscreen" : ""} ${model.settings.cleanDisplay ? "clean-display" : ""} ${quiet && model.settings.cleanDisplay ? "chrome-quiet" : "chrome-awake"}`}
      >
        <a href="#content" className="skip-link">
          Skip to content
        </a>
        <header
          className="app-header"
          inert={view === "display" && quiet && model.settings.cleanDisplay}
        >
          <Link
            href="/display"
            className="brand"
            aria-label="Atmosphere display"
          >
            <Mark />
            atmosphere<span>™</span>
          </Link>
          <nav aria-label="Main navigation">
            {(["display", "lab", "settings", "diagnostics"] as const).map(
              (item) => (
                <Link
                  key={item}
                  href={`/${item}`}
                  aria-current={view === item ? "page" : undefined}
                >
                  {item === "lab"
                    ? "Visual lab"
                    : item[0].toUpperCase() + item.slice(1)}
                </Link>
              ),
            )}
          </nav>
          <div className="header-end">
            <span>
              <i className="status-dot on" /> LOCAL FIRST
            </span>
            <button
              className="fullscreen-button"
              aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen();
                else
                  void document.documentElement
                    .requestFullscreen()
                    .catch(() => {});
              }}
            >
              ⤢
            </button>
          </div>
        </header>
        <div id="content" className="content" tabIndex={-1}>
          {view === "display" ? (
            <main className="display-main">
              <DisplayScene model={model} />
              <div
                className="display-dock"
                inert={quiet && model.settings.cleanDisplay}
              >
                <span className="dock-label">
                  {model.settings.intensity.toUpperCase()} <span>/</span>{" "}
                  {model.playback.state === "paused" ? "PAUSED" : "LINE LYRICS"}
                </span>
                <Transport model={model} compact />
                <div className="dock-actions">
                  {model.settings.source === "demo" && model.lyrics && (
                    <button
                      aria-label="Next lyric"
                      onClick={() => {
                        const cues = model.lyrics!.cues;
                        const next =
                          cues.find(
                            (cue) =>
                              cue.text.trim() &&
                              cue.startMs >
                                model.position + model.settings.calibrationMs,
                          ) ?? cues[0];
                        if (next)
                          model.transport(
                            "seek",
                            next.startMs + 1000 - model.settings.calibrationMs,
                          );
                      }}
                    >
                      Next lyric ↗
                    </button>
                  )}
                  <Link href="/lab">Tune the atmosphere ↗</Link>
                </div>
              </div>
            </main>
          ) : view === "lab" ? (
            <Lab model={model} />
          ) : view === "remote" ? (
            <RemoteControls model={model} />
          ) : view === "settings" ? (
            <SettingsPage model={model} />
          ) : (
            <Diagnostics model={model} />
          )}
        </div>
        {view !== "display" && (
          <footer className="app-footer">
            <span>ATMOSPHERE — A ROOM FOR SOUND.</span>
            <span>DESIGNED TO DISAPPEAR INTO YOUR DAY.</span>
          </footer>
        )}
        <span className="sr-only" role="status">
          {model.playback.title
            ? `${model.playback.title} by ${model.playback.artist}`
            : model.connection}
        </span>
      </div>
    </MotionConfig>
  );
}
