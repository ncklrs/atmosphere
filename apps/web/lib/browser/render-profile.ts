export function renderProfile(
  device: Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints">,
) {
  const tablet =
    /iPad|iPhone|iPod/.test(device.userAgent) ||
    (device.platform === "MacIntel" && device.maxTouchPoints > 1);
  return tablet
    ? { name: "tablet", pixels: 260000, soundPixels: 200000, fps: 24 }
    : { name: "desktop", pixels: 520000, soundPixels: 600000, fps: 32 };
}
