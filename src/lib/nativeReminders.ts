/**
 * Android app reminders: plan the next days of alerts in JS (same rules as
 * the web reminders + Notification settings) and hand them to the OS alarm
 * scheduler via @capacitor/local-notifications, so they fire while the app
 * is closed.
 */
import type {
  CalendarEventRecord,
  GoalRecord,
  HabitRecord,
  HubPreferences,
  SubscriptionRecord,
  TaskRecord,
} from '../types';
import {
  doesEventOccurOnDate,
  formatCurrency,
  formatTime12h,
  getDaysUntil,
  getOffsetDateISO,
  getTodayISO,
  isHabitScheduledOnDate,
} from './format';
import { resolveNotificationConfig } from './notifications';
import { hashId, isNative, loadLocalNotifications } from './native';

export type PlannedKind = 'task' | 'habit' | 'event' | 'subscription' | 'goal' | 'digest';

export interface PlannedReminder {
  key: string;
  at: Date;
  title: string;
  body: string;
  kind: PlannedKind;
  recordId?: string;
  urgent: boolean;
}

const HORIZON_DAYS = 7;
const MAX_SCHEDULED = 64; // well under Android's 500-alarm cap

function at(dateISO: string, hhmm: string | undefined, fallbackMin: number, minus = 0): Date {
  const [y, m, d] = dateISO.split('-').map(Number);
  let mins = fallbackMin;
  if (hhmm && /^\d{1,2}:\d{2}$/.test(hhmm)) {
    const [h, mm] = hhmm.split(':').map(Number);
    mins = h * 60 + mm;
  }
  return new Date(y, m - 1, d, 0, mins - minus, 0, 0);
}

const minutesOf = (dt: Date) => dt.getHours() * 60 + dt.getMinutes();

