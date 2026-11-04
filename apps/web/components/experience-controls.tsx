"use client";
import { useState } from "react";
import {
  ambientVisuals,
  visualPresets,
  type AmbientVisual,
} from "../../../packages/design-system/visuals";
import type { Settings } from "../lib/settings";
type Change = (patch: Partial<Settings>) => void;
export function VisualPicker({
  settings,
  visual,
  onChange,
}: {
  settings: Settings;
  visual: AmbientVisual;
  onChange: Change;
}) {
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  return (
    <section className="visual-picker" aria-label="Ambient visuals">
      <div className="section-heading">
        <h2>Background</h2>
        <button
          type="button"
          aria-pressed={favoritesOnly}
          onClick={() => setFavoritesOnly(!favoritesOnly)}
        >
          Favorites
        </button>
      </div>
      <div className="visual-tiles">
        {ambientVisuals
          .filter((v) => !favoritesOnly || settings.favorites.includes(v))
          .map((v) => (
            <div className={`visual-tile tile-${v.toLowerCase()}`} key={v}>
              <button
                type="button"
                className="visual-select"
                aria-label={v}
                aria-pressed={visual === v}
                onClick={() =>
                  onChange({ ambientVisual: v, autoVisuals: false })
                }
              >
                <span className="visual-swatch" aria-hidden="true" />
                <strong>{v}</strong>
              </button>
              <button
                type="button"
                className="favorite-button"
                aria-label={`${settings.favorites.includes(v) ? "Unfavorite" : "Favorite"} ${v}`}
                aria-pressed={settings.favorites.includes(v)}
                onClick={() =>
                  onChange({
                    favorites: settings.favorites.includes(v)
                      ? settings.favorites.filter((x) => x !== v)
                      : [...settings.favorites, v],
                  })
                }
              >
                {settings.favorites.includes(v) ? "★" : "☆"}
              </button>
            </div>
          ))}
      </div>
      {favoritesOnly && !settings.favorites.length && (
        <p className="helper">
          Star a background to collect your favorites here.
        </p>
      )}
      <p className="helper">{visualPresets[visual].description}</p>
    </section>
  );
}
export function DisplayPreferences({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: Change;
}) {
  return (
    <details className="experience-details">
      <summary>Display preferences</summary>
      {(
        [
          ["cleanDisplay", "Clean display"],
          ["showClock", "Show idle clock"],
          ["showProgress", "Show song progress"],
        ] as const
      ).map(([key, label]) => (
        <label className="switch-row" key={key}>
          {label}
          <input
            type="checkbox"
            checked={settings[key]}
            onChange={(e) => onChange({ [key]: e.target.checked })}
          />
        </label>
      ))}
      <label className="field">
        Song information
        <select
          aria-label="Song information"
          value={settings.trackInfo}
          onChange={(e) =>
            onChange({ trackInfo: e.target.value as Settings["trackInfo"] })
          }
        >
          <option value="brief">Briefly on song changes</option>
          <option value="always">Always visible</option>
          <option value="hidden">Hidden</option>
        </select>
      </label>
      <p className="helper">
        Controls return on touch, mouse movement or keyboard input. Clean
        display hides technical labels.
      </p>
    </details>
  );
}
export function LyricCorrections({
  settings,
  trackKey,
  hasLyrics,
  onChange,
}: {
  settings: Settings;
  trackKey: string;
  hasLyrics: boolean;
  onChange: Change;
}) {
  const offset = settings.trackOffsets[trackKey] ?? 0,
    hidden = settings.hiddenLyrics.includes(trackKey);
  return (
    <details className="experience-details">
      <summary>Lyric timing & corrections</summary>
      <p className="helper" role="status">
        {hidden
          ? "Lyrics hidden for this song."
          : hasLyrics
            ? "Synchronized lyrics available."
            : "No synchronized lyrics available. The background stays ambient."}
      </p>
      <label className="field">
        This song’s timing
        <span>
          {offset > 0 ? "+" : ""}
          {offset} ms
        </span>
        <input
          aria-label="This song lyric timing"
          type="range"
          min={-5000}
          max={5000}
          step={50}
          value={offset}
          disabled={!trackKey}
          onChange={(e) =>
            onChange({
              trackOffsets: {
                ...settings.trackOffsets,
                [trackKey]: Number(e.target.value),
              },
            })
          }
        />
      </label>
      <p className="helper">
        Positive values advance lyrics. Saved for this song, in addition to the
        room calibration.
      </p>
      <div className="experience-actions">
        <button
          type="button"
          disabled={!trackKey}
          onClick={() =>
            onChange({
              trackOffsets: { ...settings.trackOffsets, [trackKey]: 0 },
            })
          }
        >
          Reset song timing
        </button>
        <button
          type="button"
          disabled={!trackKey}
          onClick={() =>
            onChange({
              hiddenLyrics: hidden
                ? settings.hiddenLyrics.filter((k) => k !== trackKey)
                : [...settings.hiddenLyrics, trackKey],
            })
          }
        >
          {hidden
            ? "Restore this song’s lyrics"
            : "Wrong lyrics? Hide this song"}
        </button>
      </div>
    </details>
  );
}
