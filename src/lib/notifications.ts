import type {
  CalendarEventRecord,
  GoalRecord,
  HabitRecord,
  HubPreferences,
  PurchaseRecord,
  SubscriptionRecord,
  TaskRecord,
} from '../types';
import {
  formatCurrency,
  formatShortDate,
  formatTime12h,
  getDaysUntil,
  getOffsetDateISO,
  getTodayISO,
  isHabitScheduledOnDate,
} from './format';

export interface ReminderItem {
  id: string;
  kind: 'task' | 'subscription' | 'habit' | 'event' | 'purchase' | 'goal';
  title: string;
  body: string;
  dueLabel: string;
  urgent: boolean;
}

export interface CategorizedReminder {
  id: string;
  recordId: string;
  kind: 'task' | 'subscription' | 'habit' | 'event' | 'purchase' | 'goal';
  title: string;
  detail: string;
  whenLabel: string;
  urgent: boolean;
  sortKey: string;
}

export interface CategorizedRemindersResult {
  missed: CategorizedReminder[];
  upcoming: CategorizedReminder[];
}

const SENT_LOG_PREFIX = 'mmv_notif_sent_';

export function getNotificationPermission():
  | NotificationPermission
  | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  return Notification.requestPermission();
}

export function playSubtleChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.14); // A5
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.46);
  } catch {
    // Ignore audio context block before user gesture
  }
}

export async function dispatchLocalNotification(
  title: string,
  body: string,
  tag?: string
): Promise<boolean> {
  if (getNotificationPermission() !== 'granted') return false;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          tag,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
        });
        return true;
      }
    }
  } catch {
    // Fall back to standard Notification API
  }

  try {
    new Notification(title, {
      body,
      tag,
      icon: '/pwa-192x192.png',
    });
    return true;
  } catch {
    return false;
  }
}

function nowMinutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function parseHHMMToMinutes(hhmm?: string): number | null {
  if (!hhmm || !hhmm.includes(':')) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export function isWithinQuietHours(
  preferences: HubPreferences,
  now = new Date()
): boolean {
  if (!preferences.quietHoursEnabled) return false;
  const start = parseHHMMToMinutes(preferences.quietStart ?? '22:00');
  const end = parseHHMMToMinutes(preferences.quietEnd ?? '07:00');
  if (start === null || end === null || start === end) return false;
  const curr = nowMinutesOfDay(now);
  if (start < end) {
    return curr >= start && curr < end;
  }
  return curr >= start || curr < end;
}

function isCardExpiringSoon(cardExpiry?: string, now = new Date()): 'expired' | 'soon' | null {
  if (!cardExpiry || !/^\d{2}\/\d{2}$/.test(cardExpiry.trim())) return null;
  const [mmStr, yyStr] = cardExpiry.trim().split('/');
  const mm = Number(mmStr);
  const yyyy = 2000 + Number(yyStr);
  if (mm < 1 || mm > 12) return null;
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  const diffMonths = (yyyy - curY) * 12 + (mm - curM);
  if (diffMonths < 0) return 'expired';
  if (diffMonths <= 1) return 'soon';
  return null;
}

export function collectDueReminders(params: {
  tasks: TaskRecord[];
  habits: HabitRecord[];
  subscriptions: SubscriptionRecord[];
  calendarEvents: CalendarEventRecord[];
  purchases?: PurchaseRecord[];
  goals?: GoalRecord[];
  preferences: HubPreferences;
  now?: Date;
}): ReminderItem[] {
  const {
    tasks,
    habits,
    subscriptions,
    calendarEvents,
    purchases = [],
    goals = [],
    preferences,
    now = new Date(),
  } = params;
  const todayISO = getTodayISO();
  const currentMin = nowMinutesOfDay(now);
  const digestMin = parseHHMMToMinutes(preferences.dailyDigestTime ?? '09:00') ?? 540;
  const reminders: ReminderItem[] = [];

  // 1. Tasks (overdue or due today when time/digest reached)
  if (preferences.notifyTasks !== false) {
    for (const t of tasks) {
      if (t.completed || !t.dueDate) continue;
      if (t.dueDate < todayISO) {
        reminders.push({
          id: `task-overdue-${t.id}`,
          kind: 'task',
          title: `Overdue task: ${t.title}`,
          body: `Was due ${t.dueDate}${t.area ? ` · ${t.area}` : ''}`,
          dueLabel: 'Overdue',
          urgent: true,
        });
      } else if (t.dueDate === todayISO) {
        const dueMin = parseHHMMToMinutes(t.dueTime);
        const triggerMin = dueMin !== null ? Math.max(0, dueMin - 15) : digestMin;
        if (currentMin >= triggerMin) {
          reminders.push({
            id: `task-today-${t.id}`,
            kind: 'task',
            title: `Task due today: ${t.title}`,
            body: t.dueTime
              ? `Scheduled for ${formatTime12h(t.dueTime)}`
              : `Priority: ${t.priority}`,
            dueLabel: t.dueTime ? formatTime12h(t.dueTime) : 'Today',
            urgent: t.priority === 'high',
          });
        }
      }
    }
  }

  // 2. Subscriptions & Free Trials within reminderDays
  if (preferences.notifySubscriptions !== false) {
    for (const s of subscriptions) {
      if (!s.active) continue;
      const days = getDaysUntil(s.nextBillingDate, todayISO);
      const windowDays = s.reminderDays ?? 3;
      if (days <= windowDays) {
        const whenText =
          days < 0
            ? `Overdue by ${Math.abs(days)}d`
            : days === 0
              ? 'Due today'
              : days === 1
                ? 'Due tomorrow'
                : `Due in ${days} days`;
        reminders.push({
          id: `sub-due-${s.id}-${s.nextBillingDate}`,
          kind: 'subscription',
          title: s.isTrial
            ? `Trial ending: ${s.name}`
            : `Renewal alert: ${s.name}`,
          body: `${whenText} · ${formatCurrency(s.amount, preferences.currency)} (${s.billingCycle})`,
          dueLabel: whenText,
          urgent: days <= 1 || Boolean(s.isTrial),
        });
      }
    }
  }

  // 3. Calendar Events today (honors custom reminderOffsetMinutes)
  if (preferences.notifyEvents !== false) {
    for (const ev of calendarEvents) {
      const offsetMins = ev.reminderOffsetMinutes ?? 30;
      const daysUntil = getDaysUntil(ev.date, todayISO);
      if (daysUntil === 1 && offsetMins >= 1440 && currentMin >= digestMin) {
        reminders.push({
          id: `event-pre-${ev.id}`,
          kind: 'event',
          title: `Tomorrow: ${ev.title}`,
          body: ev.allDay ? 'All day event' : `Starts ${formatTime12h(ev.startTime)}`,
          dueLabel: 'Tomorrow',
          urgent: false,
        });
        continue;
      }
      if (ev.date !== todayISO) continue;
      const startMin = parseHHMMToMinutes(ev.startTime);
      const triggerMin =
        !ev.allDay && startMin !== null
          ? Math.max(0, startMin - (offsetMins >= 1440 ? 30 : offsetMins))
          : digestMin;
      if (currentMin >= triggerMin) {
        reminders.push({
          id: `event-today-${ev.id}`,
          kind: 'event',
          title: `Event today: ${ev.title}`,
          body: ev.allDay
            ? `All day${ev.location ? ` · ${ev.location}` : ''}`
            : `Starts at ${formatTime12h(ev.startTime)}${ev.location ? ` · ${ev.location}` : ''}`,
          dueLabel: ev.allDay ? 'All day' : formatTime12h(ev.startTime),
          urgent: false,
        });
      }
    }
  }

  // 4. Habits scheduled today not yet completed
  if (preferences.notifyHabits !== false) {
    for (const h of habits) {
      if (h.archived || !isHabitScheduledOnDate(h, todayISO)) continue;
      const doneCount = h.logs[todayISO] ?? 0;
      if (doneCount >= h.targetPerDay) continue;
      const prefMin = parseHHMMToMinutes(h.preferredTime) ?? digestMin;
      if (currentMin >= prefMin) {
        reminders.push({
          id: `habit-today-${h.id}`,
          kind: 'habit',
          title: `Habit reminder: ${h.name}`,
          body:
            h.targetPerDay > 1
              ? `Progress: ${doneCount}/${h.targetPerDay} ${h.unit || 'units'}`
              : 'Scheduled for today',
          dueLabel: h.preferredTime ? formatTime12h(h.preferredTime) : 'Today',
          urgent: false,
        });
      }
    }
  }

  // 5. Purchase return-window deadlines within 3 days
  for (const p of purchases) {
    if (!p.returnByDate || p.isRefund || p.entryType === 'income') continue;
    const daysLeft = getDaysUntil(p.returnByDate, todayISO);
    if (daysLeft >= 0 && daysLeft <= 3) {
      reminders.push({
        id: `pur-return-${p.id}`,
        kind: 'purchase',
        title: `Return window: ${p.title}`,
        body:
          daysLeft === 0
            ? 'Last day to return item'
            : `Return deadline in ${daysLeft}d (${formatShortDate(p.returnByDate)})`,
        dueLabel: daysLeft === 0 ? 'Today' : `${daysLeft}d left`,
        urgent: daysLeft <= 1,
      });
    }
  }

  // 6. Goal target deadlines within 7 days or overdue
  if (preferences.notifyGoals !== false) {
    for (const g of goals) {
      if (g.status !== 'active' || !g.targetDate) continue;
      const daysLeft = getDaysUntil(g.targetDate, todayISO);
      if (daysLeft <= 3 && currentMin >= digestMin) {
        reminders.push({
          id: `goal-due-${g.id}`,
          kind: 'goal',
          title:
            daysLeft < 0
              ? `Goal target passed: ${g.title}`
              : daysLeft === 0
                ? `Goal target today: ${g.title}`
                : `Goal target soon: ${g.title}`,
          body: `${g.category} · Target ${formatShortDate(g.targetDate)}`,
          dueLabel:
            daysLeft < 0
              ? `${Math.abs(daysLeft)}d overdue`
              : daysLeft === 0
                ? 'Today'
                : `${daysLeft}d left`,
          urgent: daysLeft <= 0,
        });
      }
    }
  }

  return reminders;
}

function doesEventOccurOnDate(
  ev: CalendarEventRecord,
  targetISO: string
): boolean {
  if (ev.date === targetISO) return true;
  if (!ev.repeat || ev.repeat === 'none' || targetISO < ev.date) return false;
  const [, sm, sd] = ev.date.split('-').map(Number);
  const [ty, tm, td] = targetISO.split('-').map(Number);
  if (ev.repeat === 'daily') return true;
  if (ev.repeat === 'weekly') {
    const startDt = new Date(
      Number(ev.date.slice(0, 4)),
      sm - 1,
      sd
    );
    const targetDt = new Date(ty, tm - 1, td);
    return startDt.getDay() === targetDt.getDay();
  }
  if (ev.repeat === 'monthly') return sd === td;
  if (ev.repeat === 'yearly') return sm === tm && sd === td;
  return false;
}

export function collectCategorizedReminders(params: {
  tasks: TaskRecord[];
  habits: HabitRecord[];
  subscriptions: SubscriptionRecord[];
  calendarEvents: CalendarEventRecord[];
  purchases?: PurchaseRecord[];
  goals?: GoalRecord[];
  preferences: HubPreferences;
  now?: Date;
}): CategorizedRemindersResult {
  const {
    tasks,
    habits,
    subscriptions,
    calendarEvents,
    purchases = [],
    goals = [],
    preferences,
    now = new Date(),
  } = params;

  const todayISO = getTodayISO();
  const tomorrowISO = getOffsetDateISO(1, todayISO);
  const plus7ISO = getOffsetDateISO(7, todayISO);
  const currentMin = nowMinutesOfDay(now);
  const digestTime = preferences.dailyDigestTime ?? '09:00';
  const digestMin = parseHHMMToMinutes(digestTime) ?? 540;

  const missed: CategorizedReminder[] = [];
  const upcoming: CategorizedReminder[] = [];

  // 1. Tasks
  if (preferences.notifyTasks !== false) {
    for (const t of tasks) {
      if (t.completed || !t.dueDate) continue;
      if (t.dueDate < todayISO) {
        const daysAgo = Math.abs(getDaysUntil(t.dueDate, todayISO));
        missed.push({
          id: `missed-task-${t.id}`,
          recordId: t.id,
          kind: 'task',
          title: t.title,
          detail: t.area ? `Task · ${t.area}` : 'Task',
          whenLabel:
            daysAgo === 1
              ? 'Yesterday'
              : `${formatShortDate(t.dueDate)} (${daysAgo}d ago)`,
          urgent: true,
          sortKey: `${t.dueDate}T${t.dueTime || '23:59'}`,
        });
      } else if (t.dueDate === todayISO) {
        const dueMin = parseHHMMToMinutes(t.dueTime);
        if (dueMin !== null && currentMin > dueMin) {
          missed.push({
            id: `missed-task-${t.id}`,
            recordId: t.id,
            kind: 'task',
            title: t.title,
            detail: t.area ? `Task · ${t.area}` : 'Task',
            whenLabel: `Today ${formatTime12h(t.dueTime)}`,
            urgent: true,
            sortKey: `${t.dueDate}T${t.dueTime}`,
          });
        } else {
          upcoming.push({
            id: `upcoming-task-${t.id}`,
            recordId: t.id,
            kind: 'task',
            title: t.title,
            detail: t.area ? `Task · ${t.area}` : 'Task',
            whenLabel: t.dueTime
              ? `Today · ${formatTime12h(t.dueTime)}`
              : 'Today',
            urgent: t.priority === 'high',
            sortKey: `${t.dueDate}T${t.dueTime || '23:59'}`,
          });
        }
      } else if (t.dueDate <= plus7ISO) {
        const dayStr =
          t.dueDate === tomorrowISO ? 'Tomorrow' : formatShortDate(t.dueDate);
        upcoming.push({
          id: `upcoming-task-${t.id}`,
          recordId: t.id,
          kind: 'task',
          title: t.title,
          detail: t.area ? `Task · ${t.area}` : 'Task',
          whenLabel: t.dueTime
            ? `${dayStr} · ${formatTime12h(t.dueTime)}`
            : dayStr,
          urgent: false,
          sortKey: `${t.dueDate}T${t.dueTime || '23:59'}`,
        });
      }
    }
  }

  // 2. Subscriptions & Trials
  if (preferences.notifySubscriptions !== false) {
    for (const s of subscriptions) {
      if (!s.active) continue;
      const days = getDaysUntil(s.nextBillingDate, todayISO);
      const amountText = `${formatCurrency(s.amount, preferences.currency)}/${s.billingCycle === 'yearly' ? 'yr' : s.billingCycle === 'quarterly' ? 'qtr' : s.billingCycle === 'weekly' ? 'wk' : 'mo'}`;
      if (days < 0) {
        missed.push({
          id: `missed-sub-${s.id}`,
          recordId: s.id,
          kind: 'subscription',
          title: s.isTrial ? `${s.name} trial` : s.name,
          detail: `Renewal · ${amountText}`,
          whenLabel: `${Math.abs(days)}d overdue`,
          urgent: true,
          sortKey: `${s.nextBillingDate}T00:00`,
        });
      } else if (days <= 14) {
        upcoming.push({
          id: `upcoming-sub-${s.id}`,
          recordId: s.id,
          kind: 'subscription',
          title: s.isTrial ? `${s.name} trial ends` : s.name,
          detail: `Renewal · ${amountText}`,
          whenLabel:
            days === 0
              ? 'Today'
              : days === 1
                ? 'Tomorrow'
                : `In ${days}d (${formatShortDate(s.nextBillingDate)})`,
          urgent: days <= 1 || Boolean(s.isTrial),
          sortKey: `${s.nextBillingDate}T09:00`,
        });
      }

      const cardExpStatus = isCardExpiringSoon(s.cardExpiry, now);
      if (cardExpStatus) {
        upcoming.push({
          id: `card-exp-${s.id}`,
          recordId: s.id,
          kind: 'subscription',
          title: `${s.name} card ${s.cardLast4 ? `••${s.cardLast4}` : ''}`.trim(),
          detail: cardExpStatus === 'expired' ? 'Payment card expired' : 'Payment card expiring',
          whenLabel: `Exp ${s.cardExpiry}`,
          urgent: cardExpStatus === 'expired',
          sortKey: `${todayISO}T08:00`,
        });
      }
    }
  }

  // Purchase Return Deadlines
  for (const p of purchases) {
    if (!p.returnByDate || p.isRefund || p.entryType === 'income') continue;
    const daysLeft = getDaysUntil(p.returnByDate, todayISO);
    if (daysLeft >= 0 && daysLeft <= 7) {
      upcoming.push({
        id: `upcoming-return-${p.id}`,
        recordId: p.id,
        kind: 'purchase',
        title: `Return window: ${p.title}`,
        detail: `${formatCurrency(p.amount, preferences.currency)} · Return by`,
        whenLabel:
          daysLeft === 0
            ? 'Today'
            : daysLeft === 1
              ? 'Tomorrow'
              : `${formatShortDate(p.returnByDate)} (${daysLeft}d)`,
        urgent: daysLeft <= 1,
        sortKey: `${p.returnByDate}T10:00`,
      });
    }
  }

  // 3. Habits scheduled today and not yet completed
  if (preferences.notifyHabits !== false) {
    for (const h of habits) {
      if (h.archived || !isHabitScheduledOnDate(h, todayISO)) continue;
      const doneCount = h.logs[todayISO] ?? 0;
      if (doneCount >= h.targetPerDay) continue;
      const targetStr = h.preferredTime || digestTime;
      const prefMin = parseHHMMToMinutes(targetStr) ?? digestMin;
      const progressText =
        h.targetPerDay > 1
          ? `Habit · ${doneCount}/${h.targetPerDay} ${h.unit || 'units'}`
          : h.category
            ? `Habit · ${h.category}`
            : 'Habit';

      if (currentMin > prefMin) {
        missed.push({
          id: `missed-habit-${h.id}`,
          recordId: h.id,
          kind: 'habit',
          title: h.name,
          detail: progressText,
          whenLabel: h.preferredTime
            ? `Target ${formatTime12h(h.preferredTime)}`
            : `Digest ${formatTime12h(digestTime)}`,
          urgent: false,
          sortKey: `${todayISO}T${targetStr}`,
        });
      } else {
        upcoming.push({
          id: `upcoming-habit-${h.id}`,
          recordId: h.id,
          kind: 'habit',
          title: h.name,
          detail: progressText,
          whenLabel: h.preferredTime
            ? `Today · ${formatTime12h(h.preferredTime)}`
            : `Today · ${formatTime12h(digestTime)}`,
          urgent: false,
          sortKey: `${todayISO}T${targetStr}`,
        });
      }
    }
  }

  // 4. Calendar Events (today + next 7 days, including recurring)
  if (preferences.notifyEvents !== false) {
    for (let offset = 0; offset <= 7; offset++) {
      const dateISO = getOffsetDateISO(offset, todayISO);
      for (const ev of calendarEvents) {
        if (!doesEventOccurOnDate(ev, dateISO)) continue;
        if (offset === 0) {
          const endOrStartMin = !ev.allDay
            ? (parseHHMMToMinutes(ev.endTime) ??
              parseHHMMToMinutes(ev.startTime))
            : null;
          if (endOrStartMin !== null && currentMin > endOrStartMin) {
            missed.push({
              id: `missed-event-${ev.id}-${dateISO}`,
              recordId: ev.id,
              kind: 'event',
              title: ev.title,
              detail: ev.location ? `Event · ${ev.location}` : 'Event',
              whenLabel: `Today ${formatTime12h(ev.startTime)}`,
              urgent: false,
              sortKey: `${dateISO}T${ev.startTime || '00:00'}`,
            });
          } else {
            upcoming.push({
              id: `upcoming-event-${ev.id}-${dateISO}`,
              recordId: ev.id,
              kind: 'event',
              title: ev.title,
              detail: ev.location ? `Event · ${ev.location}` : 'Event',
              whenLabel: ev.allDay
                ? 'Today · All day'
                : `Today · ${formatTime12h(ev.startTime)}`,
              urgent: false,
              sortKey: `${dateISO}T${ev.startTime || '00:00'}`,
            });
          }
        } else {
          const dayLabel =
            offset === 1 ? 'Tomorrow' : formatShortDate(dateISO);
          upcoming.push({
            id: `upcoming-event-${ev.id}-${dateISO}`,
            recordId: ev.id,
            kind: 'event',
            title: ev.title,
            detail: ev.location ? `Event · ${ev.location}` : 'Event',
            whenLabel: ev.allDay
              ? `${dayLabel} · All day`
              : ev.startTime
                ? `${dayLabel} · ${formatTime12h(ev.startTime)}`
                : dayLabel,
            urgent: false,
            sortKey: `${dateISO}T${ev.startTime || '00:00'}`,
          });
        }
      }
    }
  }

  // 5. Goals target deadlines
  if (preferences.notifyGoals !== false) {
    for (const g of goals) {
      if (g.status !== 'active' || !g.targetDate) continue;
      const days = getDaysUntil(g.targetDate, todayISO);
      if (days < 0) {
        missed.push({
          id: `missed-goal-${g.id}`,
          recordId: g.id,
          kind: 'goal',
          title: g.title,
          detail: `Goal · ${g.category}`,
          whenLabel: `${Math.abs(days)}d past target`,
          urgent: true,
          sortKey: `${g.targetDate}T09:00`,
        });
      } else if (days <= 14) {
        upcoming.push({
          id: `upcoming-goal-${g.id}`,
          recordId: g.id,
          kind: 'goal',
          title: g.title,
          detail: `Goal · ${g.category}`,
          whenLabel:
            days === 0
              ? 'Today'
              : days === 1
                ? 'Tomorrow'
                : `In ${days}d (${formatShortDate(g.targetDate)})`,
          urgent: days <= 1,
          sortKey: `${g.targetDate}T09:00`,
        });
      }
    }
  }

  missed.sort(
    (a, b) =>
      Number(b.urgent) - Number(a.urgent) || b.sortKey.localeCompare(a.sortKey)
  );
  upcoming.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return { missed, upcoming };
}

function getSentSetForToday(todayISO: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${SENT_LOG_PREFIX}${todayISO}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveSentSetForToday(todayISO: string, set: Set<string>): void {
  try {
    // Cleanup older date keys to keep localStorage tidy
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(SENT_LOG_PREFIX) && k !== `${SENT_LOG_PREFIX}${todayISO}`) {
        localStorage.removeItem(k);
      }
    }
    localStorage.setItem(
      `${SENT_LOG_PREFIX}${todayISO}`,
      JSON.stringify(Array.from(set))
    );
  } catch {
    // Ignore storage quota errors
  }
}

