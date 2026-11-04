"use client";
import { memo, useEffect, useRef } from "react";
import type { Visualizer, AudioAnalyzer, IOptions } from "waviz/core";
import {
  resolveSoundStyle,
  soundGeometry,
  type SoundLayerSettings,
} from "../../../packages/design-system/sound-layer";
import type { AmbientVisual } from "../../../packages/design-system/visuals";
import type { AudioSession } from "../lib/audio/session";
import {
  emptyVisualFrame,
  writeVisualScore,
  type VisualScoreSource,
} from "../../../packages/motion-engine/visual-score";
import { haloSpectrum } from "../lib/visuals/spectrum";
interface Props {
  score: VisualScoreSource;
  controls: SoundLayerSettings;
  visual: AmbientVisual;
  palette: readonly string[];
  lyrics: boolean;
  session: AudioSession;
}
function SoundLayerCanvas(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null),
    latest = useRef(props);
  const wakeRef = useRef<() => void>(() => {});
  useEffect(() => {
    latest.current = props;
    wakeRef.current();
  }, [props]);
  useEffect(() => {
    const element = canvas.current!,
      ctx = element.getContext("2d", { alpha: true });
    if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false,
      raf = 0,
      last = 0,
      time = 0,
      frames = 0;
    let energy = 0;
    const scoreFrame = emptyVisualFrame();
    let painter: Visualizer | null = null,
      idleAnalyzer: AudioAnalyzer | null = null;
    let previousStyle = "";
    const resize = () => {
      const rect = element.getBoundingClientRect();
      const scale = Math.min(
        devicePixelRatio || 1,
        1.5,
        Math.sqrt(600000 / Math.max(1, rect.width * rect.height)),
      );
      element.width = Math.max(1, Math.round(rect.width * scale));
      element.height = Math.max(1, Math.round(rect.height * scale));
    };
    const draw = (stamp: number) => {
      raf = 0;
      if (disposed || document.hidden || !painter || !idleAnalyzer) return;
      const dt = last ? Math.min(0.1, (stamp - last) / 1000) : 0;
      if (last && dt < 1 / 30 && !reduced.matches) {
        raf = requestAnimationFrame(draw);
        return;
      }
      last = stamp;
      if (!reduced.matches) time += dt;
      const p = latest.current,
        { width: w, height: h } = element;
      const phase = p.session.getSnapshot().phase;
      const connected =
        ["demo", "file", "microphone", "line-in", "computer"].includes(phase) &&
        !!p.session.analyzer;
      const reactive = connected && !reduced.matches;
      const style = resolveSoundStyle(p.controls.style, p.visual);
      const placement =
        p.controls.placement === "Auto" && style === "Ribbons"
          ? { ...p.controls, placement: "Lower" as const }
          : p.controls;
      const {
        x,
        y,
        radius: restingRadius,
      } = soundGeometry(w, h, placement, p.lyrics);
      writeVisualScore(
        scoreFrame,
        p.score,
        p.score.positionMs,
        reduced.matches,
      );
      const lyricPresence = scoreFrame.phrase + scoreFrame.drive * 0.4;
      const baseRadius = restingRadius * (1 + lyricPresence * 0.13);
      const gain = 0.5 + p.controls.sensitivity / 25;
      const waveform = reactive
        ? p.session.analyzer?.getTimeDomainData()
        : null;
      let power = 0;
      if (waveform)
        for (const sample of waveform) power += ((sample - 128) / 128) ** 2;
      const targetEnergy = waveform?.length
        ? Math.min(1, Math.sqrt(power / waveform.length) * gain * 4)
        : 0;
      energy += (targetEnergy - energy) * (reduced.matches ? 1 : 0.18);
      const radius = baseRadius * (1 + energy * 0.12);
      if (previousStyle !== style) {
        painter.particleSystem = [];
        previousStyle = style;
      }
      painter.data = p.session.analyzer ?? idleAnalyzer;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.translate(x - w / 2, y - h / 2);
      const gradient = ctx.createLinearGradient(w * 0.15, 0, w * 0.85, h);
      gradient.addColorStop(0, p.palette[0]);
      gradient.addColorStop(0.48, "#eef4ff");
      gradient.addColorStop(1, p.palette[1]);
      ctx.strokeStyle = gradient;
      ctx.fillStyle = gradient;
      ctx.shadowColor = p.palette[0];
      ctx.shadowBlur = Math.min(w, h) * 0.025;
      const layer = (options: IOptions, alpha = 1) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        painter!.layer({
          color: ["linearGradient", p.palette[0], p.palette[1]],
          stroke: [Math.max(1, w / 650)],
          ...options,
        });
        ctx.restore();
      };
      if (style === "Halo") {
        // A quiet idle composition remains useful when no audio is connected.
        for (let ring = 0; ring < 3; ring++) {
          const points = Array.from(
            { length: 192 },
            (_, i) =>
              Math.sin((i / 192) * Math.PI * 6 + time * 0.3 + ring) *
              radius *
              0.024,
          );
          ctx.beginPath();
          painter.line(
            painter.dataToPolar(
              points,
              radius * (0.93 + ring * 0.12),
              ring * 30,
              0,
            ),
          );
          ctx.closePath();
          ctx.globalAlpha = ring === 1 ? 0.55 : 0.16;
          ctx.lineWidth = ring === 1 ? 2 : 1;
          ctx.stroke();
        }
        if (reactive) {
          layer(
            {
              domain: ["time", radius * 0.95 * gain, 512],
              coord: ["polar", radius],
              viz: ["line", 256],
            },
            0.9,
          );
          const frequency = p.session.analyzer!.getFrequencyData();
          const bands = haloSpectrum(frequency, gain, radius * 0.55);
          ctx.save();
          ctx.globalAlpha = 0.7;
          ctx.lineWidth = Math.max(1.3, w / 550);
          painter.bars(
            painter.dataToPolar(bands, radius * 1.14),
            bands.length,
            "polar",
            radius * 1.14,
          );
          ctx.stroke();
          ctx.restore();
        }
      } else if (style === "Ribbons") {
        for (let ribbon = 0; ribbon < 3; ribbon++) {
          ctx.save();
          ctx.translate(0, (ribbon - 1) * radius * 0.23);
          if (reactive) {
            layer(
              {
                domain: [
                  "time",
                  radius * gain * (1.5 - ribbon * 0.25),
                  1024,
                  "hann",
                ],
                coord: ["rect"],
                viz: ["line", 384],
                stroke: [Math.max(1.4, w / 520)],
              },
              0.85 - ribbon * 0.22,
            );
          } else {
            const points = Array.from(
              { length: 256 },
              (_, i) =>
                Math.sin((i / 256) * Math.PI * 4 + time * 0.32 + ribbon * 0.5) *
                radius *
                0.24 *
                Math.sin((i / 256) * Math.PI),
            );
            ctx.beginPath();
            painter.line(painter.dataToRect(points));
            ctx.globalAlpha = 0.45 - ribbon * 0.1;
            ctx.lineWidth = Math.max(1.2, w / 600);
            ctx.stroke();
          }
          ctx.restore();
        }
      } else {
        for (let i = 0; i < 56; i++) {
          const angle = i * 2.39996 + time * 0.025,
            r = radius * Math.sqrt((i + 1) / 56) * 1.35;
          const px = w / 2 + Math.cos(angle) * r,
            py = h / 2 + Math.sin(angle) * r * 0.72;
          ctx.globalAlpha =
            0.24 + (0.5 + 0.5 * Math.sin(time * 0.5 + i)) * 0.46;
          ctx.beginPath();
          ctx.arc(px, py, i % 8 === 0 ? 1.8 : 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
        if (reactive) {
          layer(
            {
              domain: ["time", radius * gain, 512],
              coord: ["polar", radius * 0.5, 0, 0.04],
              viz: ["particles", [2.8, 2.8], 0, 38, 3, 32],
              stroke: [1.5],
            },
            0.85,
          );
          layer(
            {
              domain: ["freq", radius * 0.45 * gain, 256],
              coord: ["polar", radius * 0.95, 0, -0.02],
              viz: ["dots", 48],
              stroke: [2],
            },
            0.5,
          );
        }
      }
      ctx.restore();
      painter.frame++;
      frames++;
      element.dataset.frame = String(frames);
      element.dataset.style = style;
      element.dataset.input = reduced.matches
        ? "reduced"
        : connected
          ? "audio"
          : "ambient";
      if (!reduced.matches) raf = requestAnimationFrame(draw);
    };
    const wake = () => {
      if (!disposed && !document.hidden && painter && !raf)
        raf = requestAnimationFrame(draw);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };
    wakeRef.current = wake;
    const visibility = () => {
      if (document.hidden) stop();
      else wake();
    };
    const preference = () => {
      stop();
      wake();
    };
    const observer = new ResizeObserver(() => {
      resize();
      wake();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", visibility);
    reduced.addEventListener("change", preference);
    const unsubscribe = latest.current.session.subscribe(wake);
    void import("waviz/core")
      .then(({ Visualizer, AudioAnalyzer }) => {
        if (disposed) return;
        idleAnalyzer = new AudioAnalyzer();
        painter = new Visualizer(element, idleAnalyzer);
        resize();
        wake();
      })
      .catch(() => {
        element.dataset.input = "unavailable";
      });
    return () => {
      disposed = true;
      stop();
      wakeRef.current = () => {};
      observer.disconnect();
      unsubscribe();
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", preference);
      painter?.stop();
      if (painter) painter.particleSystem = [];
    };
  }, []);
  return (
    <canvas
      ref={canvas}
      className="sound-layer"
      data-focus={props.lyrics ? "lyrics" : "ambient"}
      aria-hidden="true"
      style={
        {
          "--sound-presence": props.controls.strength / 100,
        } as React.CSSProperties
      }
    />
  );
}
export default memo(SoundLayerCanvas);
