import { memo } from "react";
import type { Intensity } from "../../../packages/motion-engine/index";
export type AmbientVisual = "Bloom" | "Tide" | "Orbit";
export const ambientVisuals: AmbientVisual[] = ["Bloom", "Tide", "Orbit"];
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
}: {
  visual: AmbientVisual;
  intensity: Intensity;
  focus: "lyrics" | "ambient";
  sleep: boolean;
}) {
  if (sleep) return null;
  return (
    <div
      className={`ambient-visuals visual-${visual.toLowerCase()}`}
      data-visual={visual}
      data-intensity={intensity}
      data-focus={focus}
      aria-hidden="true"
    >
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
      {visual === "Tide" && (
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
      {visual === "Orbit" && (
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
