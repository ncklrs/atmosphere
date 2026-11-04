"use client";
import { memo, useEffect, useRef } from "react";
import { fragmentShader, vertexShader } from "../lib/visuals/shaders";
import type { Intensity } from "../../../packages/motion-engine/index";
import {
  visualPresets,
  type AmbientVisual,
  type PrismControls,
} from "../../../packages/design-system/visuals";
interface Props {
  visual: AmbientVisual;
  prism: PrismControls;
  intensity: Intensity;
  palette: readonly string[];
  identity: string;
  onReady: (ready: boolean) => void;
}
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
function GenerativeCanvas(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  }, [props]);
  useEffect(() => {
    const element = canvas.current!;
    const gl = element.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "low-power",
    });
    latest.current.onReady(false);
    if (!gl) return;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const software = info
      ? /swiftshader|llvmpipe|software/i.test(
          String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)),
        )
      : false;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0,
      disposed = false,
      lost = false,
      last = 0,
      elapsed = 0,
      prismElapsed = 0,
      budget = software ? 90000 : 520000,
      slow = 0;
    let program: WebGLProgram | null = null,
      buffer: WebGLBuffer | null = null;
    let shaders: WebGLShader[] = [];
    let width = 1,
      height = 1;
    const colors = new Float32Array([0.7, 0.6, 1, 0.3, 0.2, 0.5]);
    const target = new Float32Array(colors);
    const accentView = colors.subarray(0, 3);
    const pigmentView = colors.subarray(3, 6);
    let ready = false;
    let activeVisual = latest.current.visual;
    let reveal = 1;
    element.dataset.activeVisual = activeVisual;
    element.dataset.transition = "settled";
    let paletteKey = "",
      identity = "",
      seed = 0,
      seedTarget = 0;
    let locations: Record<string, WebGLUniformLocation | null> = {};
    const resize = () => {
      const box = element.getBoundingClientRect();
      const scale = Math.min(
        devicePixelRatio || 1,
        1.5,
        Math.sqrt(budget / Math.max(1, box.width * box.height)),
      );
      width = Math.max(1, Math.round(box.width * scale));
      height = Math.max(1, Math.round(box.height * scale));
      if (element.width !== width || element.height !== height) {
        element.width = width;
        element.height = height;
      }
      gl.viewport(0, 0, width, height);
    };
    const draw = (stamp: number) => {
      raf = 0;
      if (disposed || lost || document.hidden) {
        last = 0;
        return;
      }
      const dt = last ? Math.min(0.1, (stamp - last) / 1000) : 0;
      if (last && dt < 1 / (software ? 12 : 32) && !reduced.matches) {
        raf = requestAnimationFrame(draw);
        return;
      }
      if (last && dt > 0.05 && ++slow > 45 && budget > 90000) {
        budget *= 0.75;
        slow = 0;
        resize();
      }
      last = stamp;
      const current = latest.current;
      if (!reduced.matches)
        elapsed +=
          dt *
          (current.intensity === "Pulse"
            ? 1.4
            : current.intensity === "Whisper"
              ? 0.35
              : 0.75);
      if (!reduced.matches) prismElapsed += (dt * current.prism.motion) / 100;
      const still = current.visual === "Prism" && current.prism.motion === 0;
      const key = current.palette.join(":");
      if (key !== paletteKey) {
        target.set([...rgb(current.palette[0]), ...rgb(current.palette[1])]);
        paletteKey = key;
      }
      for (let i = 0; i < 6; i++)
        colors[i] +=
          (target[i] - colors[i]) *
          (reduced.matches || still ? 1 : Math.min(1, dt * 0.6));
      if (identity !== current.identity) {
        identity = current.identity;
        let hash = 0;
        for (let i = 0; i < identity.length; i++)
          hash = (hash * 31 + identity.charCodeAt(i)) | 0;
        seedTarget = ((hash >>> 0) % 1000) / 100;
      }
      seed +=
        (seedTarget - seed) *
        (reduced.matches || still ? 1 : Math.min(1, dt * 0.4));
      gl.uniform2f(locations.resolution, width, height);
      gl.uniform1f(locations.time, reduced.matches ? 12 : elapsed);
      if (reduced.matches) {
        activeVisual = current.visual;
        reveal = 1;
      } else if (activeVisual !== current.visual) {
        reveal = Math.max(0, reveal - dt * 3.5);
        if (reveal === 0) activeVisual = current.visual;
      } else {
        reveal = Math.min(1, reveal + dt * 2.5);
      }
      if (element.dataset.activeVisual !== activeVisual)
        element.dataset.activeVisual = activeVisual;
      const transition =
        reveal === 1 && activeVisual === current.visual
          ? "settled"
          : "changing";
      if (element.dataset.transition !== transition)
        element.dataset.transition = transition;
      gl.uniform1f(locations.mode, visualPresets[activeVisual].mode);
      gl.uniform1f(locations.reveal, reveal * reveal * (3 - 2 * reveal));
      gl.uniform1f(locations.prismTime, reduced.matches ? 12 : prismElapsed);
      gl.uniform1f(locations.prismLight, current.prism.light / 70);
      gl.uniform1f(locations.prismScale, 6 - current.prism.facetSize / 20);
      gl.uniform1f(locations.seed, seed);
      gl.uniform3fv(locations.accent, accentView);
      gl.uniform3fv(locations.pigment, pigmentView);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!ready) {
        ready = true;
        current.onReady(true);
      }
      if (!reduced.matches) raf = requestAnimationFrame(draw);
    };
    const wake = () => {
      if (!raf && !disposed && !lost && !document.hidden)
        raf = requestAnimationFrame(draw);
    };
    const release = () => {
      if (program) gl.deleteProgram(program);
      if (buffer) gl.deleteBuffer(buffer);
      for (const shader of shaders) gl.deleteShader(shader);
      shaders = [];
    };
    const initialize = () => {
      try {
        release();
        program = gl.createProgram();
        if (!program) throw new Error("No program");
        for (const [type, source] of [
          [gl.VERTEX_SHADER, vertexShader],
          [gl.FRAGMENT_SHADER, fragmentShader],
        ] as const) {
          const shader = gl.createShader(type);
          if (!shader) throw new Error("No shader");
          shaders.push(shader);
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
            throw new Error("Shader unavailable");
          gl.attachShader(program, shader);
        }
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
          throw new Error("Link unavailable");
        gl.useProgram(program);
        buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 3, -1, -1, 3]),
          gl.STATIC_DRAW,
        );
        const position = gl.getAttribLocation(program, "position");
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        locations = Object.fromEntries(
          [
            "resolution",
            "time",
            "mode",
            "seed",
            "accent",
            "pigment",
            "reveal",
            "prismTime",
            "prismLight",
            "prismScale",
          ].map((name) => [name, gl.getUniformLocation(program!, name)]),
        );
        lost = false;
        last = 0;
        resize();
        wake();
      } catch {
        release();
        lost = true;
        latest.current.onReady(false);
      }
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      ready = false;
      cancelAnimationFrame(raf);
      raf = 0;
      latest.current.onReady(false);
    };
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
      } else wake();
    };
    const observer = new ResizeObserver(() => {
      resize();
      wake();
    });
    observer.observe(element);
    element.addEventListener("webglcontextlost", contextLost);
    element.addEventListener("webglcontextrestored", initialize);
    document.addEventListener("visibilitychange", visibility);
    reduced.addEventListener("change", wake);
    initialize();
    const refresh = setInterval(() => {
      if (reduced.matches) wake();
    }, 1000);
    return () => {
      disposed = true;
      clearInterval(refresh);
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", wake);
      element.removeEventListener("webglcontextlost", contextLost);
      element.removeEventListener("webglcontextrestored", initialize);
      release();
    };
  }, []);
  return (
    <canvas ref={canvas} className="generative-canvas" aria-hidden="true" />
  );
}
export default memo(GenerativeCanvas);
