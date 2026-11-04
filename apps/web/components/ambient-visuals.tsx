import { memo, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import GenerativeCanvas from "./generative-canvas";
import type { MilkdropStatus } from "./milkdrop-canvas";
import type {
  MilkdropSettings,
  MilkdropPreset,
} from "../../../packages/design-system/milkdrop";
const MilkdropCanvas = dynamic(() => import("./milkdrop-canvas"), {
  ssr: false,
});
import type { Intensity } from "../../../packages/motion-engine/index";
import {
  visualPresets,
  type AmbientVisual,
  type PrismControls,
} from "../../../packages/design-system/visuals";
export {
  ambientVisuals,
  type AmbientVisual,
} from "../../../packages/design-system/visuals";
const contours = Array.from(
  { length: 9 },
  (_, i) =>
    `M-100 ${260 + i * 23} C180 ${40 + i * 24} 440 ${690 - i * 15} 740 ${350 + i * 20} S1120 ${80 + i * 28} 1400 ${390 + i * 19}`,
);
const particles = Array.from(
  { length: 72 },
  (_, i) =>
    ({
      left: `${(i * 61.73 + 13) % 100}%`,
      top: `${(i * 37.31 + 19) % 100}%`,
      animationDelay: `-${i * 7}s`,
      animationDuration: `${18 + (i % 11) * 3}s`,
      "--dust-size": `${i % 9 === 0 ? 3 : i % 3 === 0 ? 2 : 1}px`,
    }) as React.CSSProperties,
);

function AmbientVisuals({
  visual,
  intensity,
  focus,
  sleep,
  palette,
  identity,
  prism,
  engine,
  milkdrop,
  milkdropPreset,
  onVisualStatus,
}: {
  visual: AmbientVisual;
  intensity: Intensity;
  focus: "lyrics" | "ambient";
  sleep: boolean;
  palette: readonly string[];
  identity: string;
  prism: PrismControls;
  engine: "ambient" | "milkdrop";
  milkdrop: MilkdropSettings;
  milkdropPreset: MilkdropPreset;
  onVisualStatus?: (status: MilkdropStatus) => void;
}) {
  const [gpu, setGpu] = useState(false);
  const [milkdropStatus, setMilkdropStatus] =
    useState<MilkdropStatus>("loading");
  const updateStatus = useCallback(
    (status: MilkdropStatus) => {
      setMilkdropStatus(status);
      onVisualStatus?.(status);
    },
    [onVisualStatus],
  );
  if (sleep) return null;
  const fallback = visualPresets[visual].fallback;
  const isMilkdrop = engine === "milkdrop";
  const ambientFallback =
    milkdropStatus === "fallback" || milkdropStatus === "reduced";
  return (
    <div
      className={`ambient-visuals visual-${fallback.toLowerCase()} preset-${visual.toLowerCase()}`}
      data-renderer={
        isMilkdrop && milkdropStatus === "ready"
          ? "butterchurn"
          : gpu && (!isMilkdrop || ambientFallback)
            ? "webgl"
            : "css"
      }
      data-engine={engine}
      data-engine-state={isMilkdrop ? milkdropStatus : "ready"}
      data-preset={isMilkdrop ? milkdropPreset : undefined}
      data-visual={visual}
      data-intensity={intensity}
      data-focus={focus}
      data-still={visual === "Prism" && prism.motion === 0 ? "true" : "false"}
      style={
        visual === "Prism"
          ? ({
              "--prism-light": prism.light / 70,
              "--prism-size": prism.facetSize / 100,
              "--ambient-tempo": 100 / Math.max(1, prism.motion),
            } as React.CSSProperties)
          : undefined
      }
      aria-hidden="true"
    >
      {isMilkdrop && (
        <MilkdropCanvas
          preset={milkdropPreset}
          controls={milkdrop}
          onStatus={updateStatus}
        />
      )}
      {(!isMilkdrop || ambientFallback) && (
        <GenerativeCanvas
          prism={prism}
          visual={visual}
          intensity={intensity}
          palette={palette}
          identity={identity}
          onReady={setGpu}
        />
      )}
      <div className="ambient-fields">
        <i className="ambient-field field-one" />
        <i className="ambient-field field-two" />
        <i className="ambient-field field-three" />
        <i className="ambient-field field-four" />
      </div>
      <div className="ambient-nebula">
        <i className="nebula-cloud cloud-one" />
        <i className="nebula-cloud cloud-two" />
        <i className="nebula-cloud cloud-three" />
      </div>
      {fallback === "Tide" && (
        <svg
          className="ambient-contours"
          viewBox="0 0 1200 800"
          preserveAspectRatio="xMidYMid slice"
        >
          <g>
            {contours.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          <g className="contour-echo">
            {contours.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        </svg>
      )}
      {fallback === "Orbit" && (
        <div className="ambient-orbital">
          <div className="orbital-corona" />
          <div className="orbital-disk">
            <i />
          </div>
          <div className="ambient-orb">
            <i className="orb-surface" />
          </div>
          <div className="orbital-moon" />
          <div className="ambient-ring ring-one" />
          <div className="ambient-ring ring-two" />
          <div className="ambient-ring ring-three" />
        </div>
      )}
      <div className="ambient-dust">
        {particles.map((style, i) => (
          <i key={i} style={style} />
        ))}
      </div>
      <div className="ambient-vignette" />
    </div>
  );
}
export default memo(AmbientVisuals);
