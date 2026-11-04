"use client";
import {
  defaultMilkdrop,
  milkdropCollections,
  milkdropPresets,
  presetsInCollection,
  type MilkdropSettings,
  type MilkdropPreset,
} from "../../../packages/design-system/milkdrop";
import type { MilkdropStatus } from "./milkdrop-canvas";
export default function MilkdropControls({
  controls,
  active,
  status,
  onChange,
  onSelect,
}: {
  controls: MilkdropSettings;
  active: MilkdropPreset;
  status: MilkdropStatus;
  onChange: (patch: Partial<MilkdropSettings>) => void;
  onSelect: (preset: MilkdropPreset) => void;
}) {
  const preset = milkdropPresets[active];
  return (
    <section className="milkdrop-controls" aria-label="Butterchurn controls">
      <fieldset className="choice">
        <legend>Curated collection</legend>
        <div>
          {milkdropCollections.map((collection) => (
            <button
              key={collection}
              type="button"
              aria-pressed={controls.collection === collection}
              className={controls.collection === collection ? "selected" : ""}
              onClick={() =>
                onChange({
                  collection,
                  preset: presetsInCollection(collection)[0],
                })
              }
            >
              {collection}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="choice milkdrop-presets">
        <legend>Milkdrop scenes</legend>
        <div>
          {presetsInCollection(controls.collection).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={active === id}
              className={active === id ? "selected" : ""}
              onClick={() => onSelect(id)}
            >
              {milkdropPresets[id].title}
            </button>
          ))}
        </div>
      </fieldset>
      <p className="helper">
        {preset.description}
        <br />
        <span className="preset-credit">Preset: {preset.credit}</span>
      </p>
      <p className="milkdrop-status" role="status">
        {status === "fallback"
          ? "Ambient fallback · Milkdrop unavailable on this display"
          : status === "reduced"
            ? "Ambient fallback · reduced motion is on"
            : status === "loading"
              ? "Loading Milkdrop scenes…"
              : "Ambient animation · no audio capture"}
      </p>
      <p className="helper">
        Milkdrop scenes use their own colors. Choose Ambient for album-art
        colors.
      </p>
      <fieldset className="prism-controls">
        <legend>Shape Milkdrop</legend>
        {(
          [
            ["brightness", "Brightness", 100, "%"],
            ["motion", "Animation speed", 100, "%"],
            ["energy", "Pattern energy", 100, "%"],
            ["blendSeconds", "Preset blend", 12, "s"],
          ] as const
        ).map(([key, label, max, unit]) => (
          <label className="field" key={key}>
            {label}
            <span>
              {key === "motion" && controls[key] === 0
                ? "Still"
                : `${controls[key]}${unit}`}
            </span>
            <input
              type="range"
              min={0}
              max={max}
              step={key === "blendSeconds" ? 1 : 5}
              aria-label={`Milkdrop ${label.toLowerCase()}`}
              value={controls[key]}
              onChange={(event) =>
                onChange({ [key]: Number(event.target.value) })
              }
            />
          </label>
        ))}
        <p className="helper">
          Zero speed holds the scene. Pattern energy shapes the ambient
          animation; it does not measure the music. Blend timing follows
          animation speed.
        </p>
        <button
          type="button"
          className="milkdrop-reset"
          onClick={() =>
            onChange({
              brightness: defaultMilkdrop.brightness,
              motion: defaultMilkdrop.motion,
              energy: defaultMilkdrop.energy,
              blendSeconds: defaultMilkdrop.blendSeconds,
            })
          }
        >
          Reset controls
        </button>
      </fieldset>
    </section>
  );
}
