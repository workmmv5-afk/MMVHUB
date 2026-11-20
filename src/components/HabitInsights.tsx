import React, { useEffect, useMemo, useState } from 'react';
import { Play, Square, Trophy } from 'lucide-react';
import type { HabitRecord } from '../types';
import {
  calculateHabitStreak,
  getOffsetDateISO,
  getTodayISO,
  isHabitScheduledOnDate,
} from '../lib/format';
import { isNative } from '../lib/native';

const MILESTONES = [7, 21, 30, 66, 100, 365];

interface Props {
  habit: HabitRecord;
  allHabits: HabitRecord[];
  onJournal: (habitId: string, dateISO: string, text: string) => Promise<void>;
  onLog: (habitId: string, dateISO: string, count: number) => Promise<void>;
}

/** Trophies · year heatmap · 12-week trend · correlation · journal · timer */
export const HabitInsights: React.FC<Props> = ({ habit, allHabits, onJournal, onLog }) => {
  const today = getTodayISO();
  const { current, best } = calculateHabitStreak(habit.logs, habit.targetPerDay, habit);
  const done = (h: HabitRecord, d: string) => (h.logs[d] ?? 0) >= h.targetPerDay;

  // 365-day heatmap aligned to weeks (columns), Sunday-first rows
  const heat = useMemo(() => {
    const start = getOffsetDateISO(-364, today);
    const [y, m, d] = start.split('-').map(Number);
    const pad = new Date(y, m - 1, d).getDay();
    const cells: { iso: string; level: number }[] = [];
    for (let i = 0; i < pad; i++) cells.push({ iso: '', level: -1 });
    for (let i = 0; i < 365; i++) {
      const iso = getOffsetDateISO(i, start);
      const sched = isHabitScheduledOnDate(habit, iso);
      const count = habit.logs[iso] ?? 0;
      const level = count >= habit.targetPerDay ? 3 : count > 0 ? 2 : sched && iso < today ? 1 : 0;
      cells.push({ iso, level });
    }
    return cells;
  }, [habit, today]);

  // 12-week completion trend
  const weeks = useMemo(() => {
    const out: { label: string; pct: number }[] = [];
    for (let w = 11; w >= 0; w--) {
      let sched = 0;
      let ok = 0;
      for (let i = 0; i < 7; i++) {
        const iso = getOffsetDateISO(-(w * 7 + i), today);
        if (!isHabitScheduledOnDate(habit, iso)) continue;
        sched++;
        if (done(habit, iso)) ok++;
      }
      out.push({ label: getOffsetDateISO(-w * 7, today).slice(5), pct: sched ? Math.round((ok / sched) * 100) : 0 });
    }
    return out;
  }, [habit, today]);

  // Correlation: which other habit lifts this one most (last 90 days)
  const correlation = useMemo(() => {
    let bestLift: { name: string; lift: number; withPct: number } | null = null;
    for (const other of allHabits) {
      if (other.id === habit.id || other.archived) continue;
      let withN = 0, withOk = 0, withoutN = 0, withoutOk = 0;
      for (let i = 1; i <= 90; i++) {
        const iso = getOffsetDateISO(-i, today);
        if (!isHabitScheduledOnDate(habit, iso) || !isHabitScheduledOnDate(other, iso)) continue;
        if (done(other, iso)) {
          withN++;
          if (done(habit, iso)) withOk++;
        } else {
          withoutN++;
          if (done(habit, iso)) withoutOk++;
        }
      }
      if (withN < 8 || withoutN < 8) continue;
      const lift = withOk / withN - withoutOk / withoutN;
      if (lift > 0.15 && (!bestLift || lift > bestLift.lift)) {
        bestLift = { name: other.name, lift, withPct: Math.round((withOk / withN) * 100) };
      }
    }
    return bestLift;
  }, [habit, allHabits, today]);

  // Journal
  const [note, setNote] = useState(habit.journal?.[today] ?? '');
  const [nfcCopied, setNfcCopied] = useState(false);
  const recentNotes = Object.entries(habit.journal ?? {})
    .filter(([d]) => d !== today)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 4);

  // Timer for timed habits (minutes)
  const timed = habit.habitType === 'timed' || /min/i.test(habit.unit ?? '');
  const minutes = timed ? Math.max(1, habit.targetPerDay) : 0;
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      const s = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        setEndsAt(null);
        void onLog(habit.id, today, habit.targetPerDay);
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [endsAt, habit.id, habit.targetPerDay, onLog, today]);

  const LEVEL = [
    'bg-[#EBEDF0] dark:bg-[#2A2B2D]',
    'bg-[#FCE8E6] dark:bg-[#4A2020]',
    'bg-[var(--hub-accent-soft)]',
    'bg-[var(--hub-accent)]',
  ];

  return (
    <div className="space-y-4 pt-3 border-t border-[#E1E3E1] dark:border-[#444746]">
      <p className="text-xs font-semibold text-[#444746] dark:text-[#C4C7C5]">Insights</p>

      {/* Trophies */}
      <div className="flex flex-wrap items-center gap-1.5">
        {MILESTONES.map((m) => {
          const earned = best >= m;
          return (
            <span
              key={m}
              title={earned ? `Reached a ${m}-day streak` : `${m}-day streak`}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold ${
                earned ? 'hub-bg-soft' : 'bg-[#F1F3F4] dark:bg-[#282A2C] text-[#9AA0A6] opacity-60'
              }`}
            >
              <Trophy className="w-3 h-3" />
              {m}
            </span>
          );
        })}
        <span className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6] ml-1">
          Now {current}d · best {best}d
        </span>
      </div>

      {/* Year heatmap */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="grid grid-rows-7 grid-flow-col gap-[2px] w-max" aria-label="Last 365 days">
          {heat.map((c, i) => (
            <span
              key={i}
              title={c.iso || undefined}
              className={`w-[9px] h-[9px] rounded-[2px] ${c.level < 0 ? 'opacity-0' : LEVEL[c.level]}`}
            />
          ))}
        </div>
      </div>

      {/* 12-week trend */}
      <div className="flex items-end gap-1 h-14" aria-label="Weekly completion, last 12 weeks">
        {weeks.map((w) => (
          <div key={w.label} className="flex-1 flex flex-col items-center justify-end h-full" title={`${w.label}: ${w.pct}%`}>
            <div className="w-full rounded-t hub-bg-accent" style={{ height: `${Math.max(4, w.pct)}%`, opacity: 0.35 + w.pct / 160 }} />
          </div>
        ))}
      </div>

      {correlation && (
        <p className="text-xs text-[#444746] dark:text-[#C4C7C5]">
          🔗 On days you do <b>{correlation.name}</b>, you complete this {correlation.withPct}% of the time
          (+{Math.round(correlation.lift * 100)}%).
        </p>
      )}

      {/* Timer */}
      {timed && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (endsAt ? setEndsAt(null) : setEndsAt(Date.now() + minutes * 60_000))}
            className="min-h-[38px] px-4 rounded-full hub-bg-soft text-xs font-medium inline-flex items-center gap-1.5"
          >
            {endsAt ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {endsAt ? 'Stop' : `Start ${minutes}-min timer`}
          </button>
          {endsAt && (
            <span className="font-mono text-lg tabular-nums">
              {String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}
            </span>
          )}
        </div>
      )}

      {isNative() && (
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard
              ?.writeText(`mmvhub://toggle/habit/${habit.id}`)
              .then(() => setNfcCopied(true))
          }
          className="text-[11px] font-medium hub-text-accent"
        >
          {nfcCopied ? 'Link copied — write it to an NFC tag (URI record)' : 'Copy NFC check-in link'}
        </button>
      )}

      {/* Journal */}
      <div className="space-y-1.5">
        <label htmlFor="hab-journal" className="block text-[11px] font-medium text-[#444746] dark:text-[#C4C7C5]">
          Today’s note
        </label>
        <input
          id="hab-journal"
          type="text"
          maxLength={280}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (note !== (habit.journal?.[today] ?? '')) void onJournal(habit.id, today, note);
          }}
          placeholder="How did it go?"
          className="w-full min-h-[40px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3 text-sm"
        />
        {recentNotes.length > 0 && (
          <ul className="space-y-0.5">
            {recentNotes.map(([d, t]) => (
              <li key={d} className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6] truncate">
                <span className="font-mono">{d.slice(5)}</span> · {t}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
