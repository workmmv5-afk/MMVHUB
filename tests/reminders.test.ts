import { todayAt } from './setup';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getOffsetDateISO, getTodayISO } from '../src/lib/format';
import {
  collectCategorizedReminders,
  collectDueReminders,
  resolveNotificationConfig,
} from '../src/lib/notifications';
import { planReminders } from '../src/lib/nativeReminders';
import type { HubPreferences } from '../src/types';

const today = getTodayISO();
const prefs: HubPreferences = {
  id: 'prefs_default',
  currency: '$',
  monthlyBudget: 1000,
  autoLockMinutes: 0,
  dailyDigestTime: '09:00',
  updatedAt: 0,
};
const task = (id: string, extra: Record<string, unknown>) =>
  ({ id, title: id, completed: false, priority: 'medium', createdAt: 0, updatedAt: 0, ...extra }) as never;
const empty = { habits: [], subscriptions: [], calendarEvents: [] };

test('web: recurring all-day event is due today', () => {
  const ev = { id: 'e', title: 'Standup', date: getOffsetDateISO(-7, today), allDay: true, color: 'blue', repeat: 'daily', createdAt: 0, updatedAt: 0 } as never;
  const due = collectDueReminders({ tasks: [], habits: [], subscriptions: [], calendarEvents: [ev], preferences: { ...prefs, dailyDigestTime: '00:00' } });
  assert.deepEqual(due.map((d) => d.kind), ['event']);
});

test('web: task filters', () => {
  const tasks = [task('lo', { dueDate: getOffsetDateISO(-1, today) }), task('hi', { priority: 'high', dueDate: getOffsetDateISO(-1, today) })];
  const hi = collectDueReminders({ tasks, ...empty, preferences: { ...prefs, notificationConfig: { highPriorityTasksOnly: true } } });
  assert.deepEqual(hi.map((r) => r.id), ['task-overdue-hi']);
  assert.equal(collectDueReminders({ tasks, ...empty, preferences: { ...prefs, notificationConfig: { includeOverdueTasks: false } } }).length, 0);
});

test('bell horizon', () => {
  const far = [task('far', { dueDate: getOffsetDateISO(20, today) })];
  assert.equal(collectCategorizedReminders({ tasks: far, ...empty, preferences: prefs }).upcoming.length, 0);
  assert.equal(
    collectCategorizedReminders({ tasks: far, ...empty, preferences: { ...prefs, notificationConfig: { bellHorizonDays: 30 } } }).upcoming.length,
    1
  );
});

test('config is clamped', () => {
  const c = resolveNotificationConfig({ notificationConfig: { maxPerBatch: 999, taskLeadMinutes: -5, activeWeekdays: [1, 9, 3] } });
  assert.equal(c.maxPerBatch, 10);
  assert.equal(c.taskLeadMinutes, 0);
  assert.deepEqual(c.activeWeekdays, [1, 3]);
});

test('phone: timed task fires at lead time; past times skipped', () => {
  const now = todayAt(8);
  const p = planReminders({ ...empty, goals: [], preferences: prefs, now, tasks: [task('t', { dueDate: today, dueTime: '10:00' })] });
  assert.deepEqual(p.map((r) => `${r.at.getHours()}:${r.at.getMinutes()}`), ['9:45']);
  assert.equal(planReminders({ ...empty, goals: [], preferences: prefs, now, tasks: [task('t', { dueDate: today, dueTime: '07:00' })] }).length, 0);
});

test('phone: no pre-scheduled overdue nags for tasks due today', () => {
  const p = planReminders({ ...empty, goals: [], preferences: prefs, now: todayAt(8), tasks: [task('t', { dueDate: today, dueTime: '10:00' })] });
  assert.equal(p.filter((r) => r.key.startsWith('overdue')).length, 0);
});

test('phone: quiet hours + urgent bypass + nag', () => {
  const now = todayAt(8);
  const late = [task('t', { dueDate: today, dueTime: '23:30', priority: 'high' })];
  const q = { ...prefs, quietHoursEnabled: true, quietStart: '22:00', quietEnd: '07:00' };
  assert.equal(planReminders({ ...empty, goals: [], now, tasks: late, preferences: { ...q, notificationConfig: { taskLeadMinutes: 0 } } }).length, 0);
  assert.equal(
    planReminders({ ...empty, goals: [], now, tasks: late, preferences: { ...q, notificationConfig: { taskLeadMinutes: 0, urgentBypassQuietHours: true } } }).length,
    1
  );
  const nag = planReminders({
    ...empty,
    goals: [],
    now,
    tasks: [task('h', { dueDate: today, dueTime: '12:00', priority: 'high' })],
    preferences: { ...prefs, notificationConfig: { nagCritical: true } },
  });
  assert.deepEqual(
    nag.map((r) => `${r.at.getHours()}:${String(r.at.getMinutes()).padStart(2, '0')}`),
    ['11:45', '12:10', '12:20', '12:30']
  );
});

test('phone: trial gets an extra 48h alert', () => {
  const trial = { id: 's', name: 'Pro', amount: 5, billingCycle: 'monthly', nextBillingDate: getOffsetDateISO(5, today), category: 'Other', paymentMethod: 'Card', active: true, isTrial: true, createdAt: 0, updatedAt: 0 } as never;
  const p = planReminders({ tasks: [], habits: [], calendarEvents: [], goals: [], subscriptions: [trial], preferences: prefs, now: todayAt(8) });
  assert.deepEqual(p.map((r) => r.key.split('-')[0]), ['sub', 'trial48']);
});
