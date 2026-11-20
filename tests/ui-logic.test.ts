import './setup';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getOffsetDateISO, getTodayISO } from '../src/lib/format';
import { resolveHomeWidgets } from '../src/lib/homeWidgets';
import { buildWidgetSnapshot } from '../src/lib/widgetSnapshot';
import { missingKeys, setLanguage, t, getLocale } from '../src/lib/i18n';
import type { HubPreferences } from '../src/types';

const prefs: HubPreferences = { id: 'prefs_default', currency: '$', monthlyBudget: 1000, autoLockMinutes: 0, updatedAt: 0 };

test('home widget layout tolerates old/bad saved data', () => {
  const w = resolveHomeWidgets({
    homeWidgets: [
      { id: 'note', visible: true, size: 'full' },
      { id: 'note', visible: false, size: 'half' },
      { id: 'bogus' as never, visible: true, size: 'half' },
      { id: 'snapshot', visible: true, size: 'half' },
    ],
  });
  assert.deepEqual(w[0], { id: 'note', visible: true, size: 'full' });
  assert.deepEqual(w[1], { id: 'snapshot', visible: true, size: 'full' }, 'non-resizable stays full');
  assert.equal(new Set(w.map((x) => x.id)).size, w.length, 'no duplicates');
});

test('phone widget snapshot', () => {
  setLanguage('en');
  const today = getTodayISO();
  const task = (id: string, extra: object) => ({ id, title: id, completed: false, priority: 'medium', createdAt: 0, updatedAt: 0, ...extra });
  const snap = buildWidgetSnapshot({
    tasks: [task('a', { dueDate: today }), task('b', { dueDate: today, completed: true }), task('c', { dueDate: getOffsetDateISO(-2, today) })] as never,
    habits: [{ id: 'h', name: 'Read', cadence: 'daily', targetPerDay: 1, logs: { [today]: 1 }, createdAt: 0, updatedAt: 0 }] as never,
    calendarEvents: [],
    subscriptions: [],
    purchases: [{ id: 'p', title: 'x', amount: 250, category: 'Other', paymentMethod: 'Card', date: today, createdAt: 0, updatedAt: 0 }] as never,
    goals: [],
    preferences: prefs,
    locked: false,
  }) as { day: string; today: { done: number; total: number; items: { id: string }[] }; spend: { pct: number } };
  assert.equal(snap.day, today);
  assert.deepEqual([snap.today.done, snap.today.total], [2, 3]);
  assert.deepEqual(snap.today.items.map((i) => i.id), ['c', 'a'], 'overdue first, completed hidden');
  assert.equal(snap.spend.pct, 25);
  const locked = buildWidgetSnapshot({ tasks: [], habits: [], calendarEvents: [], subscriptions: [], purchases: [], goals: [], preferences: prefs, locked: true });
  assert.equal('today' in locked, false, 'locked snapshot carries no data');
});

test('translations are complete and interpolate', () => {
  assert.deepEqual(missingKeys('uz'), []);
  assert.deepEqual(missingKeys('ru'), []);
  setLanguage('uz');
  assert.equal(t('gate.wrongPinLeft', { n: 2 }), 'PIN-kod noto‘g‘ri · 2 ta urinish qoldi');
  assert.equal(getLocale(), 'uz-Latn-UZ');
  setLanguage('ru');
  assert.equal(t('push.overdueMany', { n: 3 }), 'Просроченных задач: 3');
  assert.equal(t('missing.key'), 'missing.key');
  setLanguage('en');
});
