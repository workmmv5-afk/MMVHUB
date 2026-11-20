import type {
  CalendarEventRecord,
  GoalRecord,
  HabitRecord,
  HubPreferences,
  PhoneWidgetConfig,
  PurchaseRecord,
  SubscriptionRecord,
  TaskRecord,
} from '../types';
import {
  computeGoalProgress,
  doesEventOccurOnDate,
  formatCurrency,
  formatShortDate,
  formatTime12h,
  getDaysUntil,
  getMonthKey,
  getPurchaseEntryType,
  getTodayISO,
  isHabitScheduledOnDate,
} from './format';
import { isNative, MmvWidgets } from './native';

export const DEFAULT_PHONE_WIDGETS: Required<Omit<PhoneWidgetConfig, 'quick'>> & {
  quick: Required<NonNullable<PhoneWidgetConfig['quick']>>;
} = {
  theme: 'system',
  opacity: 100,
  accent: 'app',
  hideAmounts: false,
  hideWhenLocked: false,
  rows: 4,
  todayTitle: 'Today',
  todayTasks: true,
  todayHabits: true,
  todayEvents: true,
  todayDoneItems: false,
  quick: { task: true, purchase: true, habit: true, event: true },
};

export function resolvePhoneWidgets(p: Pick<HubPreferences, 'phoneWidgets'>) {
  const raw = p.phoneWidgets ?? {};
  const d = DEFAULT_PHONE_WIDGETS;
  return {
    ...d,
    ...raw,
    opacity: Math.max(0, Math.min(100, raw.opacity ?? d.opacity)),
    rows: Math.max(1, Math.min(5, raw.rows ?? d.rows)),
    todayTitle: (raw.todayTitle ?? d.todayTitle).slice(0, 24) || 'Today',
    quick: { ...d.quick, ...raw.quick },
  };
}

const ACCENT_HEX: Record<string, string> = {
  blue: '#1A73E8',
  green: '#188038',
  purple: '#6750A4',
  amber: '#E37400',
  red: '#D93025',
};

function accentHex(cfg: ReturnType<typeof resolvePhoneWidgets>): string {
  if (cfg.accent !== 'app') return ACCENT_HEX[cfg.accent] ?? ACCENT_HEX.blue;
  const css = getComputedStyle(document.documentElement).getPropertyValue('--hub-accent').trim();
  return /^#[0-9a-f]{6}$/i.test(css) ? css : ACCENT_HEX.blue;
}

