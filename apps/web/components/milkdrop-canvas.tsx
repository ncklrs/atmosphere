"use client";
import { memo, useEffect, useRef } from "react";
import type { Visualizer } from "butterchurn";
import type {
  MilkdropPreset,
  MilkdropSettings,
} from "../../../packages/design-system/milkdrop";
import { writeAmbientDrive } from "../lib/visuals/ambient-drive";
import { loadMilkdropPreset } from "../lib/visuals/milkdrop-loader";
export type MilkdropStatus = "loading" | "ready" | "fallback" | "reduced";
interface Props {
  preset: MilkdropPreset;
  controls: MilkdropSettings;
  onStatus: (status: MilkdropStatus) => void;
}
function MilkdropCanvas(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  const wakeRef = useRef<() => void>(() => {});
  useEffect(() => {
    latest.current = props;
    wakeRef.current();
  }, [props]);
  useEffect(() => {
    const element = canvas.current!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false,
      lost = false,
      failed = false,
      raf = 0,
      last = 0,
      time = 0,
      frames = 0;
    let visualizer: Visualizer | null = null;
    let requested: MilkdropPreset | null = null,
      active: MilkdropPreset | null = null,
      request = 0,
      initialization = 0;
    let reportedStatus: MilkdropStatus | null = null;
    let width = 1,
      height = 1,
      budget = 360000,
      fps = 30,
      slow = 0;
    const left = new Uint8Array(1024),
      right = new Uint8Array(1024);
    const audioLevels = {
      timeByteArray: left,
      timeByteArrayL: left,
      timeByteArrayR: right,
    };
    // No AudioContext, microphone, network stream, or audio output is created.
    const gl = element.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
    });
    const status = (value: MilkdropStatus) => {
      if (!disposed && reportedStatus !== value) {
        reportedStatus = value;
        latest.current.onStatus(value);
      }
    };
    status(reduced.matches ? "reduced" : "loading");
    if (!gl) {
      status("fallback");
      return;
    }
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    if (
      info &&
      /swiftshader|llvmpipe|software/i.test(
        String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)),
      )
    ) {
      budget = 70000;
      fps = 12;
    }
    const size = () => {
      const box = element.getBoundingClientRect();
      const scale = Math.min(
        devicePixelRatio || 1,
        1.5,
        Math.sqrt(budget / Math.max(1, box.width * box.height)),
      );
      const w = Math.max(1, Math.round(box.width * scale)),
        h = Math.max(1, Math.round(box.height * scale));
      if (w !== width || h !== height) {
        width = w;
        height = h;
        if (visualizer) visualizer.setRendererSize(width, height);
        else {
          element.width = width;
          element.height = height;
        }
      }
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };
    const fail = () => {
      failed = true;
      stop();
      status("fallback");
    };
    const choosePreset = async (id: MilkdropPreset) => {
      requested = id;
      const ticket = ++request;
      try {
        const preset = await loadMilkdropPreset(id);
        if (
          disposed ||
          failed ||
          lost ||
          ticket !== request ||
          latest.current.preset !== id ||
          !visualizer
        )
          return;
        const moving = !reduced.matches && latest.current.controls.motion > 0;
        visualizer.loadPreset(
          preset,
          active && moving ? latest.current.controls.blendSeconds : 0,
        );
        active = id;
        element.dataset.activePreset = id;
        wake();
      } catch {
        if (
          ticket === request &&
          latest.current.preset === id &&
          !disposed &&
          !lost
        )
          fail();
      }
    };
    const draw = (stamp: number) => {
      raf = 0;
      if (
        disposed ||
        failed ||
        lost ||
        document.hidden ||
        reduced.matches ||
        !visualizer
      )
        return;
      if (latest.current.preset !== requested)
        void choosePreset(latest.current.preset);
      if (!active) return;
      const dt = last ? (stamp - last) / 1000 : 1 / fps;
      if (last && dt < 1 / fps) {
        raf = requestAnimationFrame(draw);
        return;
      }
      last = stamp;
      const { motion, energy } = latest.current.controls;
      // elapsedTime is a frame delta in Butterchurn 2.6.7, not an absolute clock.
      const elapsed = Math.max(0.001, (Math.min(0.1, dt) * motion) / 50);
      time += elapsed;
      writeAmbientDrive(left, right, time, energy);
      try {
        const start = performance.now();
        visualizer.render({ elapsedTime: elapsed, audioLevels });
        if (frames === 0 && gl.getError() !== gl.NO_ERROR)
          throw new Error("Renderer unavailable");
        frames++;
        element.dataset.frame = String(frames);
        if (performance.now() - start > 45 && ++slow > 16 && budget > 60000) {
          budget = Math.max(60000, budget * 0.7);
          fps = Math.min(15, fps);
          slow = 0;
          size();
        }
        status("ready");
      } catch {
        fail();
        return;
      }
      if (motion > 0) raf = requestAnimationFrame(draw);
    };
    function wake() {
      if (
        !disposed &&
        !failed &&
        !lost &&
        !reduced.matches &&
        !document.hidden &&
        visualizer &&
        !raf
      )
        raf = requestAnimationFrame(draw);
    }
    wakeRef.current = wake;
    const initialize = async () => {
      if (disposed || reduced.matches) return;
      const ticket = ++initialization;
      try {
        const { default: butterchurn } = await import("butterchurn");
        if (
          disposed ||
          ticket !== initialization ||
          reduced.matches ||
          gl.isContextLost()
        )
          return;
        size();
        visualizer = butterchurn.createVisualizer(null, element, {
          width,
          height,
          meshWidth: 32,
          meshHeight: 24,
          pixelRatio: 1,
          textureRatio: 1,
        });
        failed = false;
        lost = false;
        frames = 0;
        active = null;
        requested = null;
        await choosePreset(latest.current.preset);
      } catch {
        if (!disposed && ticket === initialization && !reduced.matches) fail();
      }
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      request++;
      initialization++;
      visualizer = null;
      stop();
      status("fallback");
    };
    const contextRestored = () => {
      lost = false;
      failed = false;
      status("loading");
      void initialize();
    };
    const visibility = () => {
      if (document.hidden) stop();
      else wake();
    };
    const motionPreference = () => {
      stop();
      if (reduced.matches) {
        initialization++;
        status("reduced");
      } else if (visualizer && !failed && !lost) wake();
      else {
        status("loading");
        void initialize();
      }
    };
    const observer = new ResizeObserver(() => {
      if (disposed || lost || failed) return;
      try {
        size();
        wake();
      } catch {
        fail();
      }
    });
    observer.observe(element);
    element.addEventListener("webglcontextlost", contextLost);
    element.addEventListener("webglcontextrestored", contextRestored);
    document.addEventListener("visibilitychange", visibility);
    reduced.addEventListener("change", motionPreference);
    void initialize();
    return () => {
      disposed = true;
      request++;
      initialization++;
      stop();
      wakeRef.current = () => {};
      observer.disconnect();
      element.removeEventListener("webglcontextlost", contextLost);
      element.removeEventListener("webglcontextrestored", contextRestored);
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", motionPreference);
      visualizer = null;
      // Butterchurn 2.x has no destroy API. Losing this owned context releases all
      // of its textures, framebuffers, programs, and buffers together.
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);
  return (
    <canvas
      ref={canvas}
      className="milkdrop-canvas"
      aria-hidden="true"
      style={{ filter: `brightness(${props.controls.brightness / 100})` }}
    />
  );
}
export default memo(MilkdropCanvas);
