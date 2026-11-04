"use client";
import { Fragment, useEffect, useMemo, useRef } from "react";
import { motion, useAnimationFrame, useMotionValue } from "motion/react";
import type { Cue } from "../../../packages/playback-core/index";
import type { Intensity } from "../../../packages/motion-engine/index";
import {
  choreography,
  writeChoreographyFrame,
  type ChoreographyFrame,
} from "../../../packages/motion-engine/choreography";

import {
  wordTreatment,
  writeWordFrame,
  type WordFrame,
} from "../../../packages/motion-engine/word-motion";

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
  const design = useMemo(
    () => choreography(cue, index, intensity),
    [cue, index, intensity],
  );
  const leadTokens = design.phrases[0].trim().split(/\s+/u).filter(Boolean);
  const focusTokens = cue.words?.length
    ? cue.words.map((w) => w.text)
    : design.phrases[1].trim().split(/\s+/u).filter(Boolean);
  const tokenCount = leadTokens.length + focusTokens.length;
  const treatment = design.steady ? "reveal" : wordTreatment(design.signature);
  const nodes = useRef<(HTMLSpanElement | null)[]>([]);
  const wordFrame = useRef<WordFrame>({
    x: 0,
    y: 0,
    rotate: 0,
    tilt: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    clip: 0,
  });
  const anchor = useRef({ positionMs, sampledAt: 0, playing });
  const frame = useRef<ChoreographyFrame>({
    leadX: 0,
    leadY: 0,
    focusX: 0,
    focusY: 0,
    scale: 1,
    leadRotate: 0,
    focusRotate: 0,
  });
  const leadX = useMotionValue(0),
    leadY = useMotionValue(0),
    focusX = useMotionValue(0),
    focusY = useMotionValue(0),
    scale = useMotionValue(1),
    leadRotate = useMotionValue(0),
    focusRotate = useMotionValue(0);
  function paint(position: number) {
    const values = writeChoreographyFrame(
      frame.current,
      position - cue.startMs,
      (cue.endMs ?? cue.startMs + 8000) - cue.startMs,
      design.steady ? "Whisper" : intensity,
      reduced,
      design.signature,
    );
    leadX.set(values.leadX);
    leadY.set(values.leadY);
    focusX.set(values.focusX);
    focusY.set(values.focusY);
    scale.set(values.scale);
    leadRotate.set(values.leadRotate);
    focusRotate.set(values.focusRotate);
    for (let i = 0; i < tokenCount; i++) {
      const node = nodes.current[i];
      if (!node) continue;
      const duration = (cue.endMs ?? cue.startMs + 8000) - cue.startMs;
      const start = cue.words?.[i]?.startMs ?? cue.startMs;
      const frame = writeWordFrame(
        wordFrame.current,
        position - start,
        duration,
        i,
        tokenCount,
        treatment,
        design.steady ? "Whisper" : intensity,
        reduced,
        !!cue.words?.length,
      );
      node.style.transform = reduced
        ? "none"
        : `perspective(700px) translate3d(${frame.x}px, ${frame.y}px, 0) rotate(${frame.rotate}deg) rotateX(${frame.tilt}deg) scale(${frame.scaleX}, ${frame.scaleY})`;
      node.style.opacity = String(frame.opacity);
      node.style.clipPath =
        frame.clip > 0 ? `inset(0 ${frame.clip}% 0 0)` : "none";
    }
  }
  useEffect(() => {
    anchor.current = { positionMs, sampledAt: performance.now(), playing };
    paint(positionMs);
  });
  useAnimationFrame(() => {
    const sample = anchor.current;
    if (reduced || !sample.playing) return;
    const extrapolation = sample.playing
      ? Math.min(120, Math.max(0, performance.now() - sample.sampledAt))
      : 0;
    paint(sample.positionMs + extrapolation);
  });
  function renderWords(tokens: string[], offset: number) {
    return tokens.map((text, i) => (
      <Fragment key={`${cue.startMs}:${offset + i}`}>
        <span
          ref={(node) => {
            nodes.current[offset + i] = node;
          }}
          style={{ opacity: reduced ? 1 : 0 }}
          className={`kinetic-word ${cue.words?.length && offset + i === word ? "word-active" : ""}`}
        >
          {text}
        </span>
        {i < tokens.length - 1 ? " " : ""}
      </Fragment>
    ));
  }
  return (
    <div
      className={`kinetic-stage treatment-${design.treatment} ${design.dense ? "kinetic-dense" : ""} ${!design.phrases[0] ? "single-phrase" : ""}`}
      data-reading={design.steady ? "steady" : "expressive"}
      data-treatment={design.treatment}
      data-word-treatment={treatment}
      data-timing={cue.words?.length ? "word" : "line"}
      style={{ "--type-scale": design.typeScale } as React.CSSProperties}
    >
      <div className="lyric-hero kinetic-copy" aria-label={cue.text}>
        {design.phrases[0] && (
          <motion.span
            className="kinetic-lead"
            style={{ x: leadX, y: leadY, rotate: leadRotate }}
          >
            {renderWords(leadTokens, 0)}
          </motion.span>
        )}{" "}
        <motion.span
          className="kinetic-focus"
          style={{ x: focusX, y: focusY, scale, rotate: focusRotate }}
        >
          {renderWords(focusTokens, leadTokens.length)}
        </motion.span>
      </div>
      <div className="kinetic-cue-mark" aria-hidden="true">
        <span>{String(index + 1).padStart(2, "0")}</span>
        <i />
      </div>
    </div>
  );
}
