import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, ListChecks, X } from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { getTodayISO, isHabitScheduledOnDate } from '../lib/format';
import { tx } from '../lib/i18n';
import type { HabitRecord } from '../types';

/** Group active habits by routine name (only habits scheduled today count). */
export function routinesForToday(habits: HabitRecord[]): Map<string, HabitRecord[]> {
  const today = getTodayISO();
  const map = new Map<string, HabitRecord[]>();
  for (const h of habits) {
    const name = h.routine?.trim();
    if (!name || h.archived || !isHabitScheduledOnDate(h, today)) continue;
    map.set(name, [...(map.get(name) ?? []), h]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.routineOrder ?? 0) - (b.routineOrder ?? 0) || a.createdAt - b.createdAt);
  }
  return map;
}

/** Guided routine: one habit at a time, Done / Skip, then a summary. */
export const RoutineRunner: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { habits, toggleHabitLog } = useVault();
  const today = getTodayISO();
  const routines = useMemo(() => routinesForToday(habits), [habits]);
  const [active, setActive] = useState<string | null>(routines.size === 1 ? [...routines.keys()][0] : null);
  const [step, setStep] = useState(0);
  const [results, setResults] = useState<('done' | 'skip')[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const list = active ? routines.get(active) ?? [] : [];
  const current = list[step];
  const finished = active !== null && step >= list.length;

  const advance = (r: 'done' | 'skip') => {
    if (!current) return;
    if (r === 'done' && (current.logs[today] ?? 0) < current.targetPerDay) {
      void toggleHabitLog(current.id, today, 'complete');
    }
    setResults((prev) => [...prev, r]);
    setStep((s) => s + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={tx('Routines')} className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#1E1F20] p-5 pb-safe space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold inline-flex items-center gap-2">
            <ListChecks className="w-4 h-4 hub-text-accent" />
            {active ?? tx('Routines')}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="min-h-[36px] min-w-[36px] rounded-full flex items-center justify-center hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!active ? (
          routines.size === 0 ? (
            <p className="text-sm text-[#5F6368] dark:text-[#9AA0A6]">
              {tx('Give habits a routine name (e.g. Morning) in the habit editor to run them step by step.')}
            </p>
          ) : (
            <ul className="space-y-2">
              {[...routines.entries()].map(([name, hs]) => {
                const doneCount = hs.filter((h) => (h.logs[today] ?? 0) >= h.targetPerDay).length;
                return (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => {
                        setActive(name);
                        setStep(0);
                        setResults([]);
                      }}
                      className="w-full min-h-[52px] px-4 rounded-2xl border border-[#E8EAED] dark:border-[#3C4043] flex items-center justify-between gap-3 text-left hover:border-[var(--hub-accent)]"
                    >
                      <span>
                        <span className="block text-sm font-medium">{name}</span>
                        <span className="block text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
                          {doneCount}/{hs.length}
                        </span>
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : finished ? (
          <div className="text-center space-y-3 py-2">
            <p className="text-3xl">🎉</p>
            <p className="text-sm font-medium">
              {results.filter((r) => r === 'done').length}/{list.length} {tx('done')}
            </p>
            <button type="button" onClick={onClose} className="min-h-[44px] px-6 rounded-full hub-bg-accent text-sm font-medium">
              {tx('Finish')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-1.5" aria-hidden="true">
              {list.map((h, i) => (
                <span
                  key={h.id}
                  className={`h-1.5 flex-1 rounded-full ${
                    i < step ? (results[i] === 'done' ? 'hub-bg-accent' : 'bg-[#C4C7C5] dark:bg-[#5F6368]') : i === step ? 'bg-[var(--hub-accent-soft)]' : 'bg-[#E8EAED] dark:bg-[#282A2C]'
                  }`}
                />
              ))}
            </div>
            <div className="text-center space-y-1 py-4">
              <p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
                {step + 1} / {list.length}
              </p>
              <p className="text-xl font-semibold">{current?.name}</p>
              {current?.targetPerDay && current.targetPerDay > 1 && (
                <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                  {current.targetPerDay} {current.unit ?? ''}
                </p>
              )}
              {current?.notes && <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">{current.notes}</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => advance('skip')} className="flex-1 min-h-[48px] rounded-full border border-[#DADCE0] dark:border-[#444746] text-sm font-medium">
                {tx('Skip')}
              </button>
              <button type="button" onClick={() => advance('done')} className="flex-1 min-h-[48px] rounded-full hub-bg-accent text-sm font-medium inline-flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4" />
                {tx('Done')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
