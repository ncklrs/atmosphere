// Mirror logarithmic frequency bands around the halo. Silence stays at zero;
// Waviz's stock frequency normalizer subtracts 0.5, which creates false spokes.
export function haloSpectrum(
  data: Uint8Array,
  response: number,
  excursion: number,
): number[] {
  const bands = Array.from({ length: 24 }, (_, index) => {
    const start = Math.max(
      0,
      Math.floor(Math.pow(Math.max(1, data.length), index / 24)) - 1,
    );
    const end = Math.min(
      data.length,
      Math.max(
        start + 1,
        Math.floor(Math.pow(Math.max(1, data.length), (index + 1) / 24)),
      ),
    );
    let sum = 0;
    for (let bin = start; bin < end; bin++) sum += data[bin];
    return (
      Math.min(1, (sum / Math.max(1, end - start) / 255) * response * 0.7) *
      excursion
    );
  });
  const reverse = [...bands].reverse();
  return [...bands, ...reverse, ...bands, ...reverse];
}
