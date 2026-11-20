import type {
  CalendarEventRecord,
  GoalRecord,
  HabitRecord,
  HubPreferences,
  NotificationConfig,
  PurchaseRecord,
  SubscriptionRecord,
  TaskRecord,
} from '../types';
import {
  doesEventOccurOnDate,
  formatCurrency,
  formatShortDate,
  formatTime12h,
  getDaysUntil,
  getOffsetDateISO,
  getTodayISO,
  isHabitScheduledOnDate,
} from './format';
import { hashId, isNative, loadLocalNotifications } from './native';

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

export const NATIVE_INSTANT_CHANNEL = 'mmv_instant';

const SENT_LOG_PREFIX = 'mmv_notif_sent_';
const EVENING_LOG_KEY = 'mmv_notif_evening_sent';

// ---------------------------------------------------------------------------
// Notification customization
// ---------------------------------------------------------------------------

export const DEFAULT_NOTIFICATION_CONFIG: Required<NotificationConfig> = {
  deliveryMode: 'individual',
  maxPerBatch: 3,
  sound: false,
  taskLeadMinutes: 15,
  includeOverdueTasks: true,
  highPriorityTasksOnly: false,
  eventDefaultLeadMinutes: 30,
  renewalLeadDays: 3,
  notifyReturnWindows: true,
  returnWindowDays: 3,
  urgentBypassQuietHours: false,
  activeWeekdays: [0, 1, 2, 3, 4, 5, 6],
  eveningSummaryEnabled: false,
  eveningSummaryTime: '21:00',
  bellHorizonDays: 7,
  showBadge: true,
  headsUp: true,
  vibrate: true,
  actionButtons: true,
  snoozeMinutes: 60,
  nagCritical: false,
};

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Merge stored (possibly partial / older) config with safe defaults. */
export function resolveNotificationConfig(
  preferences: Pick<HubPreferences, 'notificationConfig'>
): Required<NotificationConfig> {
  const raw = preferences.notificationConfig ?? {};
  const d = DEFAULT_NOTIFICATION_CONFIG;
  const weekdays = Array.isArray(raw.activeWeekdays)
    ? raw.activeWeekdays.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : d.activeWeekdays;
  return {
    deliveryMode: raw.deliveryMode === 'digest' ? 'digest' : 'individual',
    maxPerBatch: clampInt(raw.maxPerBatch, 1, 10, d.maxPerBatch),
    sound: raw.sound ?? d.sound,
    taskLeadMinutes: clampInt(raw.taskLeadMinutes, 0, 1440, d.taskLeadMinutes),
    includeOverdueTasks: raw.includeOverdueTasks ?? d.includeOverdueTasks,
    highPriorityTasksOnly: raw.highPriorityTasksOnly ?? d.highPriorityTasksOnly,
    eventDefaultLeadMinutes: clampInt(
      raw.eventDefaultLeadMinutes,
      0,
      1440,
      d.eventDefaultLeadMinutes
    ),
    renewalLeadDays: clampInt(raw.renewalLeadDays, 0, 30, d.renewalLeadDays),
    notifyReturnWindows: raw.notifyReturnWindows ?? d.notifyReturnWindows,
    returnWindowDays: clampInt(raw.returnWindowDays, 0, 30, d.returnWindowDays),
    urgentBypassQuietHours:
      raw.urgentBypassQuietHours ?? d.urgentBypassQuietHours,
    activeWeekdays: weekdays,
    eveningSummaryEnabled: raw.eveningSummaryEnabled ?? d.eveningSummaryEnabled,
    eveningSummaryTime:
      raw.eveningSummaryTime && /^\d{2}:\d{2}$/.test(raw.eveningSummaryTime)
        ? raw.eveningSummaryTime
        : d.eveningSummaryTime,
    bellHorizonDays: clampInt(raw.bellHorizonDays, 1, 30, d.bellHorizonDays),
    showBadge: raw.showBadge ?? d.showBadge,
    headsUp: raw.headsUp ?? d.headsUp,
    vibrate: raw.vibrate ?? d.vibrate,
    actionButtons: raw.actionButtons ?? d.actionButtons,
    snoozeMinutes: clampInt(raw.snoozeMinutes, 5, 1440, d.snoozeMinutes),
    nagCritical: raw.nagCritical ?? d.nagCritical,
  };
}

export function isNotificationDayActive(
  preferences: HubPreferences,
  now = new Date()
): boolean {
  const { activeWeekdays } = resolveNotificationConfig(preferences);
  // An empty selection is treated as "every day" so users can't silently
  // disable all alerts by un-ticking every chip.
  if (activeWeekdays.length === 0) return true;
  return activeWeekdays.includes(now.getDay());
}

