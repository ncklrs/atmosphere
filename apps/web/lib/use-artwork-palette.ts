"use client";
import { useEffect, useState } from "react";
import { safeArtworkUrl } from "../../../packages/playback-core/artwork";
import {
  artworkPalette,
  type Palette,
} from "../../../packages/design-system/artwork-palette";
const cache = new Map<string, Promise<Palette | null>>();
function readPalette(url: string): Promise<Palette | null> {
  const cached = cache.get(url);
  if (cached) return cached;
  const pending = new Promise<Palette | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    const finish = (palette: Palette | null) => {
      clearTimeout(timer);
      image.onload = image.onerror = null;
      resolve(palette);
    };
    const timer = setTimeout(() => {
      image.src = "";
      finish(null);
    }, 3000);
    image.onerror = () => finish(null);
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 48;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return finish(null);
        ctx.drawImage(image, 0, 0, 48, 48);
        finish(artworkPalette(ctx.getImageData(0, 0, 48, 48).data));
      } catch {
        finish(null);
      }
    };
    image.src = url;
  });
  if (cache.size >= 64) cache.delete(cache.keys().next().value!);
  cache.set(url, pending);
  return pending;
}
export function useArtworkPalette(artworkUrl: string | null) {
  const url = safeArtworkUrl(artworkUrl);
  const [result, setResult] = useState<{
    url: string;
    palette: Palette | null;
  } | null>(null);
  useEffect(() => {
    if (!url) return;
    let disposed = false;
    void readPalette(url).then((palette) => {
      if (!disposed) setResult({ url, palette });
    });
    return () => {
      disposed = true;
    };
  }, [url]);
  return result?.url === url ? result.palette : null;
}
