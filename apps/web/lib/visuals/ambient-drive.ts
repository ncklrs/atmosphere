// A continuous, non-beat animation signal. This is never connected to audio output
// and never represents the music playing on the WiiM.
export function writeAmbientDrive(
  left: Uint8Array,
  right: Uint8Array,
  time: number,
  energy: number,
) {
  const gain = Math.max(0, Math.min(100, energy)) / 100;
  for (let i = 0; i < left.length; i++) {
    const x = (i / left.length) * Math.PI * 2;
    const low = Math.sin(x * 4 + time * 0.19) * 24;
    const mid = Math.sin(x * 27 - time * 0.31) * 14;
    const high = Math.sin(x * 113 + time * 0.23) * 8;
    left[i] = Math.round(128 + (low + mid + high) * gain);
    right[i] = Math.round(
      128 + (low + Math.sin(x * 31 + time * 0.27) * 14 + high) * gain,
    );
  }
}
