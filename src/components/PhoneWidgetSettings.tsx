import React from 'react';
import { Smartphone } from 'lucide-react';
import type { HubPreferences, PhoneWidgetConfig } from '../types';
import { resolvePhoneWidgets } from '../lib/widgetSnapshot';
import { isNative } from '../lib/native';

interface Props {
  preferences: HubPreferences;
  updatePreferences: (
    patch: Partial<HubPreferences> | ((prev: HubPreferences) => Partial<HubPreferences>)
  ) => Promise<void>;
}

const ACCENTS: { id: NonNullable<PhoneWidgetConfig['accent']>; color: string; label: string }[] = [
  { id: 'app', color: 'var(--hub-accent)', label: 'App theme' },
  { id: 'blue', color: '#1A73E8', label: 'Blue' },
  { id: 'green', color: '#188038', label: 'Green' },
  { id: 'purple', color: '#6750A4', label: 'Purple' },
  { id: 'amber', color: '#E37400', label: 'Amber' },
  { id: 'red', color: '#D93025', label: 'Red' },
];

const label = 'block text-[11px] font-medium text-[#444746] dark:text-[#C4C7C5]';
const seg = (on: boolean) =>
  `min-h-[32px] rounded-full text-xs font-medium transition-colors ${
    on
      ? 'bg-white dark:bg-[#1E1F20] text-[#202124] dark:text-[#E8EAED] shadow-2xs'
      : 'text-[#5F6368] dark:text-[#9AA0A6]'
  }`;
const chip = (on: boolean) =>
  `min-h-[34px] px-3 rounded-full text-xs font-medium border transition-colors ${
    on
      ? 'hub-bg-soft border-transparent'
      : 'border-[#DADCE0] dark:border-[#444746] text-[#5F6368] dark:text-[#9AA0A6]'
  }`;

