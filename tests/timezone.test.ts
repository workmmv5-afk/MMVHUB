import './setup';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zonedToInstant } from '../src/lib/timezone';

test('wall-clock time in a zone → exact instant (DST-aware)', () => {
  // New York: EST (UTC−5) in November, EDT (UTC−4) in July
  assert.equal(zonedToInstant('2026-11-20', '10:00', 'America/New_York'), Date.UTC(2026, 10, 20, 15, 0));
  assert.equal(zonedToInstant('2026-07-01', '10:00', 'America/New_York'), Date.UTC(2026, 6, 1, 14, 0));
  // Tokyo UTC+9 → previous UTC day
  assert.equal(zonedToInstant('2026-11-20', '06:30', 'Asia/Tokyo'), Date.UTC(2026, 10, 19, 21, 30));
  // Tashkent UTC+5, no DST
  assert.equal(zonedToInstant('2026-06-15', '12:00', 'Asia/Tashkent'), Date.UTC(2026, 5, 15, 7, 0));
  assert.equal(zonedToInstant('2026-03-01', '00:00', 'UTC'), Date.UTC(2026, 2, 1, 0, 0));
});
