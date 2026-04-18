export const hexToRgba = (hex: string, alpha: number): string => {
  const h = (hex || '#999999').replace('#', '');
  if (h.length !== 6) return `rgba(161,161,170,${alpha})`;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

// Standard tint levels used across the app
export const tint = {
  subtle: (hex: string) => hexToRgba(hex, 0.10),  // hover states, backgrounds
  soft: (hex: string) => hexToRgba(hex, 0.22),    // time block fills, chip backgrounds
  strong: (hex: string) => hexToRgba(hex, 0.40),  // selected/active states
  bar: (hex: string) => hex,                      // solid accents (left bar of block)
};