// ---------------------------------------------------------------------------
// Permission + dispatch
// ---------------------------------------------------------------------------

// In the Android app, permission lives in the native layer; cache it so the
// synchronous getter keeps working.
let nativePermission: NotificationPermission = 'default';

export async function refreshNativeNotificationPermission(): Promise<NotificationPermission> {
  if (!isNative()) return getNotificationPermission() as NotificationPermission;
  const LN = await loadLocalNotifications();
  const { display } = await LN.checkPermissions();
  nativePermission =
    display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'default';
  return nativePermission;
}

export function getNotificationPermission():
  | NotificationPermission
  | 'unsupported' {
  if (isNative()) return nativePermission;
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (isNative()) {
    const LN = await loadLocalNotifications();
    const { display } = await LN.requestPermissions();
    nativePermission =
      display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'default';
    return nativePermission;
  }
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
    osc.onended = () => void ctx.close();
  } catch {
    // Ignore audio context block before user gesture
  }
}

export async function dispatchLocalNotification(
  title: string,
  body: string,
  tag?: string,
  options?: { silent?: boolean; requireInteraction?: boolean }
): Promise<boolean> {
  if (getNotificationPermission() !== 'granted') return false;

  if (isNative()) {
    try {
      const LN = await loadLocalNotifications();
      await LN.schedule({
        notifications: [
          {
            id: hashId(tag || `${title}-${Date.now()}`),
            title,
            body,
            channelId: NATIVE_INSTANT_CHANNEL,
            smallIcon: 'ic_stat_mmv',
            extra: { url: 'mmvhub://open/home' },
          },
        ],
      });
      return true;
    } catch {
      return false;
    }
  }

  const opts: NotificationOptions = {
    body,
    tag,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    silent: options?.silent,
    requireInteraction: options?.requireInteraction,
    // Read by public/notification-handler.js to focus/open the app on click
    data: { url: '/' },
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, opts);
        return true;
      }
    }
  } catch {
    // Fall back to standard Notification API
  }

  try {
    const n = new Notification(title, opts);
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

/** Sets/clears the PWA app-icon badge where supported (Chromium, installed PWAs). */
export function updateAppBadge(count: number): void {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (count > 0 && nav.setAppBadge) {
      void nav.setAppBadge(count).catch(() => undefined);
    } else if (nav.clearAppBadge) {
      void nav.clearAppBadge().catch(() => undefined);
    }
  } catch {
    // Unsupported
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

function formatLead(minutes: number): string {
  if (minutes <= 0) return 'now';
  if (minutes < 60) return `in ${minutes}m`;
  if (minutes % 60 === 0) return `in ${minutes / 60}h`;
  return `in ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// ---------------------------------------------------------------------------
// Due reminders (what fires as a system notification right now)
// ---------------------------------------------------------------------------

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
  const cfg = resolveNotificationConfig(preferences);
  const todayISO = getTodayISO();
  const tomorrowISO = getOffsetDateISO(1, todayISO);
  const currentMin = nowMinutesOfDay(now);
  const digestMin = parseHHMMToMinutes(preferences.dailyDigestTime ?? '09:00') ?? 540;
  const reminders: ReminderItem[] = [];

  // 1. Tasks (overdue or due today when time/digest reached)
  if (preferences.notifyTasks !== false) {
    for (const t of tasks) {
      if (t.completed || !t.dueDate) continue;
      if (cfg.highPriorityTasksOnly && t.priority !== 'high') continue;
      if (t.dueDate < todayISO) {
        if (!cfg.includeOverdueTasks) continue;
        reminders.push({
          id: `task-overdue-${t.id}`,
          kind: 'task',
          title: `Overdue task: ${t.title}`,
          body: `Was due ${formatShortDate(t.dueDate)}${t.area ? ` · ${t.area}` : ''}`,
          dueLabel: 'Overdue',
          urgent: true,
        });
      } else if (t.dueDate === todayISO) {
        const dueMin = parseHHMMToMinutes(t.dueTime);
        const triggerMin =
          dueMin !== null ? Math.max(0, dueMin - cfg.taskLeadMinutes) : digestMin;
        if (currentMin >= triggerMin) {
          const minsLeft = dueMin !== null ? dueMin - currentMin : null;
          reminders.push({
            id: `task-today-${t.id}`,
            kind: 'task',
            title: `Task due today: ${t.title}`,
            body: t.dueTime
              ? `Scheduled for ${formatTime12h(t.dueTime)}${
                  minsLeft !== null && minsLeft > 0 ? ` (${formatLead(minsLeft)})` : ''
                }`
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
      const windowDays = s.reminderDays ?? cfg.renewalLeadDays;
      if (days <= windowDays && currentMin >= digestMin) {
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

  // 3. Calendar Events (incl. recurring) honoring per-event or default offset
  if (preferences.notifyEvents !== false) {
    for (const ev of calendarEvents) {
      const offsetMins = ev.reminderOffsetMinutes ?? cfg.eventDefaultLeadMinutes;
      if (
        offsetMins >= 1440 &&
        doesEventOccurOnDate(ev, tomorrowISO) &&
        currentMin >= digestMin
      ) {
        reminders.push({
          id: `event-pre-${ev.id}-${tomorrowISO}`,
          kind: 'event',
          title: `Tomorrow: ${ev.title}`,
          body: ev.allDay ? 'All day event' : `Starts ${formatTime12h(ev.startTime)}`,
          dueLabel: 'Tomorrow',
          urgent: false,
        });
      }
      if (!doesEventOccurOnDate(ev, todayISO)) continue;
      const startMin = parseHHMMToMinutes(ev.startTime);
      const endMin = parseHHMMToMinutes(ev.endTime) ?? startMin;
      // Don't alert for timed events that already ended
      if (!ev.allDay && endMin !== null && currentMin > endMin) continue;
      const triggerMin =
        !ev.allDay && startMin !== null
          ? Math.max(0, startMin - (offsetMins >= 1440 ? 0 : offsetMins))
          : digestMin;
      if (currentMin >= triggerMin) {
        reminders.push({
          id: `event-today-${ev.id}-${todayISO}`,
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

  // 5. Purchase return-window deadlines
  if (cfg.notifyReturnWindows) {
    for (const p of purchases) {
      if (!p.returnByDate || p.isRefund || p.entryType === 'income') continue;
      const daysLeft = getDaysUntil(p.returnByDate, todayISO);
      if (daysLeft >= 0 && daysLeft <= cfg.returnWindowDays) {
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
  }

  // 6. Goal target deadlines within 3 days or overdue
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

// ---------------------------------------------------------------------------
// Bell popover (Upcoming / Missed)
// ---------------------------------------------------------------------------

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

  const cfg = resolveNotificationConfig(preferences);
  const horizon = cfg.bellHorizonDays;
  const todayISO = getTodayISO();
  const tomorrowISO = getOffsetDateISO(1, todayISO);
  const horizonISO = getOffsetDateISO(horizon, todayISO);
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
      } else if (t.dueDate <= horizonISO) {
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
      } else if (days <= Math.max(horizon, 14)) {
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
  if (cfg.notifyReturnWindows) {
    for (const p of purchases) {
      if (!p.returnByDate || p.isRefund || p.entryType === 'income') continue;
      const daysLeft = getDaysUntil(p.returnByDate, todayISO);
      if (daysLeft >= 0 && daysLeft <= Math.max(horizon, cfg.returnWindowDays)) {
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

  // 4. Calendar Events (today + horizon, including recurring)
  if (preferences.notifyEvents !== false) {
    for (let offset = 0; offset <= horizon; offset++) {
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
      } else if (days <= Math.max(horizon, 14)) {
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

// ---------------------------------------------------------------------------
// Sent log (dedupe per day)
// ---------------------------------------------------------------------------

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
    // Collect stale keys first; removing while iterating by index skips keys.
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(SENT_LOG_PREFIX) && k !== `${SENT_LOG_PREFIX}${todayISO}`) {
        stale.push(k);
      }
    }
    for (const k of stale) localStorage.removeItem(k);
    localStorage.setItem(
      `${SENT_LOG_PREFIX}${todayISO}`,
      JSON.stringify(Array.from(set))
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function clearNotificationSentLog(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(SENT_LOG_PREFIX) || k === EVENING_LOG_KEY)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Firing
// ---------------------------------------------------------------------------

export async function firePendingReminderNotifications(
  params: Parameters<typeof collectDueReminders>[0],
  options?: { forceAll?: boolean }
): Promise<number> {
  if (getNotificationPermission() !== 'granted') return 0;
  const now = params.now ?? new Date();
  const cfg = resolveNotificationConfig(params.preferences);

  if (!options?.forceAll && !isNotificationDayActive(params.preferences, now)) {
    return 0;
  }
  const quiet =
    !options?.forceAll && isWithinQuietHours(params.preferences, now);

  const todayISO = getTodayISO();
  let due = collectDueReminders({ ...params, now });
  if (quiet) {
    if (!cfg.urgentBypassQuietHours) return 0;
    due = due.filter((r) => r.urgent);
  }
  if (due.length === 0) return 0;

  const sentSet = getSentSetForToday(todayISO);
  const unsent = options?.forceAll
    ? due
    : due.filter((item) => !sentSet.has(item.id));
  if (unsent.length === 0) return 0;

  let sentCount = 0;
  const silent = !cfg.sound;

  if (cfg.deliveryMode === 'digest' && unsent.length > 1) {
    const urgentCount = unsent.filter((r) => r.urgent).length;
    const ok = await dispatchLocalNotification(
      `MMV-HUB: ${unsent.length} reminders${urgentCount ? ` (${urgentCount} urgent)` : ''}`,
      unsent
        .slice(0, 6)
        .map((r) => `• ${r.title}`)
        .join('\n') + (unsent.length > 6 ? `\n+${unsent.length - 6} more` : ''),
      `mmv-digest-${todayISO}`,
      { silent }
    );
    if (ok) {
      for (const item of unsent) sentSet.add(item.id);
      sentCount = 1;
    }
  } else {
    const limit = cfg.maxPerBatch;
    const batch = unsent.slice(0, limit);
    for (const item of batch) {
      const ok = await dispatchLocalNotification(item.title, item.body, item.id, {
        silent,
        requireInteraction: item.urgent,
      });
      if (ok) {
        sentSet.add(item.id);
        sentCount++;
      }
    }

    if (unsent.length > limit) {
      const remaining = unsent.slice(limit);
      const ok = await dispatchLocalNotification(
        `+${remaining.length} more MMV-HUB reminders`,
        remaining.map((r) => r.title).join(' · '),
        `mmv-summary-${todayISO}`,
        { silent }
      );
      if (ok) {
        for (const item of remaining) sentSet.add(item.id);
        sentCount++;
      }
    }
  }

  if (sentCount > 0 && cfg.sound) playSubtleChime();

  // Always record what was delivered (also for manual "send now") so the
  // automatic loop doesn't immediately re-send the same alerts.
  saveSentSetForToday(todayISO, sentSet);
  return sentCount;
}

/** Optional once-a-day evening wrap-up. Returns true when it fired. */
export async function maybeFireEveningSummary(params: {
  tasks: TaskRecord[];
  habits: HabitRecord[];
  calendarEvents: CalendarEventRecord[];
  preferences: HubPreferences;
  now?: Date;
}): Promise<boolean> {
  const { tasks, habits, calendarEvents, preferences, now = new Date() } = params;
  const cfg = resolveNotificationConfig(preferences);
  if (!cfg.eveningSummaryEnabled) return false;
  if (getNotificationPermission() !== 'granted') return false;
  if (!isNotificationDayActive(preferences, now)) return false;

  const triggerMin = parseHHMMToMinutes(cfg.eveningSummaryTime) ?? 1260;
  if (nowMinutesOfDay(now) < triggerMin) return false;

  const todayISO = getTodayISO();
  try {
    if (localStorage.getItem(EVENING_LOG_KEY) === todayISO) return false;
  } catch {
    // ignore
  }

  const tomorrowISO = getOffsetDateISO(1, todayISO);
  const habitsLeft = habits.filter(
    (h) =>
      !h.archived &&
      isHabitScheduledOnDate(h, todayISO) &&
      (h.logs[todayISO] ?? 0) < h.targetPerDay
  ).length;
  const tasksLeft = tasks.filter(
    (t) => !t.completed && t.dueDate && t.dueDate <= todayISO
  ).length;
  const tomorrowEvents = calendarEvents
    .filter((ev) => doesEventOccurOnDate(ev, tomorrowISO))
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  const tomorrowTasks = tasks.filter(
    (t) => !t.completed && t.dueDate === tomorrowISO
  ).length;

  const lines: string[] = [];
  lines.push(
    habitsLeft === 0 && tasksLeft === 0
      ? 'All done for today — nice work.'
      : `${habitsLeft} habit${habitsLeft === 1 ? '' : 's'} and ${tasksLeft} task${tasksLeft === 1 ? '' : 's'} still open today.`
  );
  if (tomorrowEvents.length > 0) {
    const first = tomorrowEvents[0];
    lines.push(
      `Tomorrow: ${first.title}${first.allDay ? ' (all day)' : ` at ${formatTime12h(first.startTime)}`}`
    );
  }
  if (tomorrowTasks > 0) {
    lines.push(`${tomorrowTasks} task${tomorrowTasks === 1 ? '' : 's'} due tomorrow.`);
  }

  const ok = await dispatchLocalNotification(
    'Evening wrap-up',
    lines.join('\n'),
    `mmv-evening-${todayISO}`,
    { silent: !cfg.sound }
  );
  if (ok) {
    try {
      localStorage.setItem(EVENING_LOG_KEY, todayISO);
    } catch {
      // ignore
    }
  }
  return ok;
}
