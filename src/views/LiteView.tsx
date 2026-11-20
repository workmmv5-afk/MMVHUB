import React, { useMemo, useState } from 'react';
import { CalendarDays, Check, Plus, Receipt, Target } from 'lucide-react';
import { DEFAULT_TASK_LIST_ID, useVault } from '../context/VaultContext';
import {
  computeGoalProgress,
  doesEventOccurOnDate,
  eventDisplayTitle,
  formatCurrency,
  formatShortDate,
  formatTime12h,
  getMonthKey,
  getOffsetDateISO,
  getPurchaseEntryType,
  getTodayISO,
  isHabitScheduledOnDate,
  parseNaturalTaskInput,
} from '../lib/format';
import { t } from '../lib/i18n';
import { Dropdown } from '../components/Dropdown';
import type {
  CalendarEventRecord,
  GoalRecord,
  PurchaseCategory,
  TaskRecord,
} from '../types';

const CATEGORIES: PurchaseCategory[] = [
  'Food & Dining',
  'Groceries',
  'Transport',
  'Utilities',
  'Health',
  'Home',
  'Tech & Gear',
  'Other',
];

const card = 'rounded-3xl bg-white dark:bg-[#1E1F20] border border-[#E8EAED] dark:border-[#282A2C] p-4 sm:p-5 space-y-3';
const h2 = 'text-base font-semibold inline-flex items-center gap-2';

interface Props {
  onEditTask: (t: TaskRecord) => void;
  onNewEvent: (dateISO?: string) => void;
  onEditEvent: (ev: CalendarEventRecord) => void;
  onEditGoal: (g: GoalRecord) => void;
}

