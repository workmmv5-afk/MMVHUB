/** Per-event time zones: convert a wall-clock time in an IANA zone to local. */

export const deviceTimeZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export const COMMON_ZONES = [
  'Asia/Tashkent',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Asia/Dubai',
  'Asia/Almaty',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Seoul',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
];

/** Offset of `zone` from UTC (minutes) at the given instant. */
function zoneOffsetMinutes(zone: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - utcMs) / 60000);
}

/** Instant (ms) for wall-clock `dateISO hh:mm` in `zone` (DST-safe). */
export function zonedToInstant(dateISO: string, hhmm: string, zone: string): number {
  const [y, m, d] = dateISO.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let instant = guess - zoneOffsetMinutes(zone, guess) * 60000;
  // Re-check once in case the offset differs at the corrected instant (DST edge)
  instant = guess - zoneOffsetMinutes(zone, instant) * 60000;
  return instant;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Wall-clock time in `zone` → device-local date and time. */
export function zonedToLocal(dateISO: string, hhmm: string, zone: string): { date: string; time: string } {
  const dt = new Date(zonedToInstant(dateISO, hhmm, zone));
  return {
    date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
  };
}

/** Short zone label, e.g. "GMT+9" / "EST". */
export function zoneShortName(zone: string, at = Date.now()): string {
  try {
    return (
      new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
        .formatToParts(new Date(at))
        .find((p) => p.type === 'timeZoneName')?.value ?? zone
    );
  } catch {
    return zone;
  }
}

export function zoneCity(zone: string): string {
  return zone === 'UTC' ? 'UTC' : zone.split('/').pop()!.replace(/_/g, ' ');
}
