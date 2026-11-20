import type { CalendarEventRecord, RecurrenceCycle } from '../types';

export type ImportedEvent = Omit<CalendarEventRecord, 'id' | 'createdAt' | 'updatedAt'>;

const unfold = (text: string) => text.replace(/\r?\n[ \t]/g, '');
const unescape = (v: string) =>
  v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');

function parseDate(v: string): { date: string; time?: string } | null {
  // 20261120 | 20261120T093000 | 20261120T093000Z
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v.trim());
  if (!m) return null;
  if (!m[4]) return { date: `${m[1]}-${m[2]}-${m[3]}` };
  let dt = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  if (m[7]) dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])); // UTC → local
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
  };
}

/** Minimal iCalendar (.ics) VEVENT parser — enough for holiday & export feeds. */
export function parseICS(text: string, limit = 500): ImportedEvent[] {
  const lines = unfold(text).split(/\r?\n/);
  const out: ImportedEvent[] = [];
  let cur: Record<string, string> | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT' && cur) {
      const start = cur.DTSTART ? parseDate(cur.DTSTART) : null;
      if (start && cur.SUMMARY) {
        const end = cur.DTEND ? parseDate(cur.DTEND) : null;
        const allDay = !start.time;
        const freq = /FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/.exec(cur.RRULE ?? '')?.[1];
        // All-day DTEND is exclusive in iCal → multi-day if it ends > 1 day later
        let endDate: string | undefined;
        if (allDay && end && end.date > start.date) {
          const [y, m, d] = end.date.split('-').map(Number);
          const last = new Date(y, m - 1, d - 1);
          const iso = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
          if (iso > start.date) endDate = iso;
        }
        out.push({
          title: unescape(cur.SUMMARY).slice(0, 140),
          date: start.date,
          endDate,
          allDay,
          startTime: start.time,
          endTime: end?.time,
          location: cur.LOCATION ? unescape(cur.LOCATION).slice(0, 140) : undefined,
          notes: cur.DESCRIPTION ? unescape(cur.DESCRIPTION).slice(0, 500) : undefined,
          color: 'blue',
          repeat: (freq?.toLowerCase() as RecurrenceCycle) ?? 'none',
        });
        if (out.length >= limit) break;
      }
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const key = line.slice(0, idx).split(';')[0].toUpperCase();
        cur[key] = line.slice(idx + 1);
      }
    }
  }
  return out;
}