/** Lite mode: one calm page — Today, Expenses, Calendar, Goals. */
export const LiteView: React.FC<Props> = ({ onEditTask, onNewEvent, onEditEvent, onEditGoal }) => {
  const {
    tasks,
    taskLists,
    habits,
    purchases,
    calendarEvents,
    goals,
    preferences,
    saveTask,
    savePurchase,
    toggleTaskCompleted,
    toggleHabitLog,
  } = useVault();
  const today = getTodayISO();
  const blur = preferences.privacyBlur ? 'hub-privacy-blur' : '';

  // ---------------- Today
  const todayTasks = useMemo(
    () =>
      tasks
        .filter((x) => !x.completed && x.dueDate && x.dueDate <= today)
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99')),
    [tasks, today]
  );
  const todayHabits = useMemo(
    () => habits.filter((h) => !h.archived && isHabitScheduledOnDate(h, today)),
    [habits, today]
  );
  const [newTask, setNewTask] = useState('');

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newTask.trim();
    if (!text) return;
    const parsed = parseNaturalTaskInput(text, taskLists, today);
    await saveTask({
      listId: parsed.listId ?? DEFAULT_TASK_LIST_ID,
      title: parsed.title,
      completed: false,
      priority: parsed.priority ?? 'medium',
      dueDate: parsed.dueDate ?? today,
      dueTime: parsed.dueTime,
      area: parsed.area ?? 'My Tasks',
    });
    setNewTask('');
  };

  // ---------------- Expenses
  const month = getMonthKey(today);
  const spent = useMemo(() => {
    let s = 0;
    for (const p of purchases) {
      if (getMonthKey(p.date) !== month) continue;
      const type = getPurchaseEntryType(p);
      if (type === 'expense') s += p.amount;
      else if (type === 'refund') s -= p.amount;
    }
    return s;
  }, [purchases, month]);
  const budget = preferences.monthlyBudget;
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const [amount, setAmount] = useState('');
  const [what, setWhat] = useState('');
  const [category, setCategory] = useState<PurchaseCategory>('Food & Dining');
  const recent = purchases.filter((p) => getPurchaseEntryType(p) === 'expense').slice(0, 3);

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return;
    await savePurchase({
      title: what.trim() || category,
      amount: Math.round(value * 100) / 100,
      category,
      paymentMethod: 'Card',
      date: today,
      entryType: 'expense',
    });
    setAmount('');
    setWhat('');
  };

  // ---------------- Calendar (next 7 days)
  const upcoming = useMemo(() => {
    const out: { iso: string; ev: CalendarEventRecord }[] = [];
    for (let i = 0; i < 7; i++) {
      const iso = getOffsetDateISO(i, today);
      for (const ev of calendarEvents) if (doesEventOccurOnDate(ev, iso)) out.push({ iso, ev });
    }
    return out
      .sort((a, b) => a.iso.localeCompare(b.iso) || (a.ev.startTime ?? '').localeCompare(b.ev.startTime ?? ''))
      .slice(0, 8);
  }, [calendarEvents, today]);

  // ---------------- Goals
  const activeGoals = goals.filter((g) => g.status === 'active');

  const checkbox = (done: boolean) =>
    `w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
      done ? 'hub-bg-accent border-transparent' : 'border-[#747775] dark:border-[#8E918F]'
    }`;

  return (
    <div className="max-w-xl mx-auto space-y-4 text-[15px]">
      {/* Today */}
      <section className={card} aria-label={t('lite.today')}>
        <h2 className={h2}>
          <Check className="w-5 h-5 hub-text-accent" />
          {t('lite.today')}
        </h2>
        <ul className="space-y-1">
          {todayHabits.map((h) => {
            const done = (h.logs[today] ?? 0) >= h.targetPerDay;
            return (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => void toggleHabitLog(h.id, today, h.targetPerDay > 1 ? 'increment' : 'toggle')}
                  className="w-full min-h-[52px] flex items-center gap-3 text-left"
                >
                  <span className={checkbox(done)}>{done && <Check className="w-4 h-4" />}</span>
                  <span className={`flex-1 ${done ? 'line-through text-[#747775]' : ''}`}>{h.name}</span>
                  {h.targetPerDay > 1 && (
                    <span className="text-xs font-mono text-[#5F6368] dark:text-[#9AA0A6]">
                      {h.logs[today] ?? 0}/{h.targetPerDay}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {todayTasks.map((task) => (
            <li key={task.id} className="flex items-center gap-3 min-h-[52px]">
              <button
                type="button"
                onClick={() => void toggleTaskCompleted(task.id)}
                aria-label={`${t('lite.complete')} ${task.title}`}
                className={checkbox(false)}
              />
              <button type="button" onClick={() => onEditTask(task)} className="flex-1 text-left min-w-0">
                <span className="block truncate">{task.title}</span>
                {(task.dueDate! < today || task.dueTime) && (
                  <span className={`block text-xs ${task.dueDate! < today ? 'text-[#C5221F] dark:text-[#F28B82]' : 'text-[#5F6368] dark:text-[#9AA0A6]'}`}>
                    {task.dueDate! < today ? formatShortDate(task.dueDate!) : formatTime12h(task.dueTime)}
                  </span>
                )}
              </button>
            </li>
          ))}
          {todayHabits.length === 0 && todayTasks.length === 0 && (
            <li className="py-3 text-sm text-[#5F6368] dark:text-[#9AA0A6]">{t('lite.allClear')}</li>
          )}
        </ul>
        <form onSubmit={addTask} className="flex gap-2">
          <input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder={t('lite.addTask')}
            aria-label={t('lite.addTask')}
            className="flex-1 min-h-[48px] rounded-2xl border border-[#DADCE0] dark:border-[#3C4043] bg-transparent px-4"
          />
          <button type="submit" aria-label={t('lite.add')} className="min-h-[48px] min-w-[48px] rounded-2xl hub-bg-accent flex items-center justify-center">
            <Plus className="w-5 h-5" />
          </button>
        </form>
      </section>

      {/* Expenses */}
      <section className={card} aria-label={t('lite.expenses')}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className={h2}>
            <Receipt className="w-5 h-5 hub-text-accent" />
            {t('lite.expenses')}
          </h2>
          <span className={`text-lg font-semibold font-mono tabular-nums ${blur}`}>
            {formatCurrency(spent, preferences.currency)}
          </span>
        </div>
        {budget > 0 && (
          <div className="space-y-1">
            <div className="h-2.5 rounded-full bg-[#E8EAED] dark:bg-[#282A2C] overflow-hidden">
              <div className={`h-full rounded-full ${pct >= 100 ? 'bg-[#D93025]' : 'hub-bg-accent'}`} style={{ width: `${pct}%` }} />
            </div>
            <p className={`text-xs text-[#5F6368] dark:text-[#9AA0A6] ${blur}`}>
              {t('lite.ofBudget', { pct, budget: formatCurrency(budget, preferences.currency) })}
            </p>
          </div>
        )}
        <form onSubmit={addExpense} className="space-y-2">
          <div className="grid grid-cols-[110px_1fr] gap-2">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('lite.amount')}
              aria-label={t('lite.amount')}
              className="min-h-[48px] rounded-2xl border border-[#DADCE0] dark:border-[#3C4043] bg-transparent px-4 font-mono"
            />
            <input
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              placeholder={t('lite.what')}
              aria-label={t('lite.what')}
              className="min-h-[48px] rounded-2xl border border-[#DADCE0] dark:border-[#3C4043] bg-transparent px-4"
            />
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <Dropdown
              label={t('lite.category')}
              value={category}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
              onChange={setCategory}
            />
            <button type="submit" className="min-h-[44px] px-5 rounded-2xl hub-bg-accent font-medium">
              {t('lite.add')}
            </button>
          </div>
        </form>
        {recent.length > 0 && (
          <ul className="divide-y divide-[#F1F3F4] dark:divide-[#282A2C]">
            {recent.map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{p.title}</span>
                <span className={`font-mono tabular-nums shrink-0 ${blur}`}>{formatCurrency(p.amount, preferences.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Calendar */}
      <section className={card} aria-label={t('lite.calendar')}>
        <div className="flex items-center justify-between">
          <h2 className={h2}>
            <CalendarDays className="w-5 h-5 hub-text-accent" />
            {t('lite.calendar')}
          </h2>
          <button type="button" onClick={() => onNewEvent(today)} aria-label={t('lite.addEvent')} className="min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-[#5F6368] dark:text-[#9AA0A6]">{t('lite.noEvents')}</p>
        ) : (
          <ul className="space-y-1">
            {upcoming.map(({ iso, ev }) => (
              <li key={`${ev.id}-${iso}`}>
                <button type="button" onClick={() => onEditEvent(ev)} className="w-full min-h-[48px] flex items-center gap-3 text-left">
                  <span className="w-16 shrink-0 text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6]">
                    {iso === today ? t('common.today') : formatShortDate(iso)}
                  </span>
                  <span className="flex-1 min-w-0 truncate">{eventDisplayTitle(ev, iso)}</span>
                  <span className="text-xs font-mono text-[#5F6368] dark:text-[#9AA0A6] shrink-0">
                    {ev.allDay ? '' : formatTime12h(ev.startTime)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Goals */}
      {activeGoals.length > 0 && (
        <section className={card} aria-label={t('lite.goals')}>
          <h2 className={h2}>
            <Target className="w-5 h-5 hub-text-accent" />
            {t('lite.goals')}
          </h2>
          <ul className="space-y-3">
            {activeGoals.map((g) => {
              const p = computeGoalProgress(g, tasks, habits).pct;
              return (
                <li key={g.id}>
                  <button type="button" onClick={() => onEditGoal(g)} className="w-full text-left space-y-1.5">
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate">{g.title}</span>
                      <span className="text-sm font-mono font-semibold hub-text-accent">{p}%</span>
                    </span>
                    <span className="block h-2.5 rounded-full bg-[#E8EAED] dark:bg-[#282A2C] overflow-hidden">
                      <span className="block h-full rounded-full hub-bg-accent" style={{ width: `${p}%` }} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
};
