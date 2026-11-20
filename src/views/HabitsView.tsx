import React, { useEffect, useMemo, useState } from 'react';
import { tx } from '../lib/i18n';
import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Minus,
  Pencil,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Snowflake,
  Square,
} from 'lucide-react';
import { useVault } from '../context/VaultContext';
import type { CalendarColor, HabitRecord, HabitTimeOfDay } from '../types';
import {
  calculateHabitStreak,
  formatHabitScheduleLabel,
  formatMonthLabel,
  formatShortDate,
  formatTime12h,
  getMonthKey,
  getOffsetDateISO,
  getTodayISO,
  getWeeklyQuotaProgress,
  isHabitScheduledOnDate,
  shiftMonthKey,
} from '../lib/format';

interface HabitsViewProps {
  onNewHabit: () => void;
  onEditHabit: (habit: HabitRecord) => void;
}

type HabitViewMode = 'focus' | 'matrix' | 'calendar';
type MatrixWindow = 7 | 14 | 30 | 365;
type ScheduleFilter = 'all' | 'due' | HabitTimeOfDay;

const COLOR_SOLID: Record<CalendarColor, string> = {
  blue: 'bg-[#0B57D0] border-[#0B57D0] text-white dark:bg-[#A8C7FA] dark:border-[#A8C7FA] dark:text-[#062E6F]',
  green:
    'bg-[#146C2E] border-[#146C2E] text-white dark:bg-[#6DD58C] dark:border-[#6DD58C] dark:text-[#0A3818]',
  amber:
    'bg-[#B06000] border-[#B06000] text-white dark:bg-[#FCD663] dark:border-[#FCD663] dark:text-[#413000]',
  red: 'bg-[#B3261E] border-[#B3261E] text-white dark:bg-[#F2B8B5] dark:border-[#F2B8B5] dark:text-[#601410]',
  purple:
    'bg-[#6750A4] border-[#6750A4] text-white dark:bg-[#D0BCFF] dark:border-[#D0BCFF] dark:text-[#381E72]',
};

const COLOR_PARTIAL: Record<CalendarColor, string> = {
  blue: 'bg-[#C2E7FF] border-[#0B57D0]/40 text-[#001D35] dark:bg-[#004A77] dark:border-[#A8C7FA]/40 dark:text-[#C2E7FF]',
  green:
    'bg-[#E6F4EA] border-[#146C2E]/40 text-[#146C2E] dark:bg-[#0A3818] dark:border-[#6DD58C]/40 dark:text-[#6DD58C]',
  amber:
    'bg-[#FEF7E0] border-[#B06000]/40 text-[#6B4E00] dark:bg-[#413000] dark:border-[#FCD663]/40 dark:text-[#FCD663]',
  red: 'bg-[#FCE8E6] border-[#B3261E]/40 text-[#B3261E] dark:bg-[#601410] dark:border-[#F2B8B5]/40 dark:text-[#F2B8B5]',
  purple:
    'bg-[#F3EDF7] border-[#6750A4]/40 text-[#4F378B] dark:bg-[#381E72] dark:border-[#D0BCFF]/40 dark:text-[#D0BCFF]',
};

