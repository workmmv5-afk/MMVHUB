import React from 'react';
import { Type } from 'lucide-react';
import type { HubPreferences } from '../types';
import {
  FONT_SCALES,
  MONO_FONTS,
  SANS_FONTS,
  resolveTypography,
} from '../lib/typography';

interface Props {
  preferences: HubPreferences;
  updatePreferences: (patch: Partial<HubPreferences>) => Promise<void>;
}

const chip = (active: boolean) =>
  `min-h-[40px] px-3 rounded-xl border text-left transition-colors ${
    active
      ? 'hub-bg-soft border-transparent'
      : 'border-[#DADCE0] dark:border-[#444746] text-[#444746] dark:text-[#C4C7C5] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]'
  }`;

export const TypographySettings: React.FC<Props> = ({
  preferences,
  updatePreferences,
}) => {
  const t = resolveTypography(preferences);

  return (
    <section
      id="settings-typography"
      className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-5 sm:p-6 space-y-4 scroll-mt-20"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#1F1F1F] dark:text-[#E3E3E3]">
          <Type className="w-4 h-4 hub-text-accent" />
          Typography
        </h2>
        <button
          type="button"
          onClick={() =>
            void updatePreferences({
              fontSans: undefined,
              fontMono: undefined,
              fontScale: undefined,
            })
          }
          className="min-h-[32px] px-3 rounded-full text-[11px] font-medium text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]"
        >
          Reset
        </button>
      </div>

      <div className="space-y-1.5">
        <span className="block text-[11px] font-medium text-[#444746] dark:text-[#C4C7C5]">
          Text font
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SANS_FONTS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={t.sans === f.id}
              onClick={() => void updatePreferences({ fontSans: f.id })}
              className={chip(t.sans === f.id)}
              style={{ fontFamily: f.stack }}
            >
              <span className="block text-sm font-medium">{f.label}</span>
              <span className="block text-[11px] opacity-75">Aa 123</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="block text-[11px] font-medium text-[#444746] dark:text-[#C4C7C5]">
          Numbers & code font
        </span>
        <div className="grid grid-cols-2 gap-2">
          {MONO_FONTS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={t.mono === f.id}
              onClick={() => void updatePreferences({ fontMono: f.id })}
              className={chip(t.mono === f.id)}
              style={{ fontFamily: f.stack }}
            >
              <span className="block text-sm">{f.label}</span>
              <span className="block text-[11px] opacity-75 tabular-nums">$1,280.50</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="block text-[11px] font-medium text-[#444746] dark:text-[#C4C7C5]">
          Size
        </span>
        <div
          role="radiogroup"
          aria-label="Text size"
          className="grid grid-cols-4 p-1 rounded-full bg-[#F1F3F4] dark:bg-[#282A2C]"
        >
          {FONT_SCALES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={t.scale === s.id}
              onClick={() => void updatePreferences({ fontScale: s.id })}
              className={`min-h-[34px] rounded-full text-xs font-semibold transition-colors ${
                t.scale === s.id
                  ? 'bg-white dark:bg-[#1E1F20] text-[#202124] dark:text-[#E8EAED] shadow-2xs'
                  : 'text-[#5F6368] dark:text-[#9AA0A6]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