export async function firePendingReminderNotifications(
  params: Parameters<typeof collectDueReminders>[0],
  options?: { forceAll?: boolean }
): Promise<number> {
  if (getNotificationPermission() !== 'granted') return 0;
  if (!options?.forceAll && isWithinQuietHours(params.preferences, params.now)) {
    return 0;
  }

  const todayISO = getTodayISO();
  const due = collectDueReminders(params);
  if (due.length === 0) return 0;

  const sentSet = options?.forceAll ? new Set<string>() : getSentSetForToday(todayISO);
  const unsent = due.filter((item) => !sentSet.has(item.id));
  if (unsent.length === 0) return 0;

  // Dispatch up to 4 notifications at a time; summarize if more
  const batch = unsent.slice(0, 3);
  let sentCount = 0;

  for (const item of batch) {
    const ok = await dispatchLocalNotification(item.title, item.body, item.id);
    if (ok) {
      sentSet.add(item.id);
      sentCount++;
    }
  }

  if (unsent.length > 3) {
    const remaining = unsent.slice(3);
    const ok = await dispatchLocalNotification(
      `+${remaining.length} more MMV-HUB reminders`,
      remaining.map((r) => r.title).join(' · '),
      `mmv-summary-${todayISO}`
    );
    if (ok) {
      for (const item of remaining) {
        sentSet.add(item.id);
      }
      sentCount++;
    }
  }

  if (!options?.forceAll) {
    saveSentSetForToday(todayISO, sentSet);
  }
  return sentCount;
}