export const HabitsView: React.FC<HabitsViewProps> = ({
  onNewHabit,
  onEditHabit,
}) => {
  const {
    habits,
    preferences,
    toggleHabitLog,
    setHabitLogCount,
    toggleHabitFreeze,
    toggleHabitArchived,
  } = useVault();
  const todayISO = getTodayISO();
  const startsMonday = preferences.weekStartsOn === 'monday';

  const [viewMode, setViewMode] = useState<HabitViewMode>('focus');
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [matrixWindow, setMatrixWindow] = useState<MatrixWindow>(14);
  const [matrixEndDate, setMatrixEndDate] = useState(todayISO);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    getMonthKey(todayISO)
  );
  const [calendarHabitId, setCalendarHabitId] = useState<string>('__all__');
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>('all');
  const [showArchived, setShowArchived] = useState(false);

  // Per-habit compact stopwatch state
  const [runningHabitTimer, setRunningHabitTimer] = useState<{
    habitId: string;
    startedAt: number;
  } | null>(null);
  const [timerNow, setTimerNow] = useState(0);

  useEffect(() => {
    if (!runningHabitTimer) return;
    setTimerNow(Date.now());
    const id = window.setInterval(() => {
      setTimerNow(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [runningHabitTimer]);

  const activeHabits = useMemo(
    () => habits.filter((h) => !h.archived),
    [habits]
  );

  const archivedHabits = useMemo(
    () => habits.filter((h) => h.archived),
    [habits]
  );

  const filteredActiveHabits = useMemo(() => {
    const base = showArchived ? archivedHabits : activeHabits;
    if (scheduleFilter === 'all') return base;
    if (scheduleFilter === 'due') {
      return base.filter((h) => isHabitScheduledOnDate(h, selectedDate));
    }
    return base.filter((h) => (h.timeOfDay ?? 'anytime') === scheduleFilter);
  }, [
    showArchived,
    archivedHabits,
    activeHabits,
    scheduleFilter,
    selectedDate,
  ]);

  // 7-day sliding window centered around selectedDate (or ending on selectedDate if recent)
  const focusWeekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, idx) => {
      const iso = getOffsetDateISO(idx - 3, selectedDate);
      const [y, m, d] = iso.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return {
        iso,
        weekday: dt
          .toLocaleDateString('en-US', { weekday: 'short' })
          .slice(0, 2),
        dayNum: d,
        monthShort: dt.toLocaleDateString('en-US', { month: 'short' }),
        isToday: iso === todayISO,
        isFuture: iso > todayISO,
      };
    });
  }, [selectedDate, todayISO]);

  // Matrix columns ending on matrixEndDate
  const matrixDates = useMemo(() => {
    return Array.from({ length: matrixWindow }, (_, idx) => {
      const iso = getOffsetDateISO(idx - (matrixWindow - 1), matrixEndDate);
      const [y, m, d] = iso.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return {
        iso,
        shortDay: dt
          .toLocaleDateString('en-US', { weekday: 'short' })
          .slice(0, 1),
        dayNum: d,
        monthNum: m,
        isToday: iso === todayISO,
        isFuture: iso > todayISO,
      };
    });
  }, [matrixWindow, matrixEndDate, todayISO]);

  // Google Fit-style ring stats for selectedDate
  const selectedDayStats = useMemo(() => {
    const scheduled = activeHabits.filter((h) =>
      isHabitScheduledOnDate(h, selectedDate)
    );
    const doneScheduled = scheduled.filter(
      (h) => (h.logs[selectedDate] ?? 0) >= h.targetPerDay
    ).length;
    const totalDoneAny = activeHabits.filter(
      (h) => (h.logs[selectedDate] ?? 0) >= h.targetPerDay
    ).length;
    const denominator = scheduled.length || activeHabits.length;
    const numerator = scheduled.length > 0 ? doneScheduled : totalDoneAny;
    const pct = denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;

    return {
      scheduledCount: scheduled.length,
      doneScheduled,
      totalDoneAny,
      pct,
    };
  }, [activeHabits, selectedDate]);

  // Month grid cells for Calendar Backfill View
  const calendarMonthCells = useMemo(() => {
    const [yStr, mStr] = calendarMonth.split('-');
    const year = Number(yStr);
    const monthIdx = Number(mStr) - 1;
    const firstDay = new Date(year, monthIdx, 1);
    const rawWeekday = firstDay.getDay();
    const startOffset = startsMonday ? (rawWeekday + 6) % 7 : rawWeekday;
    const gridStart = new Date(year, monthIdx, 1 - startOffset);

    return Array.from({ length: 42 }, (_, idx) => {
      const d = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + idx
      );
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(d.getDate()).padStart(2, '0')}`;
      return {
        iso,
        dayNum: d.getDate(),
        inMonth: d.getMonth() === monthIdx,
        isToday: iso === todayISO,
        isFuture: iso > todayISO,
      };
    });
  }, [calendarMonth, todayISO, startsMonday]);

  const selectedCalendarHabit = useMemo(
    () => activeHabits.find((h) => h.id === calendarHabitId) ?? null,
    [activeHabits, calendarHabitId]
  );

  const ringRadius = 26;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset =
    ringCircumference - (selectedDayStats.pct / 100) * ringCircumference;

  return (
    <div className="space-y-4">
      {/* Minimal Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-[#1F1F1F] dark:text-[#E3E3E3]">
              {tx('Habits')}
            </h1>
            <span className="text-xs text-[#5F6368] dark:text-[#9AA0A6] tabular-nums whitespace-nowrap">
              {selectedDayStats.doneScheduled}/{selectedDayStats.scheduledCount}{' '}
              {selectedDate === todayISO
                ? 'today'
                : formatShortDate(selectedDate)}
            </span>
          </div>

          <button
            type="button"
            onClick={onNewHabit}
            className="min-h-[36px] px-3.5 rounded-full hub-bg-accent text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Goal</span>
          </button>
        </div>

        {/* Clean Underline View Tabs + Inline Filter */}
        <div className="flex items-center justify-between gap-3 border-b border-[#E8EAED] dark:border-[#3C4043]">
          <div className="flex items-center gap-5">
            {(
              [
                { id: 'focus', label: 'Daily' },
                { id: 'matrix', label: 'Matrix' },
                { id: 'calendar', label: 'Calendar' },
              ] as { id: HabitViewMode; label: string }[]
            ).map((m) => {
              const active = viewMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setViewMode(m.id)}
                  className={`pb-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    active
                      ? 'hub-border-accent hub-text-accent'
                      : 'border-transparent text-[#5F6368] dark:text-[#9AA0A6] hover:text-[#202124] dark:hover:text-[#E8EAED]'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 pb-1.5 shrink-0">
            {archivedHabits.length > 0 && (
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="min-h-[30px] px-2 rounded-lg text-xs font-medium hub-text-accent hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C] whitespace-nowrap"
              >
                {showArchived
                  ? `Active (${activeHabits.length})`
                  : `Archived (${archivedHabits.length})`}
              </button>
            )}

            <select
              aria-label="Filter habits by schedule"
              value={scheduleFilter}
              onChange={(e) =>
                setScheduleFilter(e.target.value as ScheduleFilter)
              }
              className="min-h-[30px] rounded-lg bg-[#F1F3F4] dark:bg-[#282A2C] px-2.5 text-xs font-medium text-[#202124] dark:text-[#E8EAED] focus:outline-none"
            >
              <option value="all">All Goals</option>
              <option value="due">Scheduled</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </select>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {displayedEmpty(showArchived, activeHabits, archivedHabits) ? (
        <div className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] py-14 px-6 text-center space-y-3">
          <Repeat className="w-7 h-7 mx-auto text-[#747775]" />
          <p className="text-sm text-[#444746] dark:text-[#C4C7C5]">
            {showArchived
              ? 'No archived habit goals.'
              : 'Create daily, weekday, weekly, monthly, or custom-day goals with streak tracking.'}
          </p>
          {!showArchived && (
            <button
              type="button"
              onClick={onNewHabit}
              className="min-h-[44px] px-5 rounded-full hub-bg-accent text-xs font-medium"
            >
              {tx('Create First Goal')}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ================= FOCUS / DAILY VIEW ================= */}
          {viewMode === 'focus' && (
            <div className="space-y-5">
              {/* Google Fit-style Daily Ring + Any-Old-Day Date Scroller */}
              <section className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Progress Ring + Status */}
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 shrink-0">
                      <svg
                        viewBox="0 0 64 64"
                        className="w-16 h-16 -rotate-90"
                        aria-hidden="true"
                      >
                        <circle
                          cx="32"
                          cy="32"
                          r={ringRadius}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="6"
                          className="text-[#E9EEF6] dark:text-[#282A2C]"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r={ringRadius}
                          fill="none"
                          stroke="#146C2E"
                          strokeWidth="6"
                          strokeLinecap="round"
                          strokeDasharray={ringCircumference}
                          strokeDashoffset={ringOffset}
                          className="transition-all duration-300 dark:stroke-[#6DD58C]"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-mono font-semibold tabular-nums text-[#1F1F1F] dark:text-[#E3E3E3]">
                        {selectedDayStats.pct}%
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-[#1F1F1F] dark:text-[#E3E3E3]">
                        {selectedDate === todayISO
                          ? "Today's Progress"
                          : `Backfilling ${formatShortDate(selectedDate)}`}
                      </p>
                      <p className="text-xs text-[#444746] dark:text-[#C4C7C5] tabular-nums">
                        {selectedDayStats.doneScheduled} of{' '}
                        {selectedDayStats.scheduledCount} scheduled goals
                        completed
                        {selectedDayStats.totalDoneAny >
                        selectedDayStats.doneScheduled
                          ? ` · +${selectedDayStats.totalDoneAny - selectedDayStats.doneScheduled} bonus`
                          : ''}
                      </p>
                    </div>
                  </div>

                  {/* Jump to Any Old Day Picker */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      aria-label="Previous week"
                      onClick={() =>
                        setSelectedDate((d) => getOffsetDateISO(-7, d))
                      }
                      className="min-h-[40px] min-w-[40px] rounded-full border border-[#DADCE0] dark:border-[#444746] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <input
                      type="date"
                      aria-label="Jump to date to mark old days"
                      max={todayISO}
                      value={selectedDate}
                      onChange={(e) => {
                        if (e.target.value) setSelectedDate(e.target.value);
                      }}
                      className="min-h-[40px] rounded-full border border-[#DADCE0] dark:border-[#444746] bg-[#F8FAFD] dark:bg-[#282A2C] px-3.5 text-xs font-medium text-[#1F1F1F] dark:text-[#E3E3E3]"
                    />

                    <button
                      type="button"
                      aria-label="Next week"
                      disabled={selectedDate >= todayISO}
                      onClick={() =>
                        setSelectedDate((d) => {
                          const next = getOffsetDateISO(7, d);
                          return next > todayISO ? todayISO : next;
                        })
                      }
                      className="min-h-[40px] min-w-[40px] rounded-full border border-[#DADCE0] dark:border-[#444746] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] disabled:opacity-35"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    {selectedDate !== todayISO && (
                      <button
                        type="button"
                        onClick={() => setSelectedDate(todayISO)}
                        className="min-h-[40px] px-3.5 rounded-full bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF] text-xs font-medium inline-flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Today</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 7-Day Date Strip */}
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {focusWeekDays.map((day) => {
                    const active = day.iso === selectedDate;
                    const schedForDay = activeHabits.filter((h) =>
                      isHabitScheduledOnDate(h, day.iso)
                    );
                    const doneForDay = schedForDay.filter(
                      (h) => (h.logs[day.iso] ?? 0) >= h.targetPerDay
                    ).length;
                    const fillPct =
                      schedForDay.length > 0
                        ? Math.round((doneForDay / schedForDay.length) * 100)
                        : 0;

                    return (
                      <button
                        key={day.iso}
                        type="button"
                        disabled={day.isFuture}
                        onClick={() => setSelectedDate(day.iso)}
                        className={`min-h-[60px] rounded-2xl p-1.5 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
                          day.isFuture
                            ? 'opacity-35 cursor-not-allowed bg-[#F0F4F9] dark:bg-[#282A2C]/50'
                            : active
                              ? 'hub-bg-accent font-semibold'
                              : 'bg-[#F0F4F9] dark:bg-[#282A2C] text-[#1F1F1F] dark:text-[#E3E3E3] hover:bg-[#E1E7F0] dark:hover:bg-[#333537]'
                        }`}
                      >
                        <span className="text-[10px] opacity-80">
                          {day.weekday}
                        </span>
                        <span className="font-mono tabular-nums text-sm">
                          {day.dayNum}
                        </span>
                        <span
                          className={`w-6 h-1 rounded-full overflow-hidden ${
                            active
                              ? 'bg-white/30 dark:bg-[#062E6F]/30'
                              : 'bg-[#DADCE0] dark:bg-[#444746]'
                          }`}
                        >
                          <span
                            className={`block h-full rounded-full ${
                              active
                                ? 'bg-white dark:bg-[#062E6F]'
                                : 'bg-[#146C2E] dark:bg-[#6DD58C]'
                            }`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Filtered Habit Cards */}
              {filteredActiveHabits.length === 0 ? (
                <div className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] py-10 px-6 text-center space-y-2">
                  <p className="text-sm text-[#444746] dark:text-[#C4C7C5]">
                    No goals match this filter for{' '}
                    {selectedDate === todayISO
                      ? 'today'
                      : formatShortDate(selectedDate)}
                    .
                  </p>
                  <button
                    type="button"
                    onClick={() => setScheduleFilter('all')}
                    className="text-xs font-medium text-[#0B57D0] dark:text-[#A8C7FA] hover:underline"
                  >
                    {tx('Show all goals')}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredActiveHabits.map((habit) => {
                    const count = habit.logs[selectedDate] ?? 0;
                    const done = count >= habit.targetPerDay;
                    const isFrozen = (habit.freezeDates ?? []).includes(
                      selectedDate
                    );
                    const isScheduled = isHabitScheduledOnDate(
                      habit,
                      selectedDate
                    );
                    const colorKey: CalendarColor = habit.color ?? 'green';
                    const { current, best } = calculateHabitStreak(
                      habit.logs,
                      habit.targetPerDay,
                      habit
                    );
                    const quotaInfo =
                      habit.weeklyQuota && habit.weeklyQuota > 0
                        ? getWeeklyQuotaProgress(
                            habit,
                            selectedDate,
                            startsMonday
                          )
                        : null;
                    const isTiming =
                      runningHabitTimer?.habitId === habit.id;
                    const elapsedSec = isTiming
                      ? Math.max(
                          0,
                          Math.floor(
                            (timerNow - runningHabitTimer.startedAt) / 1000
                          )
                        )
                      : 0;
                    const elapsedLabel = `${String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:${String(elapsedSec % 60).padStart(2, '0')}`;

                    const last14 = Array.from({ length: 14 }, (_, i) =>
                      getOffsetDateISO(i - 13, selectedDate)
                    );
                    const scheduledIn14 = last14.filter((d) =>
                      isHabitScheduledOnDate(habit, d)
                    );
                    const doneIn14 = scheduledIn14.filter(
                      (d) => (habit.logs[d] ?? 0) >= habit.targetPerDay
                    ).length;
                    const adherencePct =
                      scheduledIn14.length > 0
                        ? Math.round((doneIn14 / scheduledIn14.length) * 100)
                        : 0;

                    return (
                      <div
                        key={habit.id}
                        className={`rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-5 space-y-4 ${
                          !isScheduled && !done ? 'opacity-85' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void toggleHabitLog(
                                habit.id,
                                selectedDate,
                                habit.targetPerDay > 1
                                  ? 'increment'
                                  : 'toggle'
                              )
                            }
                            className="flex items-center gap-3.5 min-w-0 flex-1 text-left"
                          >
                            <span
                              className={`w-11 h-11 rounded-2xl border-2 flex items-center justify-center shrink-0 transition-colors ${
                                done
                                  ? COLOR_SOLID[colorKey]
                                  : isFrozen
                                    ? 'bg-[#E8F0FE] dark:bg-[#004A77]/45 border-[#0B57D0]/50 dark:border-[#A8C7FA]/50 text-[#0B57D0] dark:text-[#A8C7FA]'
                                    : count > 0
                                      ? COLOR_PARTIAL[colorKey]
                                      : 'border-[#747775] dark:border-[#8E918F] hover:border-[#0B57D0] dark:hover:border-[#A8C7FA]'
                              }`}
                            >
                              {done ? (
                                <Check className="w-5 h-5" />
                              ) : isFrozen ? (
                                <Snowflake className="w-4 h-4" />
                              ) : habit.targetPerDay > 1 ? (
                                <span className="font-mono text-xs font-semibold tabular-nums">
                                  {count}/{habit.targetPerDay}
                                </span>
                              ) : null}
                            </span>

                            <div className="min-w-0 space-y-0.5">
                              <h3 className="text-base font-semibold text-[#1F1F1F] dark:text-[#E3E3E3] truncate">
                                {habit.name}
                              </h3>
                              <p className="text-xs text-[#444746] dark:text-[#C4C7C5] truncate">
                                {habit.mode === 'quit' ? 'Abstain · ' : ''}
                                {formatHabitScheduleLabel(habit)}
                                {quotaInfo
                                  ? ` · ${quotaInfo.done}/${quotaInfo.quota} this wk`
                                  : ''}
                                {habit.preferredTime
                                  ? ` · ${formatTime12h(habit.preferredTime)}`
                                  : habit.timeOfDay &&
                                      habit.timeOfDay !== 'anytime'
                                    ? ` · ${habit.timeOfDay}`
                                    : ''}
                                {habit.category ? ` · ${habit.category}` : ''}
                              </p>
                              <p className="text-[11px] text-[#747775] truncate">
                                {isFrozen
                                  ? 'Streak freeze active'
                                  : isScheduled
                                    ? 'Scheduled'
                                    : 'Off-day (tap to log bonus)'}
                                {habit.notes ? ` · ${habit.notes}` : ''}
                              </p>
                            </div>
                          </button>

                          <div className="flex items-center shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                if (isTiming) {
                                  setRunningHabitTimer(null);
                                  if (!done) {
                                    void toggleHabitLog(
                                      habit.id,
                                      selectedDate,
                                      habit.targetPerDay > 1
                                        ? 'complete'
                                        : 'toggle'
                                    );
                                  }
                                } else {
                                  setRunningHabitTimer({
                                    habitId: habit.id,
                                    startedAt: Date.now(),
                                  });
                                }
                              }}
                              aria-label={
                                isTiming
                                  ? `Stop stopwatch and mark ${habit.name}`
                                  : `Start stopwatch for ${habit.name}`
                              }
                              title={
                                isTiming
                                  ? `Stop (${elapsedLabel}) & complete`
                                  : 'Start habit stopwatch'
                              }
                              className={`min-h-[38px] px-2 rounded-full flex items-center justify-center gap-1 text-xs font-mono transition-colors ${
                                isTiming
                                  ? 'hub-bg-soft font-semibold'
                                  : 'text-[#747775] hover:text-[#1F1F1F] dark:hover:text-[#E3E3E3] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]'
                              }`}
                            >
                              {isTiming ? (
                                <>
                                  <Square className="w-3.5 h-3.5" />
                                  <span>{elapsedLabel}</span>
                                </>
                              ) : (
                                <Play className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {!done && (
                              <button
                                type="button"
                                onClick={() =>
                                  void toggleHabitFreeze(habit.id, selectedDate)
                                }
                                aria-label={
                                  isFrozen
                                    ? `Remove streak freeze for ${habit.name}`
                                    : `Freeze streak for ${habit.name}`
                                }
                                title={
                                  isFrozen
                                    ? 'Remove streak freeze'
                                    : 'Freeze streak on this day'
                                }
                                className={`min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full transition-colors ${
                                  isFrozen
                                    ? 'text-[#0B57D0] dark:text-[#A8C7FA] bg-[#E8F0FE] dark:bg-[#004A77]/45'
                                    : 'text-[#747775] hover:text-[#1F1F1F] dark:hover:text-[#E3E3E3] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]'
                                }`}
                              >
                                <Snowflake className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                void toggleHabitArchived(
                                  habit.id,
                                  !habit.archived
                                )
                              }
                              aria-label={
                                habit.archived
                                  ? 'Restore habit'
                                  : 'Archive habit'
                              }
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full text-[#747775] hover:text-[#1F1F1F] dark:hover:text-[#E3E3E3] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]"
                            >
                              {habit.archived ? (
                                <ArchiveRestore className="w-4 h-4" />
                              ) : (
                                <Archive className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditHabit(habit)}
                              aria-label={`Edit ${habit.name}`}
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full text-[#747775] hover:text-[#1F1F1F] dark:hover:text-[#E3E3E3] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Multi-target stepper controls for quick logging / old day correction */}
                        {habit.targetPerDay > 1 && (
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                aria-label="Decrease count"
                                disabled={count <= 0}
                                onClick={() =>
                                  void toggleHabitLog(
                                    habit.id,
                                    selectedDate,
                                    'decrement'
                                  )
                                }
                                className="min-h-[34px] min-w-[34px] rounded-full border border-[#DADCE0] dark:border-[#444746] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] disabled:opacity-35"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="px-2 text-xs font-mono tabular-nums text-[#1F1F1F] dark:text-[#E3E3E3]">
                                {count} / {habit.targetPerDay}{' '}
                                {habit.unit || 'units'}
                              </span>
                              <button
                                type="button"
                                aria-label="Increase count"
                                onClick={() =>
                                  void setHabitLogCount(
                                    habit.id,
                                    selectedDate,
                                    count + 1
                                  )
                                }
                                className="min-h-[34px] min-w-[34px] rounded-full border border-[#DADCE0] dark:border-[#444746] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5]"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                void toggleHabitLog(
                                  habit.id,
                                  selectedDate,
                                  'complete'
                                )
                              }
                              className="min-h-[34px] px-3 rounded-full text-xs font-medium bg-[#E9EEF6] dark:bg-[#282A2C] text-[#1F1F1F] dark:text-[#E3E3E3] hover:bg-[#C2E7FF] dark:hover:bg-[#004A77]"
                            >
                              {done ? 'Clear' : 'Mark Full'}
                            </button>
                          </div>
                        )}

                        {/* Interactive 14-day Mini Strip (tap any old day directly) */}
                        <div className="space-y-2">
                          <div className="grid grid-cols-14 gap-1">
                            {last14.map((d) => {
                              const val = habit.logs[d] ?? 0;
                              const hit = val >= habit.targetPerDay;
                              const partial =
                                val > 0 && val < habit.targetPerDay;
                              const frozenDay = (
                                habit.freezeDates ?? []
                              ).includes(d);
                              const sched = isHabitScheduledOnDate(habit, d);
                              return (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => setSelectedDate(d)}
                                  title={`${d}: ${val}/${habit.targetPerDay}${frozenDay ? ' (frozen)' : sched ? '' : ' (off-day)'}`}
                                  className={`h-3.5 rounded-[4px] transition-colors ${
                                    hit
                                      ? COLOR_SOLID[colorKey]
                                      : frozenDay
                                        ? 'bg-[#C2E7FF] dark:bg-[#004A77]'
                                        : partial
                                          ? COLOR_PARTIAL[colorKey]
                                          : sched
                                            ? 'bg-[#E9EEF6] dark:bg-[#282A2C]'
                                            : 'bg-[#F4F6FA] dark:bg-[#191A1C] opacity-55'
                                  } ${
                                    d === selectedDate
                                      ? 'ring-2 ring-[#1F1F1F] dark:ring-[#E3E3E3]'
                                      : ''
                                  }`}
                                />
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-between text-xs text-[#444746] dark:text-[#C4C7C5] tabular-nums">
                            <span>
                              {habit.mode === 'quit'
                                ? `Clean: ${current} · Best: ${best}`
                                : `Streak: ${current} · Best: ${best}`}
                            </span>
                            <span>{adherencePct}% adherence (14d)</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= MATRIX VIEW (SPREADSHEET + OLD-DAY BACKFILL) ================= */}
          {viewMode === 'matrix' && (
            <section className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] overflow-hidden">
              {/* Matrix Controls */}
              <div className="px-4 sm:px-5 py-3.5 border-b border-[#E1E3E1] dark:border-[#444746] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    aria-label="Earlier dates"
                    onClick={() =>
                      setMatrixEndDate((d) =>
                        getOffsetDateISO(-matrixWindow, d)
                      )
                    }
                    className="min-h-[36px] min-w-[36px] rounded-full border border-[#DADCE0] dark:border-[#444746] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-medium text-[#1F1F1F] dark:text-[#E3E3E3] tabular-nums">
                    {formatShortDate(matrixDates[0].iso)} –{' '}
                    {formatShortDate(matrixDates[matrixDates.length - 1].iso)}
                  </span>
                  <button
                    type="button"
                    aria-label="Later dates"
                    disabled={matrixEndDate >= todayISO}
                    onClick={() =>
                      setMatrixEndDate((d) => {
                        const next = getOffsetDateISO(matrixWindow, d);
                        return next > todayISO ? todayISO : next;
                      })
                    }
                    className="min-h-[36px] min-w-[36px] rounded-full border border-[#DADCE0] dark:border-[#444746] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] disabled:opacity-35"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {matrixEndDate !== todayISO && (
                    <button
                      type="button"
                      onClick={() => setMatrixEndDate(todayISO)}
                      className="min-h-[34px] px-3 rounded-full bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF] text-xs font-medium"
                    >
                      {tx('Today')}
                    </button>
                  )}

                  <input
                    type="date"
                    aria-label="Set matrix end date"
                    max={todayISO}
                    value={matrixEndDate}
                    onChange={(e) => {
                      if (e.target.value) setMatrixEndDate(e.target.value);
                    }}
                    className="min-h-[34px] rounded-full border border-[#DADCE0] dark:border-[#444746] bg-[#F8FAFD] dark:bg-[#282A2C] px-3 text-xs text-[#1F1F1F] dark:text-[#E3E3E3]"
                  />
                </div>

                <div className="inline-flex items-center p-0.5 rounded-full border border-[#DADCE0] dark:border-[#444746] self-start sm:self-auto">
                  {([7, 14, 30, 365] as MatrixWindow[]).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setMatrixWindow(w)}
                      className={`min-h-[32px] px-3 rounded-full text-xs font-medium transition-colors ${
                        matrixWindow === w
                          ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF]'
                          : 'text-[#444746] dark:text-[#C4C7C5]'
                      }`}
                    >
                      {w === 365 ? 'Year' : `${w}d`}
                    </button>
                  ))}
                </div>
              </div>

              {/* 365-Day Yearly Heatmap Mode vs Spreadsheet Table */}
              {matrixWindow === 365 ? (
                <div className="p-4 sm:p-5 space-y-5 divide-y divide-[#F0F4F9] dark:divide-[#282A2C]">
                  {filteredActiveHabits.map((habit) => {
                    const colorKey: CalendarColor = habit.color ?? 'green';
                    const { current, best } = calculateHabitStreak(
                      habit.logs,
                      habit.targetPerDay,
                      habit
                    );
                    const totalDoneYear = matrixDates.filter(
                      (d) => (habit.logs[d.iso] ?? 0) >= habit.targetPerDay
                    ).length;
                    return (
                      <div
                        key={habit.id}
                        className="pt-4 first:pt-0 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => onEditHabit(habit)}
                            className="text-left min-w-0"
                          >
                            <p className="text-sm font-semibold text-[#1F1F1F] dark:text-[#E3E3E3] truncate hover:underline">
                              {habit.name}
                            </p>
                            <p className="text-xs text-[#747775]">
                              {formatHabitScheduleLabel(habit)} ·{' '}
                              {totalDoneYear} completions
                            </p>
                          </button>
                          <span className="text-xs font-mono tabular-nums text-[#444746] dark:text-[#C4C7C5] shrink-0">
                            Streak {current} · Best {best}
                          </span>
                        </div>
                        <div className="overflow-x-auto pb-1">
                          <div className="inline-grid grid-flow-col grid-rows-7 gap-[3px]">
                            {matrixDates.map((d) => {
                              const val = habit.logs[d.iso] ?? 0;
                              const hit = val >= habit.targetPerDay;
                              const partial =
                                val > 0 && val < habit.targetPerDay;
                              const frozenDay = (
                                habit.freezeDates ?? []
                              ).includes(d.iso);
                              return (
                                <button
                                  key={d.iso}
                                  type="button"
                                  disabled={d.isFuture}
                                  onClick={() =>
                                    void toggleHabitLog(
                                      habit.id,
                                      d.iso,
                                      habit.targetPerDay > 1
                                        ? 'complete'
                                        : 'toggle'
                                    )
                                  }
                                  title={`${habit.name} · ${d.iso}: ${val}/${habit.targetPerDay}${frozenDay ? ' (frozen)' : ''}`}
                                  className={`w-2.5 h-2.5 rounded-[2px] transition-colors ${
                                    d.isFuture
                                      ? 'opacity-25 cursor-not-allowed bg-[#E9EEF6] dark:bg-[#282A2C]'
                                      : hit
                                        ? COLOR_SOLID[colorKey]
                                        : frozenDay
                                          ? 'bg-[#C2E7FF] dark:bg-[#004A77]'
                                          : partial
                                            ? COLOR_PARTIAL[colorKey]
                                            : 'bg-[#E9EEF6] dark:bg-[#282A2C]'
                                  }`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#E1E3E1] dark:border-[#444746] bg-[#F8FAFD] dark:bg-[#282A2C]/40">
                      <th className="sticky left-0 z-10 bg-[#F8FAFD] dark:bg-[#1E1F20] px-4 py-3 text-xs font-semibold text-[#444746] dark:text-[#C4C7C5] min-w-[175px] border-r border-[#E1E3E1] dark:border-[#444746]">
                        {tx('Goal · Schedule')}
                      </th>
                      {matrixDates.map((d) => (
                        <th
                          key={d.iso}
                          className={`px-1 py-2 text-center min-w-[38px] ${
                            d.isToday
                              ? 'bg-[#C2E7FF]/35 dark:bg-[#004A77]/35'
                              : ''
                          }`}
                        >
                          <div className="text-[10px] font-medium text-[#747775]">
                            {d.shortDay}
                          </div>
                          <div
                            className={`text-xs font-mono tabular-nums ${
                              d.isToday
                                ? 'font-bold text-[#0B57D0] dark:text-[#A8C7FA]'
                                : 'text-[#1F1F1F] dark:text-[#E3E3E3]'
                            }`}
                          >
                            {d.dayNum}
                          </div>
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right text-xs font-semibold text-[#444746] dark:text-[#C4C7C5] whitespace-nowrap">
                        {tx('Streak')}
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-[#444746] dark:text-[#C4C7C5] whitespace-nowrap">
                        {tx('Rate')}
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#F0F4F9] dark:divide-[#282A2C]">
                    {filteredActiveHabits.map((habit) => {
                      const colorKey: CalendarColor = habit.color ?? 'green';
                      const { current } = calculateHabitStreak(
                        habit.logs,
                        habit.targetPerDay,
                        habit
                      );
                      const scheduledInWindow = matrixDates.filter((d) =>
                        isHabitScheduledOnDate(habit, d.iso)
                      );
                      const doneInWindow = scheduledInWindow.filter(
                        (d) => (habit.logs[d.iso] ?? 0) >= habit.targetPerDay
                      ).length;
                      const rate =
                        scheduledInWindow.length > 0
                          ? Math.round(
                              (doneInWindow / scheduledInWindow.length) * 100
                            )
                          : 0;

                      return (
                        <tr
                          key={habit.id}
                          className="hover:bg-[#F8FAFD] dark:hover:bg-[#282A2C]/40"
                        >
                          <td className="sticky left-0 z-10 bg-white dark:bg-[#1E1F20] px-4 py-2.5 border-r border-[#E1E3E1] dark:border-[#444746]">
                            <button
                              type="button"
                              onClick={() => onEditHabit(habit)}
                              className="text-left min-w-0 max-w-[180px] group"
                            >
                              <p className="text-xs sm:text-sm font-medium text-[#1F1F1F] dark:text-[#E3E3E3] truncate group-hover:text-[#0B57D0] dark:group-hover:text-[#A8C7FA]">
                                {habit.name}
                              </p>
                              <p className="text-[11px] text-[#747775] truncate">
                                {formatHabitScheduleLabel(habit)}
                              </p>
                            </button>
                          </td>

                          {matrixDates.map((d) => {
                            const val = habit.logs[d.iso] ?? 0;
                            const hit = val >= habit.targetPerDay;
                            const partial =
                              val > 0 && val < habit.targetPerDay;
                            const sched = isHabitScheduledOnDate(habit, d.iso);

                            return (
                              <td
                                key={d.iso}
                                className={`p-1 text-center ${
                                  d.isToday
                                    ? 'bg-[#C2E7FF]/20 dark:bg-[#004A77]/20'
                                    : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  disabled={d.isFuture}
                                  onClick={() =>
                                    void toggleHabitLog(
                                      habit.id,
                                      d.iso,
                                      habit.targetPerDay > 1
                                        ? 'complete'
                                        : 'toggle'
                                    )
                                  }
                                  title={`${habit.name} · ${d.iso}: ${val}/${habit.targetPerDay}${sched ? ' (click to mark/unmark)' : ' (off-day — click to log)'}`}
                                  aria-label={`${habit.name} ${d.iso} ${hit ? 'completed' : 'incomplete'}`}
                                  className={`w-8 h-8 rounded-lg mx-auto flex items-center justify-center text-[11px] font-mono tabular-nums transition-colors ${
                                    d.isFuture
                                      ? 'opacity-25 cursor-not-allowed'
                                      : hit
                                        ? COLOR_SOLID[colorKey]
                                        : partial
                                          ? COLOR_PARTIAL[colorKey]
                                          : sched
                                            ? 'border border-[#DADCE0] dark:border-[#444746] hover:border-[#0B57D0] dark:hover:border-[#A8C7FA]'
                                            : 'text-[#C4C7C5] dark:text-[#444746] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]'
                                  }`}
                                >
                                  {hit ? (
                                    <Check className="w-3.5 h-3.5" />
                                  ) : partial ? (
                                    <span>{val}</span>
                                  ) : !sched ? (
                                    <span aria-hidden="true">·</span>
                                  ) : null}
                                </button>
                              </td>
                            );
                          })}

                          <td className="px-3 py-2 text-right font-mono text-xs font-semibold tabular-nums text-[#1F1F1F] dark:text-[#E3E3E3]">
                            {current}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-[#444746] dark:text-[#C4C7C5]">
                            {rate}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  <tfoot>
                    <tr className="border-t border-[#E1E3E1] dark:border-[#444746] bg-[#F8FAFD] dark:bg-[#282A2C]/40">
                      <td className="sticky left-0 z-10 bg-[#F8FAFD] dark:bg-[#1E1F20] px-4 py-2.5 text-xs font-medium text-[#444746] dark:text-[#C4C7C5] border-r border-[#E1E3E1] dark:border-[#444746]">
                        {tx('Daily completion')}
                      </td>
                      {matrixDates.map((d) => {
                        const sched = filteredActiveHabits.filter((h) =>
                          isHabitScheduledOnDate(h, d.iso)
                        );
                        const done = sched.filter(
                          (h) => (h.logs[d.iso] ?? 0) >= h.targetPerDay
                        ).length;
                        return (
                          <td
                            key={d.iso}
                            className="px-1 py-2 text-center font-mono text-[10px] tabular-nums text-[#747775]"
                          >
                            {sched.length > 0 ? `${done}/${sched.length}` : '—'}
                          </td>
                        );
                      })}
                      <td colSpan={2} className="px-3 py-2 text-right text-[11px] text-[#747775]">
                        {tx('Click any cell to backfill')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              )}
            </section>
          )}

          {/* ================= CALENDAR / BACKFILL MONTH VIEW ================= */}
          {viewMode === 'calendar' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
              <section className="md:col-span-2 rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-4 sm:p-5 space-y-4">
                {/* Month + Habit Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Previous month"
                      onClick={() =>
                        setCalendarMonth((m) => shiftMonthKey(m, -1))
                      }
                      className="min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 text-base font-semibold text-[#1F1F1F] dark:text-[#E3E3E3]">
                      {formatMonthLabel(calendarMonth)}
                    </span>
                    <button
                      type="button"
                      aria-label="Next month"
                      onClick={() =>
                        setCalendarMonth((m) => shiftMonthKey(m, 1))
                      }
                      className="min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <select
                    aria-label="Select habit for calendar view"
                    value={calendarHabitId}
                    onChange={(e) => setCalendarHabitId(e.target.value)}
                    className="min-h-[40px] rounded-full border border-[#DADCE0] dark:border-[#444746] bg-white dark:bg-[#1E1F20] px-4 text-xs font-medium text-[#1F1F1F] dark:text-[#E3E3E3]"
                  >
                    <option value="__all__">
                      {tx('All Habits (Select day to mark)')}
                    </option>
                    {activeHabits.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} — tap days to mark
                      </option>
                    ))}
                  </select>
                </div>

                {/* Weekday Headers */}
                <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-[#747775]">
                  {(startsMonday
                    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                  ).map((w) => (
                    <div key={w} className="py-1.5">
                      {w}
                    </div>
                  ))}
                </div>

                {/* 42-Cell Month Grid */}
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarMonthCells.map((cell) => {
                    if (selectedCalendarHabit) {
                      const val = selectedCalendarHabit.logs[cell.iso] ?? 0;
                      const hit = val >= selectedCalendarHabit.targetPerDay;
                      const partial =
                        val > 0 && val < selectedCalendarHabit.targetPerDay;
                      const sched = isHabitScheduledOnDate(
                        selectedCalendarHabit,
                        cell.iso
                      );
                      const colorKey: CalendarColor =
                        selectedCalendarHabit.color ?? 'green';

                      return (
                        <button
                          key={cell.iso}
                          type="button"
                          disabled={cell.isFuture}
                          onClick={() => {
                            setSelectedDate(cell.iso);
                            void toggleHabitLog(
                              selectedCalendarHabit.id,
                              cell.iso,
                              selectedCalendarHabit.targetPerDay > 1
                                ? 'complete'
                                : 'toggle'
                            );
                          }}
                          className={`min-h-[54px] rounded-2xl p-1.5 flex flex-col items-center justify-between transition-colors border ${
                            !cell.inMonth ? 'opacity-40' : ''
                          } ${cell.isFuture ? 'opacity-25 cursor-not-allowed' : ''} ${
                            hit
                              ? COLOR_SOLID[colorKey]
                              : partial
                                ? COLOR_PARTIAL[colorKey]
                                : cell.iso === selectedDate
                                  ? 'border-[#0B57D0] dark:border-[#A8C7FA] bg-[#F0F4F9] dark:bg-[#282A2C]'
                                  : sched
                                    ? 'border-[#DADCE0] dark:border-[#444746] hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C]'
                                    : 'border-transparent bg-[#F8FAFD] dark:bg-[#191A1C] text-[#747775]'
                          }`}
                        >
                          <span className="text-xs font-mono tabular-nums">
                            {cell.dayNum}
                          </span>
                          <span className="text-[10px] font-medium">
                            {hit ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : partial ? (
                              `${val}/${selectedCalendarHabit.targetPerDay}`
                            ) : sched ? (
                              'Due'
                            ) : (
                              '·'
                            )}
                          </span>
                        </button>
                      );
                    }

                    // Overall all-habits calendar cell
                    const schedList = activeHabits.filter((h) =>
                      isHabitScheduledOnDate(h, cell.iso)
                    );
                    const doneCnt = schedList.filter(
                      (h) => (h.logs[cell.iso] ?? 0) >= h.targetPerDay
                    ).length;
                    const allDone =
                      schedList.length > 0 && doneCnt === schedList.length;

                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        disabled={cell.isFuture}
                        onClick={() => setSelectedDate(cell.iso)}
                        className={`min-h-[54px] rounded-2xl p-1.5 flex flex-col items-center justify-between border transition-colors ${
                          !cell.inMonth ? 'opacity-40' : ''
                        } ${cell.isFuture ? 'opacity-25 cursor-not-allowed' : ''} ${
                          cell.iso === selectedDate
                            ? 'border-[#0B57D0] dark:border-[#A8C7FA] bg-[#C2E7FF]/40 dark:bg-[#004A77]/40'
                            : allDone
                              ? 'border-[#146C2E]/30 bg-[#E6F4EA] dark:bg-[#0A3818] text-[#146C2E] dark:text-[#6DD58C]'
                              : 'border-[#E1E3E1] dark:border-[#444746] hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C]'
                        }`}
                      >
                        <span
                          className={`text-xs font-mono tabular-nums ${
                            cell.isToday
                              ? 'font-bold text-[#0B57D0] dark:text-[#A8C7FA]'
                              : ''
                          }`}
                        >
                          {cell.dayNum}
                        </span>
                        <span className="text-[10px] font-mono tabular-nums opacity-80">
                          {schedList.length > 0
                            ? `${doneCnt}/${schedList.length}`
                            : '—'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Selected Date Quick-Mark Inspector */}
              <aside className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-[#1F1F1F] dark:text-[#E3E3E3]">
                      {selectedDate === todayISO
                        ? 'Today'
                        : formatShortDate(selectedDate)}
                    </h2>
                    <p className="text-xs text-[#444746] dark:text-[#C4C7C5]">
                      {tx('Tap any goal to mark or unmark this date')}
                    </p>
                  </div>
                  {selectedDate !== todayISO && (
                    <button
                      type="button"
                      onClick={() => setSelectedDate(todayISO)}
                      className="text-xs font-medium text-[#0B57D0] dark:text-[#A8C7FA] hover:underline"
                    >
                      {tx('Today')}
                    </button>
                  )}
                </div>

                <div className="divide-y divide-[#F0F4F9] dark:divide-[#282A2C]">
                  {activeHabits.map((h) => {
                    const count = h.logs[selectedDate] ?? 0;
                    const done = count >= h.targetPerDay;
                    const sched = isHabitScheduledOnDate(h, selectedDate);
                    const colorKey: CalendarColor = h.color ?? 'green';
                    return (
                      <div
                        key={h.id}
                        className="py-2.5 flex items-center justify-between gap-2"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            void toggleHabitLog(
                              h.id,
                              selectedDate,
                              h.targetPerDay > 1 ? 'complete' : 'toggle'
                            )
                          }
                          className="flex items-center gap-3 min-w-0 flex-1 text-left min-h-[40px]"
                        >
                          <span
                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${
                              done
                                ? COLOR_SOLID[colorKey]
                                : 'border-[#747775] dark:border-[#8E918F]'
                            }`}
                          >
                            {done && <Check className="w-3.5 h-3.5" />}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#1F1F1F] dark:text-[#E3E3E3] truncate">
                              {h.name}
                            </p>
                            <p className="text-[11px] text-[#747775] truncate">
                              {sched ? 'Scheduled' : 'Off-day'} ·{' '}
                              {formatHabitScheduleLabel(h)}
                            </p>
                          </div>
                        </button>

                        {h.preferredTime && (
                          <span className="text-[11px] text-[#747775] inline-flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3" />
                            {formatTime12h(h.preferredTime)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
};

function displayedEmpty(
  showArchived: boolean,
  activeHabits: HabitRecord[],
  archivedHabits: HabitRecord[]
): boolean {
  return showArchived ? archivedHabits.length === 0 : activeHabits.length === 0;
}
