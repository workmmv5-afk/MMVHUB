import type { HubPreferences, TypographyMono, TypographySans } from '../types';

interface FontOption<T extends string> {
  id: T;
  label: string;
  stack: string;
  /** Google Fonts css2 family query; omitted for system fonts. */
  gf?: string;
}

export const SANS_FONTS: FontOption<TypographySans>[] = [
  {
    id: 'poppins',
    label: 'Poppins',
    stack: '"Poppins", system-ui, -apple-system, "Segoe UI", sans-serif',
    gf: 'Poppins:wght@400;500;600;700',
  },
  {
    id: 'jakarta',
    label: 'Plus Jakarta Sans',
    stack: '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
    gf: 'Plus+Jakarta+Sans:wght@400;500;600;700',
  },
  {
    id: 'inter',
    label: 'Inter',
    stack: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
    gf: 'Inter:wght@400;500;600;700',
  },
  {
    id: 'roboto',
    label: 'Roboto',
    stack: '"Roboto", system-ui, -apple-system, "Segoe UI", sans-serif',
    gf: 'Roboto:wght@400;500;700',
  },
  {
    id: 'system',
    label: 'System',
    stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
];

export const MONO_FONTS: FontOption<TypographyMono>[] = [
  {
    id: 'google-sans-code',
    label: 'Google Sans Code',
    stack: '"Google Sans Code", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    gf: 'Google+Sans+Code:wght@400;500;600',
  },
  {
    id: 'jetbrains',
    label: 'JetBrains Mono',
    stack: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    gf: 'JetBrains+Mono:wght@400;500;600',
  },
  {
    id: 'roboto-mono',
    label: 'Roboto Mono',
    stack: '"Roboto Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    gf: 'Roboto+Mono:wght@400;500;600',
  },
  {
    id: 'system',
    label: 'System',
    stack: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
];

export const FONT_SCALES = [
  { id: 0.9, label: 'S' },
  { id: 1, label: 'M' },
  { id: 1.1, label: 'L' },
  { id: 1.2, label: 'XL' },
] as const;

export const DEFAULT_SANS: TypographySans = 'poppins';
export const DEFAULT_MONO: TypographyMono = 'google-sans-code';

const STORAGE_KEY = 'mmv_hub_typography';

export interface ResolvedTypography {
  sans: TypographySans;
  mono: TypographyMono;
  scale: number;
}

export function resolveTypography(
  prefs: Pick<HubPreferences, 'fontSans' | 'fontMono' | 'fontScale'>
): ResolvedTypography {
  const sans = SANS_FONTS.some((f) => f.id === prefs.fontSans)
    ? prefs.fontSans!
    : DEFAULT_SANS;
  const mono = MONO_FONTS.some((f) => f.id === prefs.fontMono)
    ? prefs.fontMono!
    : DEFAULT_MONO;
  const scale =
    typeof prefs.fontScale === 'number' &&
    prefs.fontScale >= 0.85 &&
    prefs.fontScale <= 1.25
      ? prefs.fontScale
      : 1;
  return { sans, mono, scale };
}

function ensureGoogleFont(gf?: string) {
  if (!gf || typeof document === 'undefined') return;
  const id = `gf-${gf.split(':')[0]}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${gf}&display=swap`;
  document.head.appendChild(link);
}

/** Apply fonts + scale to <html> and mirror to localStorage for flash-free boot. */
export function applyTypography(t: ResolvedTypography): void {
  const sans = SANS_FONTS.find((f) => f.id === t.sans) ?? SANS_FONTS[0];
  const mono = MONO_FONTS.find((f) => f.id === t.mono) ?? MONO_FONTS[0];
  ensureGoogleFont(sans.gf);
  ensureGoogleFont(mono.gf);
  const root = document.documentElement;
  root.style.setProperty('--font-sans', sans.stack);
  root.style.setProperty('--font-mono', mono.stack);
  root.style.fontSize = t.scale === 1 ? '' : `${t.scale * 100}%`;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ sans: sans.stack, mono: mono.stack, scale: t.scale, sgf: sans.gf, mgf: mono.gf })
    );
  } catch {
    // ignore
  }
}
