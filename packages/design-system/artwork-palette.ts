export type Palette = readonly [string, string, string];
export function artworkPalette(pixels: ArrayLike<number>): Palette | null {
  const buckets = new Map<
    number,
    { count: number; r: number; g: number; b: number }
  >();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const r = pixels[i],
      g = pixels[i + 1],
      b = pixels[i + 2];
    if (pixels[i + 3] < 128 || Math.max(r, g, b) < 18) continue;
    const key = (r >> 4) * 256 + (g >> 4) * 16 + (b >> 4);
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count++;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }
  let best: { count: number; r: number; g: number; b: number } | undefined;
  let bestScore = 0;
  for (const bucket of buckets.values()) {
    const max = Math.max(bucket.r, bucket.g, bucket.b) / bucket.count;
    const min = Math.min(bucket.r, bucket.g, bucket.b) / bucket.count;
    const score = bucket.count * (0.2 + (max - min) / 255);
    if (score > bestScore) {
      bestScore = score;
      best = bucket;
    }
  }
  if (!best) return null;
  const rgb = [best.r / best.count, best.g / best.count, best.b / best.count];
  const hex = (values: number[]) =>
    "#" +
    values
      .map((v) =>
        Math.round(Math.max(0, Math.min(255, v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  const luminance = (rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722) / 255;
  const lift = Math.max(0, (0.72 - luminance) / (1 - luminance));
  return [
    hex(rgb.map((v) => v + (255 - v) * lift)),
    hex(rgb),
    hex(rgb.map((v) => v * 0.18)),
  ];
}
