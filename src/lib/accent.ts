/** Custom accent: derive Material-style light & dark tones from one seed colour. */

const STORAGE_KEY = 'mmv_hub_custom_accent';
const STYLE_ID = 'hub-custom-accent';

type RGB = [number, number, number];

const hexToRgb = (hex: string): RGB | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = ([r, g, b]: RGB) =>
  `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const luminance = ([r, g, b]: RGB) => {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

export function isValidHex(hex: string): boolean {
  return hexToRgb(hex) !== null;
}

export function buildAccentCss(hex: string): string | null {
  const seed = hexToRgb(hex);
  if (!seed) return null;
  // Keep the light-mode accent dark enough for white text / readable links
  let light = seed;
  while (luminance(light) > 0.3) light = mix(light, BLACK, 0.12);
  const lightFg = luminance(light) > 0.45 ? '#202124' : '#FFFFFF';
  let dark = mix(seed, WHITE, 0.35);
  while (luminance(dark) < 0.35) dark = mix(dark, WHITE, 0.15);
  return `:root[data-accent="custom"]{--hub-accent:${toHex(light)};--hub-accent-fg:${lightFg};--hub-accent-soft:${toHex(mix(seed, WHITE, 0.82))};--hub-accent-soft-fg:${toHex(mix(light, BLACK, 0.55))}}
.dark[data-accent="custom"]{--hub-accent:${toHex(dark)};--hub-accent-fg:${toHex(mix(seed, BLACK, 0.75))};--hub-accent-soft:${toHex(mix(seed, BLACK, 0.6))};--hub-accent-soft-fg:${toHex(mix(seed, WHITE, 0.82))}}`;
}

export function applyCustomAccent(hex: string | undefined): void {
  const css = hex ? buildAccentCss(hex) : null;
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!css) {
    el?.remove();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    return;
  }
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
  try {
    localStorage.setItem(STORAGE_KEY, css);
  } catch {
    // ignore
  }
}
