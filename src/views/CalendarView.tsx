import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  MapPin,
  Plus,
  Repeat,
} from 'lucide-react';
import { useVault } from '../context/VaultContext';
import type {
  CalendarColor,
  CalendarEventRecord,
  RecurrenceCycle,
  SubscriptionRecord,
  TaskRecord,
} from '../types';
import {
  buildCalendarICS,
  formatCurrency,
  formatMonthLabel,
  formatShortDate,
  formatTime12h,
  getDaysUntil,
  getMonthKey,
  getTodayISO,
  shiftMonthKey,
} from '../lib/format';

interface CalendarViewProps {
  onNewEvent: (dateISO?: string) => void;
  onEditEvent: (event: CalendarEventRecord) => void;
  onEditTask: (task: TaskRecord) => void;
  onEditSubscription: (sub: SubscriptionRecord) => void;
}

type CalendarMode = 'month' | 'week' | 'schedule';

const COLOR_BAR_STYLES: Record<CalendarColor, string> = {
  blue: 'bg-[#C2E7FF] text-[#001D35] dark:bg-[#004A77] dark:text-[#C2E7FF]',
  green: 'bg-[#E6F4EA] text-[#146C2E] dark:bg-[#0A3818] dark:text-[#6DD58C]',
  amber: 'bg-[#FEF7E0] text-[#6B4E00] dark:bg-[#413000] dark:text-[#FCD663]',
  red: 'bg-[#FCE8E6] text-[#B3261E] dark:bg-[#601410] dark:text-[#F2B8B5]',
  purple: 'bg-[#F3EDF7] text-[#4F378B] dark:bg-[#381E72] dark:text-[#D0BCFF]',
};

const COLOR_DOT_STYLES: Record<CalendarColor, string> = {
  blue: 'bg-[#0B57D0] dark:bg-[#A8C7FA]',
  green: 'bg-[#146C2E] dark:bg-[#6DD58C]',
  amber: 'bg-[#B06000] dark:bg-[#FCD663]',
  red: 'bg-[#B3261E] dark:bg-[#F2B8B5]',
  purple: 'bg-[#6750A4] dark:bg-[#D0BCFF]',
};

