"use client";
import { useEffect, useRef } from "react";
import { motion, useAnimationFrame, useMotionValue } from "motion/react";
import type { Cue } from "../../../packages/playback-core/index";
import type { Intensity } from "../../../packages/motion-engine/index";
import {
  choreography,
  writeChoreographyFrame,
  type ChoreographyFrame,
} from "../../../packages/motion-engine/choreography";

export default function LyricStage({
  cue,
  index,
  positionMs,
  playing,
  intensity,
  reduced,
  word,
}: {
  cue: Cue;
  index: number;
  positionMs: number;
  playing: boolean;
  intensity: Intensity;
  reduced: boolean;
  word: number;
}) {
  const design = choreography(cue, index, intensity);
  const anchor = useRef({ positionMs, sampledAt: 0, playing });
  const frame = useRef<ChoreographyFrame>({
    leadX: 0,
    leadY: 0,
    focusX: 0,
    focusY: 0,
    scale: 1,
  });
  const leadX = useMotionValue(0),
    leadY = useMotionValue(0),
    focusX = useMotionValue(0),
    focusY = useMotionValue(0),
    scale = useMotionValue(1);
  function paint(position: number) {
    const values = writeChoreographyFrame(
      frame.current,
      position - cue.startMs,
      (cue.endMs ?? cue.startMs + 8000) - cue.startMs,
      intensity,
      reduced,
    );
    leadX.set(values.leadX);
    leadY.set(values.leadY);
    focusX.set(values.focusX);
    focusY.set(values.focusY);
    scale.set(values.scale);
  }
  useEffect(() => {
    anchor.current = { positionMs, sampledAt: performance.now(), playing };
    paint(positionMs);
  });
  useAnimationFrame(() => {
    const sample = anchor.current;
    const extrapolation = sample.playing
      ? Math.min(120, Math.max(0, performance.now() - sample.sampledAt))
      : 0;
    paint(sample.positionMs + extrapolation);
  });
  return (
    <div
      className={`kinetic-stage treatment-${design.treatment} ${design.dense ? "kinetic-dense" : ""} ${!design.phrases[0] ? "single-phrase" : ""}`}
      data-treatment={design.treatment}
      data-timing={cue.words?.length ? "word" : "line"}
      style={{ "--type-scale": design.typeScale } as React.CSSProperties}
    >
      <div className="lyric-hero kinetic-copy" aria-label={cue.text}>
        {design.phrases[0] && (
          <motion.span className="kinetic-lead" style={{ x: leadX, y: leadY }}>
            {design.phrases[0]}
          </motion.span>
        )}{" "}
        <motion.span
          className="kinetic-focus"
          style={{ x: focusX, y: focusY, scale }}
        >
          {cue.words?.length
            ? cue.words.map((w, i) => (
                <span
                  key={`${w.startMs}:${i}`}
                  className={i === word ? "word-active" : undefined}
                >
                  {w.text}{" "}
                </span>
              ))
            : design.phrases[1]}
        </motion.span>
      </div>
      <div className="kinetic-cue-mark" aria-hidden="true">
        <span>{String(index + 1).padStart(2, "0")}</span>
        <i />
      </div>
    </div>
  );
}
