export interface BrightnessCapabilities {
  software: boolean;
  hardware: boolean;
  power: boolean;
  readback: boolean;
}
export interface BrightnessAdapter {
  capabilities(): BrightnessCapabilities;
  apply(
    intensity: number,
  ): Promise<{ softwareIntensity: number; hardwareApplied: boolean }>;
}
export class SoftwareBrightness implements BrightnessAdapter {
  capabilities() {
    return { software: true, hardware: false, power: false, readback: false };
  }
  async apply(intensity: number) {
    return {
      softwareIntensity: Math.max(
        0,
        Math.min(1, Number.isFinite(intensity) ? intensity : 0),
      ),
      hardwareApplied: false,
    };
  }
}