export function buildWidgetSnapshot(params: {
  tasks: TaskRecord[];
  habits: HabitRecord[];
  calendarEvents: CalendarEventRecord[];
  subscriptions: SubscriptionRecord[];
  purchases: PurchaseRecord[];
  goals: GoalRecord[];
  preferences: HubPreferences;
  locked: boolean;
}) {
  const cfg = resolvePhoneWidgets(params.preferences);
  const config = {
    theme: cfg.theme,
    opacity: cfg.opacity,
    accent: accentHex(cfg),
    hideAmounts: cfg.hideAmounts || Boolean(params.preferences.privacyBlur),
    rows: cfg.rows,
    todayTitle: cfg.todayTitle,
    quick: cfg.quick,
  };
  if (params.locked) {
    return { v: 1, updatedAt: Date.now(), locked: true, lockedText: 'Unlock MMV-HUB to see your day', config };
  }

  const { tasks, habits, calendarEvents, subscriptions, purchases, goals, preferences } = params;
  const today = getTodayISO();
  type Item = { id: string; kind: string; title: string; sub: string; done: boolean; sort: string };
  const items: Item[] = [];
  let total = 0;
  let done = 0;

  if (cfg.todayTasks) {
    for (const t of tasks) {
      const due = t.dueDate === today;
      const overdue = !t.completed && t.dueDate && t.dueDate < today;
      if (!due && !overdue) continue;
      if (due) {
        total++;
        if (t.completed) done++;
      }
      if (t.completed && !cfg.todayDoneItems) continue;
      items.push({
        id: t.id,
        kind: 'task',
        title: t.title,
        sub: overdue ? `Overdue · ${formatShortDate(t.dueDate!)}` : t.dueTime ? formatTime12h(t.dueTime) : '',
        done: t.completed,
        sort: overdue ? '0' : `1${t.dueTime ?? '99'}`,
      });
    }
  }
  if (cfg.todayHabits) {
    for (const h of habits) {
      if (h.archived || !isHabitScheduledOnDate(h, today)) continue;
      const count = h.logs[today] ?? 0;
      const isDone = count >= h.targetPerDay;
      total++;
      if (isDone) done++;
      if (isDone && !cfg.todayDoneItems) continue;
      items.push({
        id: h.id,
        kind: 'habit',
        title: h.name,
        sub: h.targetPerDay > 1 ? `${count}/${h.targetPerDay} ${h.unit ?? ''}`.trim() : h.preferredTime ? formatTime12h(h.preferredTime) : '',
        done: isDone,
        sort: `2${h.preferredTime ?? '99'}`,
      });
    }
  }
  if (cfg.todayEvents) {
    for (const ev of calendarEvents) {
      if (!doesEventOccurOnDate(ev, today)) continue;
      items.push({
        id: ev.id,
        kind: 'event',
        title: ev.title,
        sub: ev.allDay ? 'All day' : formatTime12h(ev.startTime),
        done: false,
        sort: `1${ev.startTime ?? '00'}`,
      });
    }
  }
  items.sort((a, b) => Number(a.done) - Number(b.done) || a.sort.localeCompare(b.sort));

  // Spending
  const month = getMonthKey(today);
  let spent = 0;
  for (const p of purchases) {
    if (getMonthKey(p.date) !== month) continue;
    const type = getPurchaseEntryType(p);
    if (type === 'expense') spent += p.amount;
    else if (type === 'refund') spent -= p.amount;
  }
  const budget = preferences.monthlyBudget;
  const nextSub = subscriptions
    .filter((s) => s.active && getDaysUntil(s.nextBillingDate, today) >= 0)
    .sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate))[0];

  return {
    v: 1,
    updatedAt: Date.now(),
    locked: false,
    config,
    today: {
      done,
      total,
      items: items.slice(0, 5).map(({ sort: _s, ...rest }) => {
        void _s;
        return rest;
      }),
    },
    spend: {
      label: new Date().toLocaleDateString('en-US', { month: 'long' }),
      spent: formatCurrency(spent, preferences.currency),
      budget: formatCurrency(budget, preferences.currency),
      hasBudget: budget > 0,
      pct: budget > 0 ? Math.max(0, Math.round((spent / budget) * 100)) : 0,
      next: nextSub
        ? `${nextSub.name} · ${getDaysUntil(nextSub.nextBillingDate, today) === 0 ? 'today' : formatShortDate(nextSub.nextBillingDate)} · ${formatCurrency(nextSub.amount, preferences.currency)}`
        : '',
    },
    goals: goals
      .filter((g) => g.status === 'active')
      .sort((a, b) => (a.targetDate || '9999').localeCompare(b.targetDate || '9999'))
      .slice(0, 3)
      .map((g) => ({ id: g.id, title: g.title, pct: computeGoalProgress(g, tasks, habits).pct })),
  };
}

let lastJson = '';

export async function pushWidgetSnapshot(
  params: Parameters<typeof buildWidgetSnapshot>[0]
): Promise<void> {
  if (!isNative()) return;
  const snap = buildWidgetSnapshot(params);
  const { updatedAt: _u, ...comparable } = snap;
  void _u;
  const sig = JSON.stringify(comparable);
  if (sig === lastJson) return;
  lastJson = sig;
  try {
    await MmvWidgets.setSnapshot({ json: JSON.stringify(snap) });
  } catch {
    // Older app build without widgets — ignore
  }
}

export async function clearWidgetSnapshot(): Promise<void> {
  if (!isNative()) return;
  lastJson = '';
  try {
    await MmvWidgets.clear();
  } catch {
    // ignore
  }
}
