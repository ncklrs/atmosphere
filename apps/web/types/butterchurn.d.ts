declare module "butterchurn" {
  export interface Visualizer {
    loadPreset(preset: object, blendSeconds: number): void;
    setRendererSize(width: number, height: number): void;
    render(options: {
      elapsedTime: number;
      audioLevels: {
        timeByteArray: Uint8Array;
        timeByteArrayL: Uint8Array;
        timeByteArrayR: Uint8Array;
      };
    }): void;
  }
  const butterchurn: {
    createVisualizer(
      context: AudioContext | null,
      canvas: HTMLCanvasElement,
      options: {
        width: number;
        height: number;
        meshWidth: number;
        meshHeight: number;
        pixelRatio: number;
        textureRatio: number;
      },
    ): Visualizer;
  };
  export default butterchurn;
}