function parseHHMM(s: string | undefined, fallback: number): number {
  if (!s || !/^\d{1,2}:\d{2}$/.test(s)) return fallback;
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

export function planReminders(params: {
  tasks: TaskRecord[];
  habits: HabitRecord[];
  subscriptions: SubscriptionRecord[];
  calendarEvents: CalendarEventRecord[];
  goals: GoalRecord[];
  preferences: HubPreferences;
  now?: Date;
}): PlannedReminder[] {
  const { tasks, habits, subscriptions, calendarEvents, goals, preferences } = params;
  const now = params.now ?? new Date();
  const cfg = resolveNotificationConfig(preferences);
  const todayISO = getTodayISO();
  const digestMin = parseHHMM(preferences.dailyDigestTime, 540);
  const out: PlannedReminder[] = [];

  for (let offset = 0; offset < HORIZON_DAYS; offset++) {
    const day = getOffsetDateISO(offset, todayISO);

    if (preferences.notifyTasks !== false) {
      for (const t of tasks) {
        if (t.completed || t.dueDate !== day) continue;
        if (cfg.highPriorityTasksOnly && t.priority !== 'high') continue;
        // Nag mode: repeat urgent timed tasks at +10/+20/+30 min after due
        if (cfg.nagCritical && t.priority === 'high' && t.dueTime) {
          for (const k of [10, 20, 30]) {
            out.push({
              key: `nag-${t.id}-${day}-${k}`,
              at: at(day, t.dueTime, digestMin, -k),
              title: `Still open: ${t.title}`,
              body: `Due ${formatTime12h(t.dueTime)} · tap Done when finished`,
              kind: 'task',
              recordId: t.id,
              urgent: true,
            });
          }
        }
        out.push({
          key: `task-${t.id}-${day}`,
          at: t.dueTime ? at(day, t.dueTime, digestMin, cfg.taskLeadMinutes) : at(day, undefined, digestMin),
          title: t.dueTime ? `${t.title}` : `Due today: ${t.title}`,
          body: t.dueTime
            ? `${cfg.taskLeadMinutes > 0 ? `In ${cfg.taskLeadMinutes} min · ` : ''}${formatTime12h(t.dueTime)}${t.area ? ` · ${t.area}` : ''}`
            : `${t.priority} priority${t.area ? ` · ${t.area}` : ''}`,
          kind: 'task',
          recordId: t.id,
          urgent: t.priority === 'high',
        });
      }
      if (cfg.includeOverdueTasks) {
        // Only tasks that are already overdue now — don't pre-schedule nags
        // for tasks due today/later that may well get done on time.
        const overdue = tasks.filter(
          (t) => !t.completed && t.dueDate && t.dueDate < todayISO &&
            (!cfg.highPriorityTasksOnly || t.priority === 'high')
        );
        if (overdue.length > 0) {
          out.push({
            key: `overdue-${day}`,
            at: at(day, undefined, digestMin),
            title: overdue.length === 1 ? `Overdue: ${overdue[0].title}` : `${overdue.length} overdue tasks`,
            body: overdue.slice(0, 4).map((t) => t.title).join(' · '),
            kind: overdue.length === 1 ? 'task' : 'digest',
            recordId: overdue.length === 1 ? overdue[0].id : undefined,
            urgent: true,
          });
        }
      }
    }

    if (preferences.notifyHabits !== false) {
      for (const h of habits) {
        if (h.archived || !isHabitScheduledOnDate(h, day)) continue;
        if ((h.logs[day] ?? 0) >= h.targetPerDay) continue;
        out.push({
          key: `habit-${h.id}-${day}`,
          at: at(day, h.preferredTime, digestMin),
          title: h.name,
          body: h.targetPerDay > 1 ? `Goal: ${h.targetPerDay} ${h.unit || 'times'}` : 'Keep the streak going',
          kind: 'habit',
          recordId: h.id,
          urgent: false,
        });
      }
    }

    if (preferences.notifyEvents !== false) {
      for (const ev of calendarEvents) {
        if (!doesEventOccurOnDate(ev, day)) continue;
        const lead = ev.reminderOffsetMinutes ?? cfg.eventDefaultLeadMinutes;
        const when = ev.allDay
          ? at(day, undefined, digestMin, lead >= 1440 ? 1440 : 0)
          : at(day, ev.startTime, digestMin, lead);
        out.push({
          key: `event-${ev.id}-${day}`,
          at: when,
          title: ev.title,
          body: ev.allDay
            ? `${lead >= 1440 ? 'Tomorrow' : 'Today'} · All day${ev.location ? ` · ${ev.location}` : ''}`
            : `${lead >= 1440 ? 'Tomorrow ' : ''}${formatTime12h(ev.startTime)}${ev.location ? ` · ${ev.location}` : ''}`,
          kind: 'event',
          recordId: ev.id,
          urgent: false,
        });
      }
    }

    if (cfg.eveningSummaryEnabled) {
      out.push({
        key: `evening-${day}`,
        at: at(day, cfg.eveningSummaryTime, 1260),
        title: 'Evening wrap-up',
        body: 'See what’s left today and what’s next tomorrow',
        kind: 'digest',
        urgent: false,
      });
    }
  }

  if (preferences.notifySubscriptions !== false) {
    for (const s of subscriptions) {
      if (!s.active) continue;
      // Free trials: extra "cancel now?" alert 48h before it converts
      if (s.isTrial) {
        out.push({
          key: `trial48-${s.id}-${s.nextBillingDate}`,
          at: at(getOffsetDateISO(-2, s.nextBillingDate), undefined, digestMin),
          title: `Trial ends in 2 days: ${s.name}`,
          body: 'Keep it or cancel now',
          kind: 'subscription',
          recordId: s.id,
          urgent: true,
        });
      }
      const lead = s.reminderDays ?? cfg.renewalLeadDays;
      const alertDay = getOffsetDateISO(-lead, s.nextBillingDate);
      const days = getDaysUntil(s.nextBillingDate, alertDay);
      out.push({
        key: `sub-${s.id}-${s.nextBillingDate}`,
        at: at(alertDay, undefined, digestMin),
        title: s.isTrial ? `Trial ends: ${s.name}` : `Renews: ${s.name}`,
        body: `${days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`} · ${formatCurrency(s.amount, preferences.currency)}`,
        kind: 'subscription',
        recordId: s.id,
        urgent: Boolean(s.isTrial),
      });
    }
  }

  if (preferences.notifyGoals !== false) {
    for (const g of goals) {
      if (g.status !== 'active' || !g.targetDate) continue;
      out.push({
        key: `goal-${g.id}-${g.targetDate}`,
        at: at(getOffsetDateISO(-3, g.targetDate), undefined, digestMin),
        title: `Goal due soon: ${g.title}`,
        body: 'Target date in 3 days',
        kind: 'goal',
        recordId: g.id,
        urgent: false,
      });
    }
  }

  // Filters: future only, active weekdays, quiet hours
  const qStart = parseHHMM(preferences.quietStart, 1320);
  const qEnd = parseHHMM(preferences.quietEnd, 420);
  const inQuiet = (dt: Date) => {
    if (!preferences.quietHoursEnabled || qStart === qEnd) return false;
    const m = minutesOf(dt);
    return qStart < qEnd ? m >= qStart && m < qEnd : m >= qStart || m < qEnd;
  };
  const days = cfg.activeWeekdays.length > 0 ? cfg.activeWeekdays : [0, 1, 2, 3, 4, 5, 6];
  const horizonEnd = new Date(now.getTime() + HORIZON_DAYS * 86_400_000);

  return out
    .filter((r) => r.at.getTime() > now.getTime() + 30_000 && r.at < horizonEnd)
    .filter((r) => days.includes(r.at.getDay()))
    .filter((r) => !inQuiet(r.at) || (cfg.urgentBypassQuietHours && r.urgent))
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_SCHEDULED);
}

// ---------------------------------------------------------------------------
// Native scheduling
// ---------------------------------------------------------------------------

const SCHEDULED_KEY = 'mmv_native_scheduled_ids';
let lastSignature = '';

/** Phones default to sound ON (the web "chime" defaults off). */
const nativeSound = (p: HubPreferences) => p.notificationConfig?.sound ?? true;

function channelIdFor(cfg: ReturnType<typeof resolveNotificationConfig>, sound: boolean) {
  // Channel settings are immutable after creation → encode them in the id
  return `mmv_rem_${cfg.headsUp ? 'h' : 'd'}${cfg.vibrate ? 'v' : 'n'}${sound ? 's' : 'q'}`;
}

export async function ensureNativeChannels(preferences: HubPreferences): Promise<string> {
  const LN = await loadLocalNotifications();
  const cfg = resolveNotificationConfig(preferences);
  const sound = nativeSound(preferences);
  const id = channelIdFor(cfg, sound);
  const { channels } = await LN.listChannels();
  for (const c of channels) {
    if (c.id.startsWith('mmv_rem_') && c.id !== id) await LN.deleteChannel({ id: c.id });
  }
  if (!channels.some((c) => c.id === id)) {
    await LN.createChannel({
      id,
      name: 'Reminders',
      description: 'Tasks, habits, events, renewals and goals',
      // 4 = pops on screen, 3 = sound only, 2 = silent (shade only)
      importance: !sound ? 2 : cfg.headsUp ? 4 : 3,
      vibration: cfg.vibrate,
      visibility: 0, // private on lock screen
    });
  }
  if (!channels.some((c) => c.id === 'mmv_instant')) {
    await LN.createChannel({
      id: 'mmv_instant',
      name: 'Alerts',
      description: 'Focus timer, tests and instant alerts',
      importance: 4,
      vibration: true,
    });
  }
  await LN.registerActionTypes({
    types: [
      {
        id: 'TASK',
        actions: [
          { id: 'done', title: 'Done' },
          { id: 'snooze', title: `Snooze ${cfg.snoozeMinutes >= 60 ? `${cfg.snoozeMinutes / 60}h` : `${cfg.snoozeMinutes}m`}` },
        ],
      },
      { id: 'HABIT', actions: [{ id: 'done', title: 'Check in' }] },
      { id: 'SUB', actions: [{ id: 'paid', title: 'Mark paid' }] },
    ],
  });
  return id;
}

/** Replace all scheduled MMV-HUB reminders with a fresh plan. Safe to call often. */
export async function syncNativeReminders(
  params: Parameters<typeof planReminders>[0] & { enabled: boolean }
): Promise<number> {
  if (!isNative()) return 0;
  const LN = await loadLocalNotifications();
  const plan = params.enabled ? planReminders(params) : [];
  const cfg = resolveNotificationConfig(params.preferences);
  const signature = JSON.stringify([
    plan.map((p) => [p.key, p.at.getTime(), p.title, p.body]),
    channelIdFor(cfg, nativeSound(params.preferences)),
    cfg.actionButtons,
  ]);
  if (signature === lastSignature) return plan.length;
  lastSignature = signature;

  let previous: number[] = [];
  try {
    previous = JSON.parse(localStorage.getItem(SCHEDULED_KEY) || '[]');
  } catch {
    previous = [];
  }
  if (previous.length > 0) {
    await LN.cancel({ notifications: previous.map((id) => ({ id })) });
  }
  if (plan.length === 0) {
    localStorage.setItem(SCHEDULED_KEY, '[]');
    return 0;
  }

  const channelId = await ensureNativeChannels(params.preferences);
  const notifications = plan.map((p) => ({
    id: hashId(p.key),
    title: p.title,
    body: p.body,
    channelId,
    smallIcon: 'ic_stat_mmv',
    schedule: { at: p.at, allowWhileIdle: true },
    actionTypeId: cfg.actionButtons
      ? p.kind === 'task' && p.recordId
        ? 'TASK'
        : p.kind === 'habit'
          ? 'HABIT'
          : p.kind === 'subscription'
            ? 'SUB'
            : undefined
      : undefined,
    group: 'mmv-reminders',
    extra: { kind: p.kind, recordId: p.recordId ?? '', key: p.key },
  }));
  await LN.schedule({ notifications });
  localStorage.setItem(SCHEDULED_KEY, JSON.stringify(notifications.map((n) => n.id)));
  return notifications.length;
}

const ONGOING_ID = 1_999_999_001;

/** Persistent low-key "today" summary in the notification shade. */
export async function syncOngoingSummary(params: {
  enabled: boolean;
  tasks: TaskRecord[];
  habits: HabitRecord[];
}): Promise<void> {
  if (!isNative()) return;
  const LN = await loadLocalNotifications();
  if (!params.enabled) {
    await LN.cancel({ notifications: [{ id: ONGOING_ID }] }).catch(() => undefined);
    return;
  }
  const today = getTodayISO();
  const tasksLeft = params.tasks.filter((t) => !t.completed && t.dueDate && t.dueDate <= today).length;
  const habitsLeft = params.habits.filter(
    (h) => !h.archived && isHabitScheduledOnDate(h, today) && (h.logs[today] ?? 0) < h.targetPerDay
  ).length;
  const body =
    tasksLeft + habitsLeft === 0
      ? 'All done for today ✓'
      : [tasksLeft ? `${tasksLeft} task${tasksLeft === 1 ? '' : 's'}` : '', habitsLeft ? `${habitsLeft} habit${habitsLeft === 1 ? '' : 's'}` : '']
          .filter(Boolean)
          .join(' · ') + ' left';
  await LN.createChannel({
    id: 'mmv_ongoing',
    name: 'Today summary',
    description: 'Persistent summary of what is left today',
    importance: 2,
    vibration: false,
  }).catch(() => undefined);
  await LN.schedule({
    notifications: [
      {
        id: ONGOING_ID,
        title: 'Today',
        body,
        channelId: 'mmv_ongoing',
        smallIcon: 'ic_stat_mmv',
        ongoing: true,
        autoCancel: false,
        extra: { kind: 'digest', recordId: '' },
      },
    ],
  });
}

const FOCUS_ID = 1_999_999_002;

/** Ongoing "Focus until …" notification while a focus session runs. */
export async function setFocusNotification(endsAt: number | null, title = 'Focus session'): Promise<void> {
  if (!isNative()) return;
  const LN = await loadLocalNotifications();
  if (!endsAt) {
    await LN.cancel({ notifications: [{ id: FOCUS_ID }] }).catch(() => undefined);
    return;
  }
  const end = new Date(endsAt);
  await LN.schedule({
    notifications: [
      {
        id: FOCUS_ID,
        title,
        body: `Until ${formatTime12h(`${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`)} · stay on it`,
        channelId: 'mmv_ongoing',
        smallIcon: 'ic_stat_mmv',
        ongoing: true,
        autoCancel: false,
        extra: { kind: 'digest', recordId: '' },
      },
    ],
  });
}

/** One-off reminder (used by "Snooze" actions). */
export async function scheduleSnooze(title: string, body: string, minutes: number, extra: Record<string, string>) {
  if (!isNative()) return;
  const LN = await loadLocalNotifications();
  await LN.schedule({
    notifications: [
      {
        id: hashId(`snooze-${extra.recordId}-${Date.now()}`),
        title,
        body,
        channelId: 'mmv_instant',
        smallIcon: 'ic_stat_mmv',
        schedule: { at: new Date(Date.now() + minutes * 60_000), allowWhileIdle: true },
        actionTypeId: extra.kind === 'task' ? 'TASK' : undefined,
        extra,
      },
    ],
  });
}

export async function cancelAllNativeReminders() {
  if (!isNative()) return;
  lastSignature = '';
  const LN = await loadLocalNotifications();
  const { notifications } = await LN.getPending();
  if (notifications.length > 0) {
    await LN.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
  }
  localStorage.setItem(SCHEDULED_KEY, '[]');
}
