import type {
  CalendarEventRecord,
  GoalImageConfig,
  GoalRecord,
  HabitRecord,
  PurchaseEntryType,
  PurchaseRecord,
  RecurrenceCycle,
  SubscriptionBillingCycle,
  SubscriptionRecord,
  TaskPriority,
  TaskRecord,
} from '../types';

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getOffsetDateISO(offsetDays: number, baseISO?: string): string {
  const d = baseISO
    ? (() => {
        const [y, m, day] = baseISO.split('-').map(Number);
        return new Date(y, m - 1, day);
      })()
    : new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getMonthKey(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const date = new Date(Number(yStr), Number(mStr) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-');
  const date = new Date(Number(yStr), Number(mStr) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatShortDate(dateISO: string): string {
  if (!dateISO) return '';
  const [y, m, d] = dateISO.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatTime12h(hhmm?: string): string {
  if (!hhmm) return '';
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatCurrency(amount: number, symbol = '$'): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

export function getPurchaseEntryType(p: Pick<PurchaseRecord, 'entryType' | 'isRefund'>): PurchaseEntryType {
  if (p.entryType) return p.entryType;
  return p.isRefund ? 'refund' : 'expense';
}

export function createRecordId(
  prefix: 'pur' | 'hab' | 'tsk' | 'lst' | 'sub' | 'cal' | 'gol'
): string {
  const rand = crypto.getRandomValues(new Uint8Array(6));
  const hex = Array.from(rand, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${Date.now()}_${hex}`;
}

export const DEFAULT_GOAL_IMAGE_CONFIG: GoalImageConfig = {
  layout: 'cover',
  fit: 'cover',
  frame: 'bleed',
  posX: 50,
  posY: 50,
  zoom: 1,
  rotation: 0,
  flipH: false,
  flipV: false,
};

export function isValidHttpImageUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return trimmed.startsWith('https://') || trimmed.startsWith('http://');
}

export function advanceDateByCycle(
  dateISO: string,
  cycle: RecurrenceCycle | SubscriptionBillingCycle
): string {
  if (cycle === 'none') return dateISO;
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (cycle === 'daily') {
    dt.setDate(dt.getDate() + 1);
  } else if (cycle === 'weekly') {
    dt.setDate(dt.getDate() + 7);
  } else if (cycle === 'monthly') {
    dt.setMonth(dt.getMonth() + 1);
  } else if (cycle === 'quarterly') {
    dt.setMonth(dt.getMonth() + 3);
  } else if (cycle === 'yearly') {
    dt.setFullYear(dt.getFullYear() + 1);
  }
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

export function getMonthlyEquivalent(
  amount: number,
  cycle: SubscriptionBillingCycle
): number {
  if (cycle === 'weekly') return (amount * 52) / 12;
  if (cycle === 'monthly') return amount;
  if (cycle === 'quarterly') return amount / 3;
  return amount / 12;
}

export function getDaysUntil(dateISO: string, fromISO = getTodayISO()): number {
  const [y1, m1, d1] = fromISO.split('-').map(Number);
  const [y2, m2, d2] = dateISO.split('-').map(Number);
  const t1 = new Date(y1, m1 - 1, d1).getTime();
  const t2 = new Date(y2, m2 - 1, d2).getTime();
  return Math.round((t2 - t1) / 86400000);
}

const WEEKDAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseLocalDate(dateISO: string): Date {
  const [y, m, d] = dateISO.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getHabitAnchorISO(
  habit: Pick<HabitRecord, 'startDate' | 'createdAt'>
): string {
  if (habit.startDate) return habit.startDate;
  const dt = new Date(habit.createdAt || Date.now());
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isHabitScheduledOnDate(
  habit: Pick<
    HabitRecord,
    | 'cadence'
    | 'customWeekdays'
    | 'customMode'
    | 'intervalDays'
    | 'startDate'
    | 'monthlyDays'
    | 'weeklyQuota'
    | 'createdAt'
  >,
  dateISO: string
): boolean {
  if (habit.weeklyQuota && habit.weeklyQuota > 0) return true;
  const dt = parseLocalDate(dateISO);
  const dow = dt.getDay();
  const dayOfMonth = dt.getDate();

  if (habit.cadence === 'daily') return true;
  if (habit.cadence === 'weekdays') return dow >= 1 && dow <= 5;

  if (habit.cadence === 'weekly') {
    if (habit.customWeekdays && habit.customWeekdays.length > 0) {
      return habit.customWeekdays.includes(dow);
    }
    const anchorDow = new Date(habit.createdAt || Date.now()).getDay();
    return dow === anchorDow;
  }

  if (habit.cadence === 'monthly') {
    const days =
      habit.monthlyDays && habit.monthlyDays.length > 0
        ? habit.monthlyDays
        : [new Date(habit.createdAt || Date.now()).getDate()];
    const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
    return days.includes(dayOfMonth) || (days.includes(-1) && dayOfMonth === lastDay);
  }

  // Custom recurring rule
  if (habit.customMode === 'interval') {
    const interval = Math.max(1, habit.intervalDays ?? 2);
    const anchorISO = getHabitAnchorISO(habit);
    const diff = getDaysUntil(dateISO, anchorISO);
    if (diff < 0) return false;
    return diff % interval === 0;
  }

  const customDays =
    habit.customWeekdays && habit.customWeekdays.length > 0
      ? habit.customWeekdays
      : [1, 3, 5];
  return customDays.includes(dow);
}

function ordinalDay(n: number): string {
  if (n === -1) return 'Last day';
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function formatHabitScheduleLabel(
  habit: Pick<
    HabitRecord,
    | 'cadence'
    | 'customWeekdays'
    | 'customMode'
    | 'intervalDays'
    | 'monthlyDays'
    | 'weeklyQuota'
    | 'mode'
    | 'createdAt'
  >
): string {
  if (habit.weeklyQuota && habit.weeklyQuota > 0) {
    return `${habit.weeklyQuota}× / week`;
  }
  if (habit.cadence === 'daily') return 'Every day';
  if (habit.cadence === 'weekdays') return 'Weekdays (Mon–Fri)';

  if (habit.cadence === 'weekly') {
    const days =
      habit.customWeekdays && habit.customWeekdays.length > 0
        ? [...habit.customWeekdays].sort((a, b) => a - b)
        : [new Date(habit.createdAt || Date.now()).getDay()];
    return `Weekly · ${days.map((d) => WEEKDAY_NAMES_SHORT[d]).join(', ')}`;
  }

  if (habit.cadence === 'monthly') {
    const days =
      habit.monthlyDays && habit.monthlyDays.length > 0
        ? [...habit.monthlyDays].sort((a, b) => {
            if (a === -1) return 1;
            if (b === -1) return -1;
            return a - b;
          })
        : [new Date(habit.createdAt || Date.now()).getDate()];
    return `Monthly · ${days.map(ordinalDay).join(', ')}`;
  }

  if (habit.customMode === 'interval') {
    const n = Math.max(1, habit.intervalDays ?? 2);
    return n === 1 ? 'Every day' : `Every ${n} days`;
  }

  const days =
    habit.customWeekdays && habit.customWeekdays.length > 0
      ? [...habit.customWeekdays].sort((a, b) => a - b)
      : [1, 3, 5];
  if (days.length === 7) return 'Every day';
  return days.map((d) => WEEKDAY_NAMES_SHORT[d]).join(', ');
}

export function getWeeklyQuotaProgress(
  habit: Pick<HabitRecord, 'logs' | 'targetPerDay' | 'weeklyQuota'>,
  refDateISO = getTodayISO(),
  startsMonday = false
): { done: number; quota: number } {
  const dt = parseLocalDate(refDateISO);
  const dow = dt.getDay();
  const offsetToStart = startsMonday ? (dow + 6) % 7 : dow;
  let done = 0;
  for (let i = 0; i < 7; i++) {
    const iso = getOffsetDateISO(i - offsetToStart, refDateISO);
    if ((habit.logs[iso] ?? 0) >= habit.targetPerDay) {
      done += 1;
    }
  }
  return { done, quota: habit.weeklyQuota ?? 3 };
}

export function getHabitTargetForDate(
  habit: Pick<
    HabitRecord,
    | 'targetPerDay'
    | 'habitType'
    | 'progressiveStart'
    | 'progressiveStep'
    | 'progressiveEveryDays'
    | 'progressiveCap'
    | 'startDate'
    | 'createdAt'
  >,
  dateISO: string
): number {
  if (habit.habitType !== 'progressive') {
    return Math.max(1, habit.targetPerDay || 1);
  }
  const base = Math.max(1, habit.progressiveStart ?? habit.targetPerDay ?? 1);
  const step = Math.max(0, habit.progressiveStep ?? 1);
  const everyDays = Math.max(1, habit.progressiveEveryDays ?? 7);
  const anchorISO = getHabitAnchorISO(habit);
  const elapsed = Math.max(0, getDaysUntil(dateISO, anchorISO));
  const level = Math.floor(elapsed / everyDays);
  const rawTarget = base + level * step;
  if (habit.progressiveCap && habit.progressiveCap > 0) {
    return Math.min(habit.progressiveCap, Math.max(1, rawTarget));
  }
  return Math.max(1, rawTarget);
}

export function calculateHabitStreak(
  logs: Record<string, number>,
  targetPerDay: number,
  habitSchedule?: Pick<
    HabitRecord,
    | 'cadence'
    | 'customWeekdays'
    | 'customMode'
    | 'intervalDays'
    | 'startDate'
    | 'monthlyDays'
    | 'weeklyQuota'
    | 'freezeDates'
    | 'habitType'
    | 'progressiveStart'
    | 'progressiveStep'
    | 'progressiveEveryDays'
    | 'progressiveCap'
    | 'targetPerDay'
    | 'createdAt'
  >
): {
  current: number;
  best: number;
} {
  const today = getTodayISO();
  const frozenSet = new Set(habitSchedule?.freezeDates ?? []);

  const targetOn = (iso: string) =>
    habitSchedule
      ? getHabitTargetForDate(
          { ...habitSchedule, targetPerDay: habitSchedule.targetPerDay ?? targetPerDay },
          iso
        )
      : targetPerDay;
  const isDone = (iso: string) => (logs[iso] ?? 0) >= targetOn(iso);
  const isFrozen = (iso: string) => frozenSet.has(iso);
  const isScheduled = (iso: string) =>
    habitSchedule ? isHabitScheduledOnDate(habitSchedule, iso) : true;

  // Walk backwards up to 730 days to compute current schedule-aware streak (freeze-safe)
  let current = 0;
  for (let offset = 0; offset >= -730; offset--) {
    const iso = getOffsetDateISO(offset, today);
    if (isDone(iso)) {
      current++;
    } else if (isFrozen(iso)) {
      // Streak Freeze preserves continuity without incrementing completion count
      continue;
    } else if (offset === 0) {
      // Today not completed yet doesn't break yesterday's active streak
      continue;
    } else if (isScheduled(iso) && !(habitSchedule?.weeklyQuota && habitSchedule.weeklyQuota > 0)) {
      break;
    }
  }

  // Compute best historical streak across earliest logged date through today
  const loggedDates = Object.keys(logs).filter(isDone).sort();
  let best = current;

  if (loggedDates.length > 0) {
    const earliestISO = loggedDates[0];
    const spanDays = Math.min(730, Math.max(0, getDaysUntil(today, earliestISO)));
    let run = 0;
    for (let i = 0; i <= spanDays; i++) {
      const iso = getOffsetDateISO(i, earliestISO);
      if (isDone(iso)) {
        run++;
        if (run > best) best = run;
      } else if (
        iso !== today &&
        !isFrozen(iso) &&
        isScheduled(iso) &&
        !(habitSchedule?.weeklyQuota && habitSchedule.weeklyQuota > 0)
      ) {
        run = 0;
      }
    }
  }

  return { current, best };
}

export interface GoalProgressSummary {
  pct: number;
  summaryLabel: string;
  linkedTasksCount: number;
  linkedTasksDone: number;
  linkedHabitsCount: number;
  linkedHabitCheckins: number;
  milestonesDone: number;
  milestonesTotal: number;
}

export function computeGoalProgress(
  goal: GoalRecord,
  tasks: TaskRecord[],
  habits: HabitRecord[]
): GoalProgressSummary {
  const linkedTasks = tasks.filter((t) => t.goalId === goal.id);
  const linkedHabits = habits.filter((h) => !h.archived && h.goalId === goal.id);
  const milestones = goal.milestones ?? [];
  const milestonesDone = milestones.filter((m) => m.done).length;
  const milestonesTotal = milestones.length;

  const linkedTasksDone = linkedTasks.filter((t) => t.completed).length;
  const linkedTasksRatio =
    linkedTasks.length > 0
      ? linkedTasks.reduce((sum, t) => {
          if (t.completed) return sum + 1;
          if (
            t.taskType === 'progressive' &&
            t.progressTarget &&
            t.progressTarget > 0
          ) {
            return sum + Math.min(1, (t.progressCurrent ?? 0) / t.progressTarget);
          }
          if (t.subtasks && t.subtasks.length > 0) {
            const doneSub = t.subtasks.filter((s) => s.done).length;
            return sum + doneSub / t.subtasks.length;
          }
          return sum;
        }, 0) / linkedTasks.length
      : null;

  let linkedHabitCheckins = 0;
  for (const h of linkedHabits) {
    for (const val of Object.values(h.logs)) {
      if (val > 0) linkedHabitCheckins += 1;
    }
  }

  const hasNumeric =
    typeof goal.targetValue === 'number' && goal.targetValue > 0;
  const numericCurrent = Math.max(0, goal.currentValue ?? 0);
  const numericRatio = hasNumeric
    ? Math.min(1, numericCurrent / goal.targetValue!)
    : null;
  const milestonesRatio =
    milestonesTotal > 0 ? milestonesDone / milestonesTotal : null;

  let pct = 0;
  let summaryLabel = 'No progress steps set';

  if (goal.status === 'completed') {
    pct = 100;
    summaryLabel = 'Goal completed';
  } else if (goal.progressMode === 'numeric' && numericRatio !== null) {
    pct = Math.round(numericRatio * 100);
    summaryLabel = `${numericCurrent} / ${goal.targetValue}${goal.unit ? ` ${goal.unit}` : ''}`;
  } else if (goal.progressMode === 'milestones' && milestonesRatio !== null) {
    pct = Math.round(milestonesRatio * 100);
    summaryLabel = `${milestonesDone} of ${milestonesTotal} milestones`;
  } else if (goal.progressMode === 'linked') {
    if (linkedTasksRatio !== null) {
      pct = Math.round(linkedTasksRatio * 100);
      summaryLabel = `${linkedTasksDone}/${linkedTasks.length} linked tasks`;
    } else if (linkedHabits.length > 0) {
      pct = Math.min(100, linkedHabitCheckins * 5);
      summaryLabel = `${linkedHabitCheckins} habit check-ins`;
    }
  } else {
    const signals: number[] = [];
    if (numericRatio !== null) signals.push(numericRatio);
    if (milestonesRatio !== null) signals.push(milestonesRatio);
    if (linkedTasksRatio !== null) signals.push(linkedTasksRatio);
    if (signals.length > 0) {
      pct = Math.round(
        (signals.reduce((a, b) => a + b, 0) / signals.length) * 100
      );
      const parts: string[] = [];
      if (hasNumeric) {
        parts.push(
          `${numericCurrent}/${goal.targetValue}${goal.unit ? ` ${goal.unit}` : ''}`
        );
      }
      if (milestonesTotal > 0) {
        parts.push(`${milestonesDone}/${milestonesTotal} milestones`);
      }
      if (linkedTasks.length > 0) {
        parts.push(`${linkedTasksDone}/${linkedTasks.length} tasks`);
      }
      summaryLabel = parts.join(' · ');
    } else if (linkedHabits.length > 0) {
      pct = Math.min(100, linkedHabitCheckins * 5);
      summaryLabel = `${linkedHabitCheckins} habit check-ins`;
    }
  }

  return {
    pct: Math.max(0, Math.min(100, pct)),
    summaryLabel,
    linkedTasksCount: linkedTasks.length,
    linkedTasksDone,
    linkedHabitsCount: linkedHabits.length,
    linkedHabitCheckins,
    milestonesDone,
    milestonesTotal,
  };
}

export interface ParsedTaskInput {
  title: string;
  dueDate?: string;
  dueTime?: string;
  priority?: TaskPriority;
  listId?: string;
  area?: string;
}

export function parseNaturalTaskInput(
  raw: string,
  lists: { id: string; name: string }[] = [],
  baseISO = getTodayISO()
): ParsedTaskInput {
  let working = raw.trim();
  let dueDate: string | undefined;
  let dueTime: string | undefined;
  let priority: TaskPriority | undefined;
  let listId: string | undefined;
  let area: string | undefined;

  // Extract !high / !med / !medium / !low
  const prioMatch = working.match(/\B!(high|medium|med|low)\b/i);
  if (prioMatch) {
    const val = prioMatch[1].toLowerCase();
    priority = val === 'med' ? 'medium' : (val as TaskPriority);
    working = working.replace(prioMatch[0], ' ');
  }

  // Extract @ListName
  const listMatch = working.match(/\B@([a-z0-9_-]+)/i);
  if (listMatch) {
    const token = listMatch[1].toLowerCase();
    const matched = lists.find(
      (l) => l.name.toLowerCase().replace(/\s+/g, '') === token || l.name.toLowerCase().startsWith(token)
    );
    if (matched) {
      listId = matched.id;
      area = matched.name;
    }
    working = working.replace(listMatch[0], ' ');
  }

  // Extract #tag as area
  const tagMatch = working.match(/\B#([a-z0-9_-]+)/i);
  if (tagMatch) {
    area = tagMatch[1];
    working = working.replace(tagMatch[0], ' ');
  }

  // Extract date keywords: tomorrow, today, next week, YYYY-MM-DD
  const isoMatch = working.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    dueDate = isoMatch[1];
    working = working.replace(isoMatch[0], ' ');
  } else if (/\bnext\s+week\b/i.test(working)) {
    dueDate = getOffsetDateISO(7, baseISO);
    working = working.replace(/\bnext\s+week\b/i, ' ');
  } else if (/\btomorrow\b/i.test(working)) {
    dueDate = getOffsetDateISO(1, baseISO);
    working = working.replace(/\btomorrow\b/i, ' ');
  } else if (/\btoday\b/i.test(working)) {
    dueDate = baseISO;
    working = working.replace(/\btoday\b/i, ' ');
  }

  // Extract time like "9am", "2:30pm", "14:00"
  const ampmMatch = working.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2] || '0', 10);
    const mer = ampmMatch[3].toLowerCase();
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      dueTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (!dueDate) dueDate = baseISO;
      working = working.replace(ampmMatch[0], ' ');
    }
  } else {
    const h24Match = working.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (h24Match) {
      const h = parseInt(h24Match[1], 10);
      const m = parseInt(h24Match[2], 10);
      dueTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (!dueDate) dueDate = baseISO;
      working = working.replace(h24Match[0], ' ');
    }
  }

  const cleanedTitle = working.replace(/\s{2,}/g, ' ').trim();
  return {
    title: cleanedTitle || raw.trim(),
    dueDate,
    dueTime,
    priority,
    listId,
    area,
  };
}

function escapeIcsText(val: string): string {
  return val
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function toIcsDate(dateISO: string): string {
  return dateISO.replace(/-/g, '');
}

function toIcsDateTime(dateISO: string, hhmm: string): string {
  const cleanTime = hhmm.replace(':', '').padEnd(4, '0');
  return `${dateISO.replace(/-/g, '')}T${cleanTime}00`;
}

export function buildCalendarICS(
  events: CalendarEventRecord[],
  tasks: TaskRecord[],
  subscriptions: SubscriptionRecord[],
  currency = '$'
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MMV-HUB//Encrypted Vault Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

  for (const ev of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.id}@mmvhub.local`);
    lines.push(`DTSTAMP:${stamp}`);
    if (ev.allDay || !ev.startTime) {
      lines.push(`DTSTART;VALUE=DATE:${toIcsDate(ev.date)}`);
      lines.push(`DTEND;VALUE=DATE:${toIcsDate(getOffsetDateISO(1, ev.date))}`);
    } else {
      lines.push(`DTSTART:${toIcsDateTime(ev.date, ev.startTime)}`);
      lines.push(`DTEND:${toIcsDateTime(ev.date, ev.endTime || ev.startTime)}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(ev.title)}`);
    if (ev.location) lines.push(`LOCATION:${escapeIcsText(ev.location)}`);
    if (ev.notes) lines.push(`DESCRIPTION:${escapeIcsText(ev.notes)}`);
    if (ev.repeat && ev.repeat !== 'none') {
      lines.push(`RRULE:FREQ=${ev.repeat.toUpperCase()}`);
    }
    lines.push('END:VEVENT');
  }

  for (const t of tasks) {
    if (t.completed || !t.dueDate) continue;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${t.id}@mmvhub.local`);
    lines.push(`DTSTAMP:${stamp}`);
    if (t.dueTime) {
      lines.push(`DTSTART:${toIcsDateTime(t.dueDate, t.dueTime)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${toIcsDate(t.dueDate)}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(`Task: ${t.title}`)}`);
    if (t.notes) lines.push(`DESCRIPTION:${escapeIcsText(t.notes)}`);
    lines.push('END:VEVENT');
  }

  for (const s of subscriptions) {
    if (!s.active) continue;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${s.id}@mmvhub.local`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${toIcsDate(s.nextBillingDate)}`);
    lines.push(
      `SUMMARY:${escapeIcsText(`${s.isTrial ? 'Trial ends' : 'Renewal'}: ${s.name} (${formatCurrency(s.amount, currency)})`)}`
    );
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
