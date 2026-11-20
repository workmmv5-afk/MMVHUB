import './setup';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceDateByCycle,
  doesEventOccurOnDate,
  eventDisplayTitle,
  computeGoalProgress,
} from '../src/lib/format';
import { parseICS } from '../src/lib/ics';

test('month arithmetic clamps to month end', () => {
  assert.equal(advanceDateByCycle('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(advanceDateByCycle('2028-01-31', 'monthly'), '2028-02-29');
  assert.equal(advanceDateByCycle('2026-11-30', 'quarterly'), '2027-02-28');
  assert.equal(advanceDateByCycle('2028-02-29', 'yearly'), '2029-02-28');
  assert.equal(advanceDateByCycle('2026-03-15', 'monthly'), '2026-04-15');
  assert.equal(advanceDateByCycle('2026-12-31', 'daily'), '2027-01-01');
});

test('recurring and multi-day events', () => {
  assert.equal(doesEventOccurOnDate({ date: '2026-11-02', repeat: 'weekly' }, '2026-11-16'), true);
  assert.equal(doesEventOccurOnDate({ date: '2026-11-02', repeat: 'weekly' }, '2026-11-17'), false);
  assert.equal(doesEventOccurOnDate({ date: '2026-11-20', repeat: 'daily' }, '2026-11-19'), false);
  const trip = { date: '2026-12-24', endDate: '2026-12-26', repeat: 'none' as const };
  assert.equal(doesEventOccurOnDate(trip, '2026-12-25'), true);
  assert.equal(doesEventOccurOnDate(trip, '2026-12-26'), true);
  assert.equal(doesEventOccurOnDate(trip, '2026-12-27'), false);
});

test('birthday ages', () => {
  assert.equal(eventDisplayTitle({ title: 'Mom', birthYear: 1966, repeat: 'yearly' }, '2026-05-10'), 'Mom · 60');
  assert.equal(eventDisplayTitle({ title: 'X', birthYear: 1966, repeat: 'none' }, '2026-05-10'), 'X');
});

test('ICS import', () => {
  const CRLF = '\r\n';
  const BS = '\\';
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    `SUMMARY:Team sync${BS}, weekly`,
    'DTSTART:20261123T090000',
    'DTEND:20261123T093000',
    'RRULE:FREQ=WEEKLY;BYDAY=MO',
    'LOCATION:Room 4',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'SUMMARY:Holiday trip',
    'DTSTART;VALUE=DATE:20261224',
    'DTEND;VALUE=DATE:20261227',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'SUMMARY:Notes',
    'DTSTART;VALUE=DATE:20261201',
    `DESCRIPTION:line one${BS}nline`,
    '  two folded',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join(CRLF);
  const ev = parseICS(ics);
  assert.equal(ev.length, 3);
  assert.deepEqual(
    [ev[0].title, ev[0].date, ev[0].startTime, ev[0].endTime, ev[0].repeat, ev[0].location],
    ['Team sync, weekly', '2026-11-23', '09:00', '09:30', 'weekly', 'Room 4']
  );
  assert.deepEqual([ev[1].allDay, ev[1].endDate], [true, '2026-12-26']);
  assert.equal(ev[2].notes, 'line one\nline two folded');
});

test('goal progress modes', () => {
  const base = { id: 'g', title: 'Save', category: 'Finance', color: 'blue' as const, status: 'active' as const, createdAt: 0, updatedAt: 0 };
  assert.equal(computeGoalProgress({ ...base, progressMode: 'numeric', currentValue: 250, targetValue: 1000 }, [], []).pct, 25);
  assert.equal(
    computeGoalProgress(
      { ...base, progressMode: 'milestones', milestones: [{ id: 'a', title: 'a', done: true }, { id: 'b', title: 'b', done: false }] },
      [],
      []
    ).pct,
    50
  );
  assert.equal(computeGoalProgress({ ...base, status: 'completed', progressMode: 'numeric', currentValue: 1, targetValue: 10 }, [], []).pct, 100);
});
