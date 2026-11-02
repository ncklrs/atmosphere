export const colors = {
  surface: "#101014",
  foreground: "#F3F0EA",
  accent: "#C7B4FF",
  rose: "#A16C81",
  copper: "#D5A28A",
};
export const palettes = [
  ["#C7B4FF", "#6b405e", "#201d36"],
  ["#efbc89", "#a0513c", "#281a25"],
  ["#b4d6ce", "#457570", "#152329"],
  ["#9ab8fa", "#304b84", "#101725"],
  ["#e7c581", "#80613e", "#241b24"],
  ["#9ecfff", "#256a7e", "#111c31"],
];
export function trackPaletteIndex(key: string) {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++)
    hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return (hash >>> 0) % palettes.length;
}
