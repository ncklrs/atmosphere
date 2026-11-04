import type { AudioAnalyzer } from "waviz/core";
import { demoSample, demoSeconds } from "./demo";
export type AudioPhase =
  | "idle"
  | "loading"
  | "demo"
  | "file"
  | "microphone"
  | "paused"
  | "error";
export interface AudioState {
  phase: AudioPhase;
  label: string;
  error: string;
  volume: number;
}
const initialState: AudioState = {
  phase: "idle",
  label: "Ambient preview",
  error: "",
  volume: 12,
};
export class AudioSession {
  analyzer: AudioAnalyzer | null = null;
  private state = initialState;
  private listeners = new Set<() => void>();
  private generation = 0;
  private context: AudioContext | null = null;
  private source: AudioNode | null = null;
  private demo: AudioBufferSourceNode | null = null;
  private output: GainNode | null = null;
  private stream: MediaStream | null = null;
  private element: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.state;
  getServerSnapshot = () => initialState;
  private update(patch: Partial<AudioState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  stop = () => {
    this.generation++;
    if (this.element) {
      this.element.onpause = this.element.onended = this.element.onerror = null;
      this.element.pause();
      this.element.removeAttribute("src");
      this.element.load();
      this.element = null;
    }
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    this.stream = null;
    try {
      this.demo?.stop();
    } catch {
      /* Already ended. */
    }
    this.demo = null;
    this.source?.disconnect();
    this.source = null;
    this.analyzer?.analyserNode?.disconnect();
    this.analyzer = null;
    this.output?.disconnect();
    this.output = null;
    if (this.context && this.context.state !== "closed")
      void this.context.close().catch(() => {});
    this.context = null;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.update({ phase: "idle", label: "Ambient preview", error: "" });
  };
  setVolume = (volume: number) => {
    const value = Number.isFinite(volume)
      ? Math.max(0, Math.min(100, volume))
      : 12;
    this.update({ volume: value });
    if (this.output && this.context)
      this.output.gain.setTargetAtTime(
        value / 100,
        this.context.currentTime,
        0.025,
      );
  };
  private begin(label: string) {
    this.stop();
    this.update({ phase: "loading", label });
    const ticket = this.generation;
    const context = new AudioContext();
    this.context = context;
    // resume() is called during the user's gesture, before any module fetch.
    const resumed = context.resume();
    void resumed.catch(() => {});
    return { ticket, context, resumed };
  }
  private async analyze(
    context: AudioContext,
    source: AudioNode,
    ticket: number,
    resumed: Promise<void>,
  ) {
    const [{ AudioAnalyzer }] = await Promise.all([
      import("waviz/core"),
      resumed,
    ]);
    if (ticket !== this.generation) return false;
    const analyzer = new AudioAnalyzer();
    analyzer.startAnalysis(context, source);
    this.source = source;
    this.analyzer = analyzer;
    return true;
  }
  private listen(context: AudioContext, source: AudioNode) {
    const output = context.createGain();
    output.gain.value = this.state.volume / 100;
    source.connect(output);
    output.connect(context.destination);
    this.output = output;
  }
  private failure(ticket: number, error: unknown) {
    if (ticket !== this.generation) return;
    const name = error instanceof Error ? error.name : "";
    const message =
      name === "NotAllowedError"
        ? "Audio access was not allowed. You can try again or use a local audio file."
        : name === "NotFoundError"
          ? "No microphone was found. Try a local audio file."
          : "Could not start this audio source. Try another file or input.";
    this.stop();
    this.update({ phase: "error", label: "Audio unavailable", error: message });
  }
  startDemo = async () => {
    let ticket = this.generation + 1;
    try {
      const setup = this.begin("Original test loop");
      ticket = setup.ticket;
      const { context, resumed } = setup;
      const source = context.createBufferSource();
      this.demo = source;
      if (!(await this.analyze(context, source, ticket, resumed))) return;
      const buffer = context.createBuffer(
        1,
        Math.round(context.sampleRate * demoSeconds),
        context.sampleRate,
      );
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = demoSample(i / context.sampleRate);
      source.buffer = buffer;
      source.loop = true;
      this.listen(context, source);
      source.start();
      this.update({ phase: "demo", label: "Original test loop", error: "" });
    } catch (error) {
      this.failure(ticket, error);
    }
  };
  startFile = async (file: File) => {
    let ticket = this.generation + 1;
    try {
      if (file.size > 100 * 1024 * 1024) {
        this.stop();
        this.update({
          phase: "error",
          error: "Choose an audio file smaller than 100 MB.",
        });
        return;
      }
      const setup = this.begin(file.name);
      ticket = setup.ticket;
      const { context, resumed } = setup;
      this.objectUrl = URL.createObjectURL(file);
      const element = new Audio(this.objectUrl);
      this.element = element;
      const source = context.createMediaElementSource(element);
      this.source = source;
      this.listen(context, source);
      const play = element.play();
      const [analyzed] = await Promise.all([
        this.analyze(context, source, ticket, resumed),
        play,
      ]);
      if (!analyzed) return;
      if (ticket !== this.generation) return;
      element.onpause = () => {
        if (ticket === this.generation) this.update({ phase: "paused" });
      };
      element.onended = () => {
        if (ticket === this.generation) this.update({ phase: "paused" });
      };
      element.onerror = () =>
        this.failure(ticket, new Error("Unsupported audio"));
      this.update({ phase: "file", label: file.name, error: "" });
    } catch (error) {
      this.failure(ticket, error);
    }
  };
  toggleFile = async () => {
    const element = this.element,
      context = this.context,
      ticket = this.generation;
    if (!element || !context) return;
    if (!element.paused) {
      element.pause();
      return;
    }
    try {
      await Promise.all([element.play(), context.resume()]);
      if (ticket === this.generation) this.update({ phase: "file" });
    } catch (error) {
      this.failure(ticket, error);
    }
  };
  startMicrophone = async () => {
    let ticket = this.generation + 1;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        this.stop();
        this.update({
          phase: "error",
          error:
            "Microphone input needs localhost or HTTPS and a browser with audio capture. Local-file playback is available here.",
        });
        return;
      }
      const setup = this.begin("Room microphone");
      ticket = setup.ticket;
      const { context, resumed } = setup;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      if (ticket !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      stream.getTracks().forEach((track) => {
        track.onended = () => {
          if (ticket === this.generation) this.stop();
        };
      });
      const source = context.createMediaStreamSource(stream);
      this.source = source;
      if (!(await this.analyze(context, source, ticket, resumed))) return;
      // Microphone input is analyzed locally and NEVER connected to speakers.
      this.update({ phase: "microphone", label: "Room microphone", error: "" });
    } catch (error) {
      this.failure(ticket, error);
    }
  };
}
