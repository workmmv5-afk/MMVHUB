import React from 'react';
import { Type } from 'lucide-react';
import type { HubPreferences } from '../types';
import {
  FONT_SCALES,
  MONO_FONTS,
  SANS_FONTS,
  resolveTypography,
} from '../lib/typography';
import { Dropdown } from './Dropdown';
import { LANGUAGES, t as tr } from '../lib/i18n';
import { isNative } from '../lib/native';

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
          {tr('settings.typography')}
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
          {tr('lite.interface')}
        </span>
        <div role="radiogroup" className="grid grid-cols-2 p-1 rounded-full bg-[#F1F3F4] dark:bg-[#282A2C]">
          {([false, true] as const).map((isLite) => {
            const on = Boolean(preferences.liteMode) === isLite;
            return (
              <button
                key={String(isLite)}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => void updatePreferences({ liteMode: isLite, uiModeChosen: true })}
                className={`min-h-[34px] rounded-full text-xs font-semibold ${
                  on ? 'bg-white dark:bg-[#1E1F20] text-[#202124] dark:text-[#E8EAED] shadow-2xs' : 'text-[#5F6368] dark:text-[#9AA0A6]'
                }`}
              >
                {tr(isLite ? 'lite.chooseLite' : 'lite.chooseFull')}
              </button>
            );
          })}
        </div>
      </div>

      <Dropdown
        label={tr('settings.language')}
        value={preferences.language ?? 'system'}
        options={LANGUAGES.map((l) => ({
          value: l.id,
          label: l.id === 'system' ? tr('settings.languageSystem') : l.label,
        }))}
        onChange={(language) => void updatePreferences({ language })}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Dropdown
          label="Text font"
          value={t.sans}
          options={SANS_FONTS.map((f) => ({ value: f.id, label: f.label, style: { fontFamily: f.stack } }))}
          onChange={(fontSans) => void updatePreferences({ fontSans })}
        />
        <Dropdown
          label="Numbers & code"
          value={t.mono}
          options={MONO_FONTS.map((f) => ({ value: f.id, label: f.label, style: { fontFamily: f.stack } }))}
          onChange={(fontMono) => void updatePreferences({ fontMono })}
        />
        <Dropdown
          label="Size"
          value={t.scale}
          options={FONT_SCALES.map((s) => ({
            value: s.id,
            label: { S: "Small", M: "Default", L: "Large", XL: "Extra large" }[s.label] ?? s.label,
          }))}
          onChange={(fontScale) => void updatePreferences({ fontScale })}
        />
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={preferences.haptics ?? isNative()}
        onClick={() => void updatePreferences({ haptics: !(preferences.haptics ?? isNative()) })}
        className={chip(preferences.haptics ?? isNative()) + ' w-full flex items-center justify-between'}
      >
        <span className="text-xs font-medium">Haptic feedback</span>
        <span className="text-xs">{preferences.haptics ?? isNative() ? 'On' : 'Off'}</span>
      </button>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <span className="block text-[11px] font-medium text-[#444746] dark:text-[#C4C7C5]">
            Clock
          </span>
          <div className="grid grid-cols-2 p-1 rounded-full bg-[#F1F3F4] dark:bg-[#282A2C]">
            {(['12h', '24h'] as const).map((c) => {
              const on = (preferences.clockFormat ?? '12h') === c;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => void updatePreferences({ clockFormat: c })}
                  className={`min-h-[32px] rounded-full text-xs font-semibold ${
                    on
                      ? 'bg-white dark:bg-[#1E1F20] text-[#202124] dark:text-[#E8EAED] shadow-2xs'
                      : 'text-[#5F6368] dark:text-[#9AA0A6]'
                  }`}
                >
                  {c === '12h' ? '2:30 PM' : '14:30'}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-1.5">
          <span className="block text-[11px] font-medium text-[#444746] dark:text-[#C4C7C5]">
            Date
          </span>
          <div className="grid grid-cols-3 p-1 rounded-full bg-[#F1F3F4] dark:bg-[#282A2C]">
            {(
              [
                ['mdy', 'Nov 20'],
                ['dmy', '20 Nov'],
                ['iso', '11-20'],
              ] as const
            ).map(([id, sample]) => {
              const on = (preferences.dateStyle ?? 'mdy') === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => void updatePreferences({ dateStyle: id })}
                  className={`min-h-[32px] rounded-full text-[11px] font-semibold ${
                    on
                      ? 'bg-white dark:bg-[#1E1F20] text-[#202124] dark:text-[#E8EAED] shadow-2xs'
                      : 'text-[#5F6368] dark:text-[#9AA0A6]'
                  }`}
                >
                  {sample}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
