import React, { useEffect, useMemo } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { formatShortDate, getDaysUntil, getTodayISO } from '../lib/format';
import type { SnoozePreset } from '../types';

/** Morning carry-over: decide what to do with every overdue task in one place. */
export const CarryoverSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { tasks, saveTask, snoozeTask, toggleTaskCompleted, deleteTask, batchUpdateTasks } = useVault();
  const today = getTodayISO();
  const overdue = useMemo(
    () =>
      tasks
        .filter((t) => !t.completed && t.dueDate && t.dueDate < today)
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')),
    [tasks, today]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toToday = (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (t) void saveTask({ ...t, dueDate: today });
  };

  const btn =
    'min-h-[32px] px-2.5 rounded-full text-[11px] font-medium border border-[#DADCE0] dark:border-[#444746] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Plan overdue tasks"
        className="w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#1E1F20] pb-safe"
      >
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            Carry over · {overdue.length}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="min-h-[36px] min-w-[36px] rounded-full flex items-center justify-center hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]">
            <X className="w-4 h-4" />
          </button>
        </div>
        {overdue.length === 0 ? (
          <p className="px-5 pb-8 text-sm text-[#5F6368] dark:text-[#9AA0A6]">All caught up 🎉</p>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto px-5 divide-y divide-[#F1F3F4] dark:divide-[#282A2C]">
              {overdue.map((t) => {
                const days = Math.abs(getDaysUntil(t.dueDate!, today));
                return (
                  <li key={t.id} className="py-2.5 space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      <span className="text-[11px] text-[#C5221F] dark:text-[#F28B82] shrink-0">
                        {formatShortDate(t.dueDate!)} · {days}d
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button type="button" className={btn} onClick={() => toToday(t.id)}>Today</button>
                      {(['tomorrow', 'weekend', 'nextweek'] as SnoozePreset[]).map((p) => (
                        <button key={p} type="button" className={btn} onClick={() => void snoozeTask(t.id, p)}>
                          {p === 'tomorrow' ? 'Tomorrow' : p === 'weekend' ? 'Weekend' : 'Next week'}
                        </button>
                      ))}
                      <button type="button" aria-label={`Complete ${t.title}`} className={`${btn} hub-text-accent`} onClick={() => void toggleTaskCompleted(t.id)}>
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" aria-label={`Delete ${t.title}`} className={`${btn} text-[#C5221F] dark:text-[#F28B82]`} onClick={() => void deleteTask(t.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="px-5 py-3 border-t border-[#E8EAED] dark:border-[#3C4043] flex gap-2">
              <button
                type="button"
                onClick={() => {
                  for (const t of overdue) toToday(t.id);
                }}
                className="flex-1 min-h-[40px] rounded-full hub-bg-accent text-xs font-medium"
              >
                All to today
              </button>
              <button
                type="button"
                onClick={() => void batchUpdateTasks(overdue.map((t) => t.id), 'tomorrow')}
                className="flex-1 min-h-[40px] rounded-full border border-[#DADCE0] dark:border-[#444746] text-xs font-medium"
              >
                All to tomorrow
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