export const PhoneWidgetSettings: React.FC<Props> = ({ preferences, updatePreferences }) => {
  const c = resolvePhoneWidgets(preferences);
  const patch = (next: Partial<PhoneWidgetConfig>) =>
    void updatePreferences((prev) => ({
      phoneWidgets: { ...prev.phoneWidgets, ...next },
    }));
  const patchQuick = (key: keyof NonNullable<PhoneWidgetConfig['quick']>) =>
    void updatePreferences((prev) => {
      const cur = resolvePhoneWidgets(prev).quick;
      return { phoneWidgets: { ...prev.phoneWidgets, quick: { ...cur, [key]: !cur[key] } } };
    });

  const accentColor = ACCENTS.find((a) => a.id === c.accent)?.color ?? 'var(--hub-accent)';
  const previewDark =
    c.theme === 'dark' ||
    (c.theme === 'system' && document.documentElement.classList.contains('dark'));

  return (
    <section
      id="settings-phone-widgets"
      className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-5 sm:p-6 space-y-4 scroll-mt-20"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#1F1F1F] dark:text-[#E3E3E3]">
          <Smartphone className="w-4 h-4 hub-text-accent" />
          Phone Widgets
        </h2>
        <button
          type="button"
          onClick={() => void updatePreferences({ phoneWidgets: undefined })}
          className="min-h-[32px] px-3 rounded-full text-[11px] font-medium text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]"
        >
          Reset
        </button>
      </div>
      {!isNative() && (
        <p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6] -mt-2">
          Applies to home-screen widgets in the Android app.
        </p>
      )}

      {/* Live preview */}
      <div className="rounded-2xl p-4 bg-[linear-gradient(135deg,#8AB4F8,#D0BCFF)] dark:bg-[linear-gradient(135deg,#1A3A6B,#3A2A6B)]">
        <div
          className="rounded-[18px] px-4 py-3 space-y-1.5 max-w-[280px] mx-auto"
          style={{
            backgroundColor: previewDark
              ? `rgba(30,31,32,${c.opacity / 100})`
              : `rgba(255,255,255,${c.opacity / 100})`,
            color: previewDark ? '#E8EAED' : '#202124',
          }}
        >
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>{c.todayTitle}</span>
            <span className="font-mono text-xs" style={{ color: accentColor }}>
              2/5
            </span>
          </div>
          <div className="h-1 rounded-full bg-black/10 overflow-hidden">
            <div className="h-full w-2/5" style={{ backgroundColor: accentColor }} />
          </div>
          {['Pay rent', 'Read 20 pages', 'Team sync 3:00 PM', 'Gym', 'Call mom']
            .slice(0, c.rows)
            .map((t, i) => (
              <p key={t} className="text-xs flex items-center gap-2">
                <span style={{ color: accentColor }}>{i === 1 ? '◇' : '○'}</span>
                {t}
              </p>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <span className={label}>Theme</span>
          <div className="grid grid-cols-3 p-1 rounded-full bg-[#F1F3F4] dark:bg-[#282A2C]">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button key={t} type="button" onClick={() => patch({ theme: t })} className={`${seg(c.theme === t)} capitalize`}>
                {t === 'system' ? 'Auto' : t}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="pw-opacity" className={label}>
            Background · {c.opacity}%
          </label>
          <input
            id="pw-opacity"
            type="range"
            min={0}
            max={100}
            step={5}
            value={c.opacity}
            onChange={(e) => patch({ opacity: Number(e.target.value) })}
            className="w-full accent-[var(--hub-accent)]"
          />
        </div>

        <div className="space-y-1.5">
          <span className={label}>Accent</span>
          <div className="flex items-center gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-label={a.label}
                aria-pressed={c.accent === a.id}
                title={a.label}
                onClick={() => patch({ accent: a.id })}
                className={`w-7 h-7 rounded-full border border-black/10 ${
                  c.accent === a.id ? 'ring-2 ring-offset-2 ring-[#202124] dark:ring-[#E8EAED] dark:ring-offset-[#1E1F20]' : ''
                }`}
                style={{ background: a.color }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className={label}>Today rows</span>
          <div className="grid grid-cols-5 p-1 rounded-full bg-[#F1F3F4] dark:bg-[#282A2C]">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => patch({ rows: n })} className={seg(c.rows === n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className={label}>Today shows</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={chip(c.todayTasks)} onClick={() => patch({ todayTasks: !c.todayTasks })}>Tasks</button>
          <button type="button" className={chip(c.todayHabits)} onClick={() => patch({ todayHabits: !c.todayHabits })}>Habits</button>
          <button type="button" className={chip(c.todayEvents)} onClick={() => patch({ todayEvents: !c.todayEvents })}>Events</button>
          <button type="button" className={chip(c.todayDoneItems)} onClick={() => patch({ todayDoneItems: !c.todayDoneItems })}>Completed</button>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className={label}>Quick-add buttons</span>
        <div className="flex flex-wrap gap-2">
          {(['task', 'purchase', 'habit', 'event'] as const).map((k) => (
            <button key={k} type="button" className={`${chip(c.quick[k])} capitalize`} onClick={() => patchQuick(k)}>
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="pw-title" className={label}>
            Today title
          </label>
          <input
            id="pw-title"
            type="text"
            maxLength={24}
            defaultValue={c.todayTitle}
            onBlur={(e) => patch({ todayTitle: e.target.value.trim() || 'Today' })}
            className="w-full min-h-[40px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3 text-sm"
          />
        </div>
        <div className="flex flex-col justify-end gap-2">
          <button type="button" className={chip(c.hideAmounts)} onClick={() => patch({ hideAmounts: !c.hideAmounts })}>
            {c.hideAmounts ? '✓ ' : ''}Hide amounts
          </button>
          <button type="button" className={chip(c.hideWhenLocked)} onClick={() => patch({ hideWhenLocked: !c.hideWhenLocked })}>
            {c.hideWhenLocked ? '✓ ' : ''}Hide when locked
          </button>
        </div>
      </div>
    </section>
  );
};
