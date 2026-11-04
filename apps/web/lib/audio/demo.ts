// An original eight-second test loop, synthesized locally. No song is downloaded.
export const demoSeconds = 8;
const demoChords = [
  [110, 130.8128, 164.8138, 196],
  [87.3071, 110, 130.8128, 164.8138],
  [130.8128, 164.8138, 196, 246.9417],
  [97.9989, 123.4708, 146.8324, 174.6141],
];

export function demoSample(time: number): number {
  const chord = demoChords[Math.floor(time / 2) % 4];
  const beat = time % 0.5;
  const bar = time % 2;
  const envelope = Math.min(1, bar / 0.04) * Math.min(1, (2 - bar) / 0.18);
  const pad =
    chord.reduce(
      (sum, hz, i) => sum + Math.sin(2 * Math.PI * hz * time + i * 0.2),
      0,
    ) *
    0.055 *
    envelope;
  const pluckHz = chord[Math.floor(time * 4) % 4] * 4;
  const pluck =
    Math.sin(2 * Math.PI * pluckHz * (time % 0.25)) *
    Math.exp(-(time % 0.25) * 22) *
    0.14;
  const kick =
    Math.sin(2 * Math.PI * (48 * beat + 2.4 * (1 - Math.exp(-beat * 35)))) *
    Math.exp(-beat * 18) *
    0.25;
  const hat =
    Math.sin(time * 31243) *
    Math.sin(time * 18157) *
    Math.exp(-beat * 80) *
    0.06;
  const fade =
    Math.min(1, time / 0.015) * Math.min(1, (demoSeconds - time) / 0.02);
  return Math.max(-0.8, Math.min(0.8, (pad + pluck + kick + hat) * fade));
}