function matchesRecurrence(
  originISO: string,
  targetISO: string,
  repeat: RecurrenceCycle = 'none'
): boolean {
  if (originISO === targetISO) return true;
  if (repeat === 'none' || targetISO < originISO) return false;
  if (repeat === 'daily') return true;
  const [y1, m1, d1] = originISO.split('-').map(Number);
  const [y2, m2, d2] = targetISO.split('-').map(Number);
  const dt1 = new Date(y1, m1 - 1, d1);
  const dt2 = new Date(y2, m2 - 1, d2);
  if (repeat === 'weekly') return dt1.getDay() === dt2.getDay();
  if (repeat === 'monthly') return d1 === d2;
  if (repeat === 'yearly') return m1 === m2 && d1 === d2;
  return false;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  onNewEvent,
  onEditEvent,
  onEditTask,
  onEditSubscription,
}) => {
  const {
    calendarEvents,
    tasks,
    subscriptions,
    preferences,
    toggleTaskCompleted,
  } = useVault();

  const todayISO = getTodayISO();
  const [viewMode, setViewMode] = useState<CalendarMode>('month');
  const [monthKey, setMonthKey] = useState(() => getMonthKey(todayISO));
  const [selectedDate, setSelectedDate] = useState(todayISO);

  // Google Calendar layer toggles
  const [showEvents, setShowEvents] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showRenewals, setShowRenewals] = useState(true);

  const startsMonday = preferences.weekStartsOn === 'monday';

  const weekdayHeaders = useMemo(
    () =>
      startsMonday
        ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    [startsMonday]
  );

  const monthCells = useMemo(() => {
    const [yStr, mStr] = monthKey.split('-');
    const year = Number(yStr);
    const monthIdx = Number(mStr) - 1;
    const firstDay = new Date(year, monthIdx, 1);
    const rawWeekday = firstDay.getDay();
    const startOffset = startsMonday ? (rawWeekday + 6) % 7 : rawWeekday;
    const gridStart = new Date(year, monthIdx, 1 - startOffset);

    return Array.from({ length: 42 }, (_, i) => {
      const dt = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + i
      );
      const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      return {
        iso,
        dayNum: dt.getDate(),
        inCurrentMonth: dt.getMonth() === monthIdx,
        isToday: iso === todayISO,
      };
    });
  }, [monthKey, todayISO, startsMonday]);

  const weekDates = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const curr = new Date(y, m - 1, d);
    const rawWeekday = curr.getDay();
    const weekOffset = startsMonday ? (rawWeekday + 6) % 7 : rawWeekday;
    const weekStart = new Date(
      curr.getFullYear(),
      curr.getMonth(),
      curr.getDate() - weekOffset
    );
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(
        weekStart.getFullYear(),
        weekStart.getMonth(),
        weekStart.getDate() + i
      );
      const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      return {
        iso,
        label: dt.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: dt.getDate(),
        isToday: iso === todayISO,
      };
    });
  }, [selectedDate, todayISO, startsMonday]);

  const getItemsForDate = (dateISO: string) => {
    const events = showEvents
      ? calendarEvents.filter((ev) =>
          matchesRecurrence(ev.date, dateISO, ev.repeat ?? 'none')
        )
      : [];
    const dueTasks = showTasks
      ? tasks.filter((t) => t.dueDate === dateISO)
      : [];
    const renewals = showRenewals
      ? subscriptions.filter(
          (s) => s.active && s.nextBillingDate === dateISO
        )
      : [];
    return { events, dueTasks, renewals };
  };

  const selectedDayItems = getItemsForDate(selectedDate);

  const scheduleDays = useMemo(() => {
    const dates = new Set<string>();
    const startMonth = monthKey;
    if (showEvents) {
      for (const ev of calendarEvents) {
        if (getMonthKey(ev.date) === startMonth || ev.date >= todayISO) {
          dates.add(ev.date);
        }
      }
    }
    if (showTasks) {
      for (const t of tasks) {
        if (t.dueDate && !t.completed) dates.add(t.dueDate);
      }
    }
    if (showRenewals) {
      for (const s of subscriptions) {
        if (s.active) dates.add(s.nextBillingDate);
      }
    }
    return Array.from(dates).sort().slice(0, 30);
  }, [
    calendarEvents,
    tasks,
    subscriptions,
    monthKey,
    todayISO,
    showEvents,
    showTasks,
    showRenewals,
  ]);

  const jumpToToday = () => {
    setSelectedDate(todayISO);
    setMonthKey(getMonthKey(todayISO));
  };

  const selectedDateLabel = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }, [selectedDate]);

  const exportIcs = () => {
    const ics = buildCalendarICS(
      calendarEvents,
      tasks,
      subscriptions,
      preferences.currency
    );
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mmv-hub-calendar.ics';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Minimal Google Calendar Controls */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="inline-flex items-center shrink-0">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setMonthKey((m) => shiftMonthKey(m, -1))}
                className="min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setMonthKey((m) => shiftMonthKey(m, 1))}
                className="min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-[#1F1F1F] dark:text-[#E3E3E3] truncate">
              {formatMonthLabel(monthKey)}
            </h1>

            <button
              type="button"
              onClick={jumpToToday}
              className="min-h-[30px] px-2.5 rounded-lg text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C] whitespace-nowrap shrink-0"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={exportIcs}
              title="Export calendar events, tasks, and renewals (.ics)"
              className="min-h-[36px] px-3 rounded-full border border-[#DADCE0] dark:border-[#3C4043] text-xs font-medium text-[#444746] dark:text-[#C4C7C5] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C] inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export .ics</span>
            </button>
            <button
              type="button"
              onClick={() => onNewEvent(selectedDate)}
              className="min-h-[36px] px-3.5 rounded-full hub-bg-accent text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-95 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Event</span>
            </button>
          </div>
        </div>

        {/* Clean Underline View Tabs + Minimal Layer Toggles */}
        <div className="flex items-center justify-between gap-3 border-b border-[#E8EAED] dark:border-[#3C4043]">
          <div className="flex items-center gap-5">
            {(
              [
                { id: 'month', label: 'Month' },
                { id: 'week', label: 'Week' },
                { id: 'schedule', label: 'Schedule' },
              ] as { id: CalendarMode; label: string }[]
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setViewMode(m.id)}
                className={`pb-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  viewMode === m.id
                    ? 'hub-border-accent hub-text-accent'
                    : 'border-transparent text-[#5F6368] dark:text-[#9AA0A6] hover:text-[#202124] dark:hover:text-[#E8EAED]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 pb-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowEvents((v) => !v)}
              className={`min-h-[28px] text-xs font-medium inline-flex items-center gap-1.5 transition-opacity whitespace-nowrap ${
                showEvents
                  ? 'text-[#202124] dark:text-[#E8EAED]'
                  : 'text-[#747775] opacity-50 line-through'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#0B57D0] dark:bg-[#A8C7FA]" />
              <span>Events</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTasks((v) => !v)}
              className={`min-h-[28px] text-xs font-medium inline-flex items-center gap-1.5 transition-opacity whitespace-nowrap ${
                showTasks
                  ? 'text-[#202124] dark:text-[#E8EAED]'
                  : 'text-[#747775] opacity-50 line-through'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#146C2E] dark:bg-[#6DD58C]" />
              <span>Tasks</span>
            </button>

            <button
              type="button"
              onClick={() => setShowRenewals((v) => !v)}
              className={`min-h-[28px] text-xs font-medium inline-flex items-center gap-1.5 transition-opacity whitespace-nowrap ${
                showRenewals
                  ? 'text-[#202124] dark:text-[#E8EAED]'
                  : 'text-[#747775] opacity-50 line-through'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#B06000] dark:bg-[#FCD663]" />
              <span>Renewals</span>
            </button>
          </div>
        </div>
      </div>

      {/* Month View + Selected Day Agenda Split */}
      {viewMode === 'month' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] overflow-hidden">
            <div className="grid grid-cols-7 border-b border-[#E1E3E1] dark:border-[#444746]">
              {weekdayHeaders.map((d) => (
                <div
                  key={d}
                  className="py-2.5 text-center text-[11px] font-medium text-[#444746] dark:text-[#C4C7C5]"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {monthCells.map((cell) => {
                const { events, dueTasks, renewals } = getItemsForDate(cell.iso);
                const isSelected = cell.iso === selectedDate;
                const totalCount =
                  events.length + dueTasks.length + renewals.length;

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => setSelectedDate(cell.iso)}
                    className={`min-h-[68px] sm:min-h-[92px] p-1 sm:p-1.5 border-b border-r border-[#F0F4F9] dark:border-[#282A2C] text-left flex flex-col justify-between transition-colors ${
                      isSelected
                        ? 'bg-[#E9EEF6] dark:bg-[#282A2C]'
                        : 'hover:bg-[#F8FAFD] dark:hover:bg-[#282A2C]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-mono tabular-nums ${
                          cell.isToday
                            ? 'hub-bg-accent font-semibold'
                            : cell.inCurrentMonth
                              ? 'text-[#1F1F1F] dark:text-[#E3E3E3]'
                              : 'text-[#747775] opacity-50'
                        }`}
                      >
                        {cell.dayNum}
                      </span>
                    </div>

                    {/* Desktop compact labels, Mobile clean dots */}
                    <div className="hidden sm:block space-y-0.5 w-full mt-1">
                      {events.slice(0, 2).map((ev) => (
                        <div
                          key={ev.id}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium truncate ${COLOR_BAR_STYLES[ev.color]}`}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {dueTasks.slice(0, 1).map((t) => (
                        <div
                          key={t.id}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium truncate bg-[#E6F4EA] text-[#146C2E] dark:bg-[#0A3818] dark:text-[#6DD58C]"
                        >
                          {t.title}
                        </div>
                      ))}
                      {renewals.slice(0, 1).map((s) => (
                        <div
                          key={s.id}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium truncate bg-[#FEF7E0] text-[#6B4E00] dark:bg-[#413000] dark:text-[#FCD663]"
                        >
                          {s.name}
                        </div>
                      ))}
                      {totalCount > 3 && (
                        <div className="text-[10px] text-[#444746] dark:text-[#C4C7C5] px-1">
                          +{totalCount - 3} more
                        </div>
                      )}
                    </div>

                    <div className="flex sm:hidden items-center gap-1 pt-1">
                      {events.slice(0, 2).map((ev) => (
                        <span
                          key={ev.id}
                          className={`w-1.5 h-1.5 rounded-full ${COLOR_DOT_STYLES[ev.color]}`}
                        />
                      ))}
                      {dueTasks.length > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#146C2E] dark:bg-[#6DD58C]" />
                      )}
                      {renewals.length > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#B06000] dark:bg-[#FCD663]" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Agenda Panel */}
          <section className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-5 space-y-4 h-fit">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#444746] dark:text-[#C4C7C5]">
                  Selected Day
                </p>
                <h2 className="text-base font-semibold text-[#1F1F1F] dark:text-[#E3E3E3]">
                  {selectedDateLabel}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNewEvent(selectedDate)}
                aria-label="Add event on selected day"
                className="min-h-[40px] min-w-[40px] rounded-full bg-[#E9EEF6] dark:bg-[#282A2C] flex items-center justify-center text-[#0B57D0] dark:text-[#A8C7FA]"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {selectedDayItems.events.length === 0 &&
            selectedDayItems.dueTasks.length === 0 &&
            selectedDayItems.renewals.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <CalendarIcon className="w-6 h-6 mx-auto text-[#747775]" />
                <p className="text-xs text-[#444746] dark:text-[#C4C7C5]">
                  Nothing scheduled for this day.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {selectedDayItems.events.map((ev) => {
                  const days = ev.isMilestone
                    ? getDaysUntil(ev.date, todayISO)
                    : null;
                  const dTag =
                    days === null
                      ? ''
                      : days === 0
                        ? 'Today'
                        : days > 0
                          ? `D-${days}`
                          : `D+${Math.abs(days)}`;
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => onEditEvent(ev)}
                      className={`w-full text-left rounded-2xl p-3.5 space-y-1 transition-opacity hover:opacity-90 ${COLOR_BAR_STYLES[ev.color]}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold truncate">
                          {ev.title}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {dTag && (
                            <span className="text-[11px] font-mono font-semibold">
                              {dTag}
                            </span>
                          )}
                          {ev.repeat && ev.repeat !== 'none' && (
                            <Repeat className="w-3.5 h-3.5 opacity-80" />
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs opacity-90">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {ev.allDay
                            ? 'All day'
                            : `${formatTime12h(ev.startTime)} – ${formatTime12h(ev.endTime)}`}
                        </span>
                        {ev.location && (
                          <span className="inline-flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3" />
                            {ev.location}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}

                {selectedDayItems.dueTasks.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-2xl border border-[#E1E3E1] dark:border-[#444746] p-3 flex items-center gap-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => void toggleTaskCompleted(t.id)}
                      aria-label={`Complete ${t.title}`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0"
                    >
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          t.completed
                            ? 'bg-[#146C2E] border-[#146C2E] text-white dark:bg-[#6DD58C] dark:border-[#6DD58C] dark:text-[#0A3818]'
                            : 'border-[#747775]'
                        }`}
                      >
                        {t.completed && <Check className="w-3 h-3" />}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditTask(t)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p
                        className={`text-sm font-medium truncate ${
                          t.completed ? 'line-through text-[#747775]' : ''
                        }`}
                      >
                        {t.title}
                      </p>
                      <p className="text-xs text-[#444746] dark:text-[#C4C7C5]">
                        Task{t.dueTime ? ` · ${formatTime12h(t.dueTime)}` : ''}
                      </p>
                    </button>
                  </div>
                ))}

                {selectedDayItems.renewals.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => onEditSubscription(sub)}
                    className="w-full text-left rounded-2xl bg-[#FEF7E0] dark:bg-[#413000] text-[#6B4E00] dark:text-[#FCD663] p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {sub.name}
                      </p>
                      <p className="text-xs opacity-90 capitalize">
                        {sub.billingCycle} renewal
                      </p>
                    </div>
                    <span className="text-sm font-mono font-semibold tabular-nums shrink-0">
                      {formatCurrency(sub.amount, preferences.currency)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {weekDates.map((wd) => {
            const { events, dueTasks, renewals } = getItemsForDate(wd.iso);
            return (
              <div
                key={wd.iso}
                className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-3.5 space-y-3 min-h-[220px]"
              >
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedDate(wd.iso)}
                    className="flex items-center gap-2"
                  >
                    <span className="text-xs text-[#444746] dark:text-[#C4C7C5]">
                      {wd.label}
                    </span>
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-semibold tabular-nums ${
                        wd.isToday
                          ? 'hub-bg-accent'
                          : 'text-[#1F1F1F] dark:text-[#E3E3E3]'
                      }`}
                    >
                      {wd.dayNum}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNewEvent(wd.iso)}
                    aria-label={`Add event on ${wd.iso}`}
                    className="min-h-[32px] min-w-[32px] rounded-full flex items-center justify-center text-[#747775] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  {events.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => onEditEvent(ev)}
                      className={`w-full text-left rounded-xl p-2 text-xs space-y-0.5 ${COLOR_BAR_STYLES[ev.color]}`}
                    >
                      <p className="font-semibold truncate">{ev.title}</p>
                      <p className="text-[10px] opacity-85">
                        {ev.allDay
                          ? 'All day'
                          : formatTime12h(ev.startTime)}
                      </p>
                    </button>
                  ))}
                  {dueTasks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onEditTask(t)}
                      className="w-full text-left rounded-xl p-2 text-xs bg-[#E6F4EA] text-[#146C2E] dark:bg-[#0A3818] dark:text-[#6DD58C] truncate font-medium"
                    >
                      {t.title}
                    </button>
                  ))}
                  {renewals.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onEditSubscription(s)}
                      className="w-full text-left rounded-xl p-2 text-xs bg-[#FEF7E0] text-[#6B4E00] dark:bg-[#413000] dark:text-[#FCD663] truncate font-medium"
                    >
                      {s.name} · {formatCurrency(s.amount, preferences.currency)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule / Agenda View */}
      {viewMode === 'schedule' && (
        <div className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] divide-y divide-[#F0F4F9] dark:divide-[#282A2C]">
          {scheduleDays.length === 0 ? (
            <div className="py-14 px-6 text-center space-y-3">
              <CalendarIcon className="w-7 h-7 mx-auto text-[#747775]" />
              <p className="text-sm text-[#444746] dark:text-[#C4C7C5]">
                Your upcoming schedule is clear.
              </p>
              <button
                type="button"
                onClick={() => onNewEvent(todayISO)}
                className="min-h-[44px] px-5 rounded-full hub-bg-accent text-xs font-medium"
              >
                Create Event
              </button>
            </div>
          ) : (
            scheduleDays.map((iso) => {
              const { events, dueTasks, renewals } = getItemsForDate(iso);
              if (
                events.length + dueTasks.length + renewals.length ===
                0
              ) {
                return null;
              }
              return (
                <div
                  key={iso}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row gap-3 sm:gap-6"
                >
                  <div className="sm:w-32 shrink-0">
                    <p
                      className={`text-sm font-semibold ${
                        iso === todayISO
                          ? 'text-[#0B57D0] dark:text-[#A8C7FA]'
                          : 'text-[#1F1F1F] dark:text-[#E3E3E3]'
                      }`}
                    >
                      {iso === todayISO ? 'Today' : formatShortDate(iso)}
                    </p>
                    <p className="text-xs text-[#444746] dark:text-[#C4C7C5] font-mono">
                      {iso}
                    </p>
                  </div>

                  <div className="flex-1 space-y-2">
                    {events.map((ev) => {
                      const days = ev.isMilestone
                        ? getDaysUntil(ev.date, todayISO)
                        : null;
                      const dTag =
                        days === null
                          ? ''
                          : days === 0
                            ? 'Today'
                            : days > 0
                              ? `D-${days}`
                              : `D+${Math.abs(days)}`;
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => onEditEvent(ev)}
                          className={`w-full text-left rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 ${COLOR_BAR_STYLES[ev.color]}`}
                        >
                          <span className="text-sm font-medium truncate">
                            {ev.title}
                            {dTag ? ` · ${dTag}` : ''}
                          </span>
                          <span className="text-xs shrink-0">
                            {ev.allDay
                              ? 'All day'
                              : formatTime12h(ev.startTime)}
                          </span>
                        </button>
                      );
                    })}
                    {dueTasks.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onEditTask(t)}
                        className="w-full text-left rounded-2xl border border-[#E1E3E1] dark:border-[#444746] px-4 py-2.5 flex items-center justify-between gap-3"
                      >
                        <span className="text-sm font-medium truncate">
                          {t.title}
                        </span>
                        <span className="text-xs text-[#146C2E] dark:text-[#6DD58C] shrink-0">
                          Task
                        </span>
                      </button>
                    ))}
                    {renewals.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onEditSubscription(s)}
                        className="w-full text-left rounded-2xl bg-[#FEF7E0] dark:bg-[#413000] text-[#6B4E00] dark:text-[#FCD663] px-4 py-2.5 flex items-center justify-between gap-3"
                      >
                        <span className="text-sm font-medium truncate">
                          {s.name}
                        </span>
                        <span className="text-xs font-mono tabular-nums shrink-0">
                          {formatCurrency(s.amount, preferences.currency)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
