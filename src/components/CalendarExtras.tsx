import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { formatShortDate, formatTime12h, getTodayISO } from '../lib/format';
import type { CalendarColor, CalendarEventRecord } from '../types';

// ---------------------------------------------------------------- Year view

export const YearGlance: React.FC<{
  year: number;
  startsMonday: boolean;
  countFor: (iso: string) => number;
  onPickMonth: (monthKey: string) => void;
  onShiftYear: (delta: number) => void;
}> = ({ year, startsMonday, countFor, onPickMonth, onShiftYear }) => {
  const today = getTodayISO();
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, m) => {
        const first = new Date(year, m, 1);
        const offset = startsMonday ? (first.getDay() + 6) % 7 : first.getDay();
        const days = new Date(year, m + 1, 0).getDate();
        const cells: { iso: string; n: number }[] = [];
        for (let i = 0; i < offset; i++) cells.push({ iso: '', n: 0 });
        for (let d = 1; d <= days; d++) {
          const iso = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          cells.push({ iso, n: countFor(iso) });
        }
        return { m, label: first.toLocaleDateString('en-US', { month: 'short' }), cells };
      }),
    [year, startsMonday, countFor]
  );
  const shade = (n: number) =>
    n === 0 ? '' : n === 1 ? 'bg-[var(--hub-accent-soft)]' : n <= 3 ? 'bg-[var(--hub-accent)]/60' : 'hub-bg-accent';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-2">
        <button type="button" aria-label="Previous year" onClick={() => onShiftYear(-1)} className="min-h-[32px] min-w-[32px] rounded-lg flex items-center justify-center hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold tabular-nums">{year}</span>
        <button type="button" aria-label="Next year" onClick={() => onShiftYear(1)} className="min-h-[32px] min-w-[32px] rounded-lg flex items-center justify-center hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {months.map(({ m, label, cells }) => (
          <button
            key={m}
            type="button"
            onClick={() => onPickMonth(`${year}-${String(m + 1).padStart(2, '0')}`)}
            className="rounded-2xl border border-[#E8EAED] dark:border-[#3C4043] bg-white dark:bg-[#1E1F20] p-2.5 text-left hover:border-[var(--hub-accent)] transition-colors"
          >
            <p className="text-xs font-semibold mb-1.5">{label}</p>
            <div className="grid grid-cols-7 gap-[2px]">
              {cells.map((c, i) => (
                <span
                  key={i}
                  title={c.iso && c.n ? `${formatShortDate(c.iso)}: ${c.n}` : undefined}
                  className={`aspect-square rounded-[3px] text-[8px] leading-none flex items-center justify-center ${
                    c.iso === today ? 'ring-1 ring-[var(--hub-accent)]' : ''
                  } ${c.iso ? shade(c.n) || 'bg-[#F1F3F4] dark:bg-[#282A2C]' : ''}`}
                />
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------- Free-time finder

const toMin = (t?: string) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export const FreeTimeFinder: React.FC<{
  weekDates: string[];
  eventsFor: (iso: string) => CalendarEventRecord[];
  onBook: (iso: string, start: string) => void;
}> = ({ weekDates, eventsFor, onBook }) => {
  const [minLen, setMinLen] = useState(60);
  const [dayStart, dayEnd] = [8 * 60, 20 * 60];
  const now = new Date();
  const today = getTodayISO();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const slots = weekDates
    .filter((d) => d >= today)
    .map((iso) => {
      const busy = eventsFor(iso)
        .filter((e) => !e.allDay)
        .map((e) => [toMin(e.startTime) ?? 0, toMin(e.endTime) ?? (toMin(e.startTime) ?? 0) + 60] as [number, number])
        .sort((a, b) => a[0] - b[0]);
      const gaps: [number, number][] = [];
      let cursor = iso === today ? Math.max(dayStart, Math.ceil(nowMin / 15) * 15) : dayStart;
      for (const [s, e] of busy) {
        if (s - cursor >= minLen) gaps.push([cursor, s]);
        cursor = Math.max(cursor, e);
      }
      if (dayEnd - cursor >= minLen) gaps.push([cursor, dayEnd]);
      return { iso, gaps };
    });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-[#5F6368] dark:text-[#9AA0A6]">At least</span>
        {[30, 60, 120].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMinLen(m)}
            className={`min-h-[30px] px-3 rounded-full font-medium ${minLen === m ? 'hub-bg-soft' : 'border border-[#DADCE0] dark:border-[#444746]'}`}
          >
            {m >= 60 ? `${m / 60}h` : `${m}m`}
          </button>
        ))}
        <span className="text-[#5F6368] dark:text-[#9AA0A6]">· 8:00–20:00</span>
      </div>
      <div className="rounded-2xl border border-[#E8EAED] dark:border-[#3C4043] bg-white dark:bg-[#1E1F20] divide-y divide-[#F1F3F4] dark:divide-[#282A2C]">
        {slots.length === 0 && <p className="p-4 text-sm text-[#5F6368]">No days left this week.</p>}
        {slots.map(({ iso, gaps }) => (
          <div key={iso} className="p-3 flex flex-wrap items-center gap-2">
            <span className="w-20 text-xs font-semibold shrink-0">{iso === today ? 'Today' : formatShortDate(iso)}</span>
            {gaps.length === 0 ? (
              <span className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">Fully booked</span>
            ) : (
              gaps.map(([s, e]) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onBook(iso, toHHMM(s))}
                  className="min-h-[30px] px-2.5 rounded-full text-[11px] font-medium hub-bg-soft tabular-nums"
                  title="Create an event in this slot"
                >
                  {formatTime12h(toHHMM(s))}–{formatTime12h(toHHMM(e))}
                </button>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ----------------------------------------------------------- Colour labels

const COLORS: { id: CalendarColor; cls: string; fallback: string }[] = [
  { id: 'blue', cls: 'bg-[#0B57D0] dark:bg-[#A8C7FA]', fallback: 'Cobalt' },
  { id: 'green', cls: 'bg-[#146C2E] dark:bg-[#6DD58C]', fallback: 'Sage' },
  { id: 'amber', cls: 'bg-[#B06000] dark:bg-[#FCD663]', fallback: 'Amber' },
  { id: 'red', cls: 'bg-[#B3261E] dark:bg-[#F2B8B5]', fallback: 'Crimson' },
  { id: 'purple', cls: 'bg-[#6750A4] dark:bg-[#D0BCFF]', fallback: 'Plum' },
];

export function colorLabel(labels: Partial<Record<CalendarColor, string>> | undefined, c: CalendarColor) {
  return labels?.[c] || COLORS.find((x) => x.id === c)?.fallback || c;
}

export const ColorLabels: React.FC = () => {
  const { preferences, updatePreferences } = useVault();
  const [editing, setEditing] = useState(false);
  const labels = preferences.colorLabels ?? {};
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {COLORS.map((c) => (
        <span key={c.id} className="inline-flex items-center gap-1.5 text-[11px] text-[#444746] dark:text-[#C4C7C5]">
          <span className={`w-2.5 h-2.5 rounded-full ${c.cls}`} />
          {editing ? (
            <input
              defaultValue={labels[c.id] ?? ''}
              placeholder={c.fallback}
              maxLength={16}
              aria-label={`Label for ${c.fallback}`}
              onBlur={(e) =>
                void updatePreferences((prev) => ({
                  colorLabels: { ...prev.colorLabels, [c.id]: e.target.value.trim() || undefined },
                }))
              }
              className="w-20 min-h-[26px] rounded-md border border-[#DADCE0] dark:border-[#444746] bg-transparent px-1.5 text-[11px]"
            />
          ) : (
            colorLabel(labels, c.id)
          )}
        </span>
      ))}
      <button
        type="button"
        onClick={() => setEditing((v) => !v)}
        aria-label={editing ? 'Done editing labels' : 'Rename colour labels'}
        className="min-h-[26px] px-2 rounded-full text-[11px] text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C] inline-flex items-center gap-1"
      >
        <Pencil className="w-3 h-3" />
        {editing ? 'Done' : ''}
      </button>
    </div>
  );
};
