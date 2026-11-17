import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BellRing,
  Check,
  CheckSquare,
  Clock,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Star,
  StickyNote,
  Timer,
} from 'lucide-react';
import { DEFAULT_TASK_LIST_ID, useVault } from '../context/VaultContext';
import {
  calculateHabitStreak,
  formatCurrency,
  formatHabitScheduleLabel,
  formatShortDate,
  formatTime12h,
  getDaysUntil,
  getMonthKey,
  getOffsetDateISO,
  getPurchaseEntryType,
  getTodayISO,
  isHabitScheduledOnDate,
  parseNaturalTaskInput,
} from '../lib/format';
import {
  collectDueReminders,
  dispatchLocalNotification,
  getNotificationPermission,
  playSubtleChime,
  requestNotificationPermission,
} from '../lib/notifications';
import type {
  CalendarEventRecord,
  HabitRecord,
  NavTab,
  PurchaseRecord,
  SubscriptionRecord,
  TaskRecord,
} from '../types';

interface HomeViewProps {
  onNavigate: (tab: NavTab) => void;
  onOpenSubscriptions: () => void;
  onOpenRemindersSettings: () => void;
  onOpenNewPurchase: () => void;
  onOpenNewEvent: (dateISO?: string) => void;
  onEditPurchase: (purchase: PurchaseRecord) => void;
  onEditSubscription: (sub: SubscriptionRecord) => void;
  onEditHabit: (habit: HabitRecord) => void;
  onEditTask: (task: TaskRecord) => void;
  onEditEvent: (event: CalendarEventRecord) => void;
}

type FocusTab = 'all' | 'tasks' | 'habits' | 'timer';

const FOCUS_PRESETS = [
  { id: 'focus', label: '25m Focus', seconds: 25 * 60 },
  { id: 'sprint', label: '15m Sprint', seconds: 15 * 60 },
  { id: 'break', label: '5m Break', seconds: 5 * 60 },
] as const;

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigate,
  onOpenSubscriptions,
  onOpenRemindersSettings,
  onOpenNewPurchase,
  onOpenNewEvent,
  onEditPurchase,
  onEditSubscription,
  onEditHabit,
  onEditTask,
  onEditEvent,
}) => {
  const {
    user,
    purchases,
    subscriptions,
    habits,
    tasks,
    taskLists,
    calendarEvents,
    preferences,
    toggleHabitLog,
    toggleTaskCompleted,
    toggleTaskStarred,
    snoozeTaskToTomorrow,
    logTaskFocusMinutes,
    logSubscriptionPayment,
    saveTask,
    saveHabit,
    updatePreferences,
    runReminderSweepNow,
  } = useVault();

  const todayISO = getTodayISO();
  const currentMonth = getMonthKey(todayISO);

  const [focusTab, setFocusTab] = useState<FocusTab>('all');
  const [quickInput, setQuickInput] = useState('');
  const [selectedScheduleDay, setSelectedScheduleDay] = useState(todayISO);
  const [focusTaskId, setFocusTaskId] = useState<string>('');

  // Encrypted Scratchpad state
  const [scratchText, setScratchText] = useState(preferences.scratchpad ?? '');
  const [scratchSavedAt, setScratchSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setScratchText(preferences.scratchpad ?? '');
  }, [preferences.scratchpad]);

  // Focus Timer state
  const [timerPresetSec, setTimerPresetSec] = useState(25 * 60);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  const focusSessionsCount =
    preferences.focusSessionsToday?.date === todayISO
      ? preferences.focusSessionsToday.count
      : 0;

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          setTimerRunning(false);
          playSubtleChime();
          void dispatchLocalNotification(
            'Focus session complete',
            'Take a short break or log your next step in MMV-HUB.',
            'mmv-focus-timer'
          );
          const nextCount =
            (preferences.focusSessionsToday?.date === todayISO
              ? preferences.focusSessionsToday.count
              : 0) + 1;
          void updatePreferences({
            focusSessionsToday: { date: todayISO, count: nextCount },
          });
          if (focusTaskId) {
            const mins = Math.max(1, Math.round(timerPresetSec / 60));
            void logTaskFocusMinutes(focusTaskId, mins);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [
    timerRunning,
    todayISO,
    preferences.focusSessionsToday,
    updatePreferences,
    focusTaskId,
    timerPresetSec,
    logTaskFocusMinutes,
  ]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const base =
      hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const firstName = user?.displayName?.split(' ')[0];
    return firstName ? `${base}, ${firstName}` : base;
  }, [user?.displayName]);

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  const dueReminders = useMemo(
    () =>
      collectDueReminders({
        purchases,
        tasks,
        habits,
        subscriptions,
        calendarEvents,
        preferences,
      }),
    [purchases, tasks, habits, subscriptions, calendarEvents, preferences]
  );

  const { monthlySpend, monthlyIncome } = useMemo(() => {
    let spend = 0;
    let income = 0;
    for (const p of purchases) {
      if (getMonthKey(p.date) !== currentMonth) continue;
      const entryType = getPurchaseEntryType(p);
      if (entryType === 'income') {
        income += p.amount;
      } else if (entryType === 'refund') {
        spend -= p.amount;
      } else {
        spend += p.amount;
      }
    }
    return { monthlySpend: spend, monthlyIncome: income };
  }, [purchases, currentMonth]);

  const blurClass = preferences.privacyBlur ? 'hub-privacy-blur' : '';

  const budgetPct =
    preferences.monthlyBudget > 0
      ? Math.min(
          999,
          Math.max(
            0,
            Math.round((monthlySpend / preferences.monthlyBudget) * 100)
          )
        )
      : 0;

  const savingsHeadroom = preferences.monthlyBudget - monthlySpend;
  const savingsGoal = preferences.monthlySavingsGoal ?? 0;

  const activeHabits = useMemo(
    () => habits.filter((h) => !h.archived),
    [habits]
  );

  const scheduledTodayHabits = useMemo(
    () => activeHabits.filter((h) => isHabitScheduledOnDate(h, todayISO)),
    [activeHabits, todayISO]
  );

  const habitsCompletedToday = useMemo(() => {
    return scheduledTodayHabits.filter(
      (h) => (h.logs[todayISO] ?? 0) >= h.targetPerDay
    ).length;
  }, [scheduledTodayHabits, todayISO]);

  const openTasks = useMemo(
    () => tasks.filter((t) => !t.completed),
    [tasks]
  );

  const overdueCount = useMemo(
    () => openTasks.filter((t) => t.dueDate && t.dueDate < todayISO).length,
    [openTasks, todayISO]
  );

  // Combined Daily Ring: Today's scheduled habits + tasks due today
  const tasksDueToday = useMemo(
    () => tasks.filter((t) => t.dueDate === todayISO),
    [tasks, todayISO]
  );
  const tasksCompletedToday = useMemo(
    () => tasksDueToday.filter((t) => t.completed).length,
    [tasksDueToday]
  );

  const dailyGoalsTotal = scheduledTodayHabits.length + tasksDueToday.length;
  const dailyGoalsDone = habitsCompletedToday + tasksCompletedToday;
  const dailyGoalsPct =
    dailyGoalsTotal > 0
      ? Math.round((dailyGoalsDone / dailyGoalsTotal) * 100)
      : 100;

  const upcomingRenewals = useMemo(
    () =>
      subscriptions
        .filter((s) => s.active && getDaysUntil(s.nextBillingDate, todayISO) <= 30)
        .sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate)),
    [subscriptions, todayISO]
  );

  const next30DaysSubsTotal = useMemo(
    () => upcomingRenewals.reduce((sum, s) => sum + s.amount, 0),
    [upcomingRenewals]
  );

  // Interactive 7-day strip for Mini Schedule
  const next7Days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const iso = getOffsetDateISO(i, todayISO);
      const [y, m, d] = iso.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const evCount = calendarEvents.filter((ev) => ev.date === iso).length;
      const taskCount = openTasks.filter((t) => t.dueDate === iso).length;
      const subCount = subscriptions.filter(
        (s) => s.active && s.nextBillingDate === iso
      ).length;
      return {
        iso,
        weekday: dt.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: dt.getDate(),
        totalCount: evCount + taskCount + subCount,
      };
    });
  }, [todayISO, calendarEvents, openTasks, subscriptions]);

  const selectedDayAgenda = useMemo(() => {
    const events = calendarEvents.filter((ev) => ev.date === selectedScheduleDay);
    const dayTasks = openTasks.filter((t) => t.dueDate === selectedScheduleDay);
    const renewals = subscriptions.filter(
      (s) => s.active && s.nextBillingDate === selectedScheduleDay
    );
    return { events, dayTasks, renewals };
  }, [calendarEvents, openTasks, subscriptions, selectedScheduleDay]);

  const focusHabits = (
    scheduledTodayHabits.length > 0 ? scheduledTodayHabits : activeHabits
  ).slice(0, 5);
  const focusTasks = openTasks.slice(0, 6);
  const recentPurchases = purchases.slice(0, 4);

  const handleInlineQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = quickInput.trim();
    if (!text) return;
    if (focusTab === 'habits') {
      await saveHabit({
        name: text,
        cadence: 'daily',
        targetPerDay: 1,
      });
    } else {
      const parsed = parseNaturalTaskInput(text, taskLists, todayISO);
      await saveTask({
        listId: parsed.listId ?? DEFAULT_TASK_LIST_ID,
        title: parsed.title,
        completed: false,
        priority: parsed.priority ?? 'medium',
        dueDate: parsed.dueDate ?? todayISO,
        dueTime: parsed.dueTime,
        area: parsed.area ?? 'My Tasks',
      });
    }
    setQuickInput('');
  };

  const handleSaveScratchpad = async () => {
    if (scratchText === (preferences.scratchpad ?? '')) return;
    await updatePreferences({ scratchpad: scratchText });
    setScratchSavedAt(Date.now());
  };

  const timerMinutes = Math.floor(secondsLeft / 60);
  const timerSecs = secondsLeft % 60;
  const timerFormatted = `${String(timerMinutes).padStart(2, '0')}:${String(timerSecs).padStart(2, '0')}`;
  const timerProgressPct =
    timerPresetSec > 0
      ? Math.round(((timerPresetSec - secondsLeft) / timerPresetSec) * 100)
      : 0;

  const ringRadius = 15;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset =
    ringCircumference - (dailyGoalsPct / 100) * ringCircumference;

  const urgentReminderCount = dueReminders.filter((r) => r.urgent).length;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Minimalist Google Header — No Search Bar, No Circular Shortcut Grid */}
      <section className="max-w-3xl mx-auto pt-1 sm:pt-3 text-center space-y-1.5">
        <p className="text-xs sm:text-sm text-[#5F6368] dark:text-[#9AA0A6]">
          {todayFormatted} · {greeting}
        </p>
        <h1
          aria-label="MMV-HUB"
          className="text-3xl sm:text-4xl font-semibold tracking-tight select-none"
        >
          <span className="text-[#4285F4] dark:text-[#8AB4F8]">M</span>
          <span className="text-[#EA4335] dark:text-[#F28B82]">M</span>
          <span className="text-[#FBBC05] dark:text-[#FDD663]">V</span>
          <span className="text-[#5F6368] dark:text-[#9AA0A6]">-</span>
          <span className="text-[#4285F4] dark:text-[#8AB4F8]">H</span>
          <span className="text-[#34A853] dark:text-[#81C995]">U</span>
          <span className="text-[#EA4335] dark:text-[#F28B82]">B</span>
        </h1>
      </section>

      {/* Smart Reminder Alert Strip (only visible when reminders are due) */}
      {dueReminders.length > 0 && (
        <section
          aria-label="Due reminders"
          className="max-w-6xl mx-auto rounded-2xl border border-[#DADCE0] dark:border-[#3C4043] bg-white dark:bg-[#1E1F20] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <BellRing
              className={`w-4 h-4 shrink-0 ${
                urgentReminderCount > 0
                  ? 'text-[#C5221F] dark:text-[#F28B82]'
                  : 'hub-text-accent'
              }`}
            />
            <div className="min-w-0 text-xs">
              <p className="font-medium text-[#202124] dark:text-[#E8EAED] truncate">
                {dueReminders.length}{' '}
                {dueReminders.length === 1 ? 'reminder due' : 'reminders due'} ·{' '}
                {dueReminders[0].title}
              </p>
              <p className="text-[#5F6368] dark:text-[#9AA0A6] truncate">
                {dueReminders[0].body}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                if (getNotificationPermission() !== 'granted') {
                  const perm = await requestNotificationPermission();
                  if (perm === 'granted') {
                    await updatePreferences({ notificationsEnabled: true });
                  }
                }
                await runReminderSweepNow();
              }}
              className="min-h-[36px] px-3.5 rounded-full hub-bg-soft text-xs font-medium whitespace-nowrap"
            >
              Send Alert
            </button>
            <button
              type="button"
              onClick={onOpenRemindersSettings}
              className="min-h-[36px] px-3 rounded-full text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C] whitespace-nowrap"
            >
              Manage
            </button>
          </div>
        </section>
      )}

      {/* Unified At-a-Glance Hairline Strip */}
      <section
        aria-label="Personal Snapshot"
        className="max-w-6xl mx-auto rounded-2xl border border-[#DADCE0] dark:border-[#3C4043] bg-[#E8EAED] dark:bg-[#3C4043] grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden"
      >
        <button
          type="button"
          onClick={() => onNavigate('purchases')}
          className="text-left bg-white dark:bg-[#1E1F20] hover:bg-[#F8F9FA] dark:hover:bg-[#282A2C] p-4 sm:p-5 transition-colors"
        >
          <span className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">
            Month Net Spend
          </span>
          <p className={`mt-1.5 text-xl sm:text-2xl font-semibold font-mono tabular-nums text-[#202124] dark:text-[#E8EAED] ${blurClass}`}>
            {formatCurrency(monthlySpend, preferences.currency)}
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-[#5F6368] dark:text-[#9AA0A6]">
            <span className={blurClass}>
              {budgetPct}% of{' '}
              {formatCurrency(preferences.monthlyBudget, preferences.currency)}
            </span>
            {monthlyIncome > 0 && (
              <span className={`text-[#146C2E] dark:text-[#81C995] ${blurClass}`}>
                {' '}
                · +{formatCurrency(monthlyIncome, preferences.currency)} in
              </span>
            )}
            {monthlyIncome === 0 && savingsGoal > 0
              ? savingsHeadroom >= savingsGoal
                ? ' · Goal met'
                : ` · ${formatCurrency(Math.max(0, savingsHeadroom), preferences.currency)} left`
              : ''}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('habits')}
          className="text-left bg-white dark:bg-[#1E1F20] hover:bg-[#F8F9FA] dark:hover:bg-[#282A2C] p-4 sm:p-5 transition-colors flex items-center justify-between gap-2"
        >
          <div className="min-w-0">
            <span className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">
              Today's Goals
            </span>
            <p className="mt-1.5 text-xl sm:text-2xl font-semibold font-mono tabular-nums text-[#202124] dark:text-[#E8EAED]">
              {dailyGoalsDone} / {dailyGoalsTotal}
            </p>
            <p className="mt-0.5 text-xs text-[#5F6368] dark:text-[#9AA0A6] truncate">
              {habitsCompletedToday}/{scheduledTodayHabits.length} habits ·{' '}
              {tasksCompletedToday}/{tasksDueToday.length} tasks
            </p>
          </div>
          <svg
            width="40"
            height="40"
            viewBox="0 0 40 40"
            aria-hidden="true"
            className="shrink-0 -rotate-90"
          >
            <circle
              cx="20"
              cy="20"
              r={ringRadius}
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              className="text-[#E8EAED] dark:text-[#282A2C]"
            />
            <circle
              cx="20"
              cy="20"
              r={ringRadius}
              fill="none"
              stroke="var(--hub-accent)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringOffset}
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('tasks')}
          className="text-left bg-white dark:bg-[#1E1F20] hover:bg-[#F8F9FA] dark:hover:bg-[#282A2C] p-4 sm:p-5 transition-colors"
        >
          <span className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">
            Open Tasks
          </span>
          <p className="mt-1.5 text-xl sm:text-2xl font-semibold font-mono tabular-nums text-[#202124] dark:text-[#E8EAED]">
            {openTasks.length}
          </p>
          <p
            className={`mt-0.5 text-xs tabular-nums ${
              overdueCount > 0
                ? 'text-[#C5221F] dark:text-[#F28B82] font-medium'
                : 'text-[#5F6368] dark:text-[#9AA0A6]'
            }`}
          >
            {overdueCount > 0 ? `${overdueCount} overdue` : 'On schedule'}
          </p>
        </button>

        <button
          type="button"
          onClick={onOpenSubscriptions}
          className="text-left bg-white dark:bg-[#1E1F20] hover:bg-[#F8F9FA] dark:hover:bg-[#282A2C] p-4 sm:p-5 transition-colors"
        >
          <span className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">
            30d Renewals
          </span>
          <p className={`mt-1.5 text-xl sm:text-2xl font-semibold font-mono tabular-nums text-[#202124] dark:text-[#E8EAED] ${blurClass}`}>
            {formatCurrency(next30DaysSubsTotal, preferences.currency)}
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-[#5F6368] dark:text-[#9AA0A6]">
            {upcomingRenewals.length}{' '}
            {upcomingRenewals.length === 1 ? 'plan' : 'plans'} upcoming
          </p>
        </button>
      </section>

      {/* Main 2-Column Google Workspace Digest */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* Left: Today's Focus (Tasks, Habits & Focus Timer) */}
        <section className="md:col-span-7 rounded-2xl border border-[#DADCE0] dark:border-[#3C4043] bg-white dark:bg-[#1E1F20] overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-[#E8EAED] dark:border-[#3C4043] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 p-0.5 rounded-full bg-[#F1F3F4] dark:bg-[#282A2C]">
              {(
                [
                  { id: 'all', label: 'Today' },
                  { id: 'tasks', label: `Tasks (${openTasks.length})` },
                  {
                    id: 'habits',
                    label: `Habits (${scheduledTodayHabits.length})`,
                  },
                  { id: 'timer', label: 'Focus' },
                ] as { id: FocusTab; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFocusTab(tab.id)}
                  className={`min-h-[32px] px-3 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    focusTab === tab.id
                      ? 'bg-white dark:bg-[#1E1F20] text-[#202124] dark:text-[#E8EAED] shadow-2xs'
                      : 'text-[#5F6368] dark:text-[#9AA0A6] hover:text-[#202124] dark:hover:text-[#E8EAED]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {focusTab !== 'timer' ? (
              <button
                type="button"
                onClick={() =>
                  onNavigate(focusTab === 'habits' ? 'habits' : 'tasks')
                }
                className="inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-full text-xs font-medium hub-text-accent hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C] whitespace-nowrap"
              >
                <span>{focusTab === 'habits' ? 'All Habits' : 'All Tasks'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="text-xs font-mono tabular-nums text-[#5F6368] dark:text-[#9AA0A6]">
                {focusSessionsCount} completed today
              </span>
            )}
          </div>

          {focusTab === 'timer' ? (
            <div className="p-6 sm:p-8 flex flex-col items-center text-center space-y-5">
              <div className="inline-flex items-center gap-1.5 p-1 rounded-full bg-[#F1F3F4] dark:bg-[#282A2C]">
                {FOCUS_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setTimerRunning(false);
                      setTimerPresetSec(preset.seconds);
                      setSecondsLeft(preset.seconds);
                    }}
                    className={`min-h-[32px] px-3.5 rounded-full text-xs font-medium transition-colors ${
                      timerPresetSec === preset.seconds
                        ? 'hub-bg-soft font-semibold'
                        : 'text-[#5F6368] dark:text-[#9AA0A6]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {openTasks.length > 0 && (
                <select
                  aria-label="Link focus session to task"
                  value={focusTaskId}
                  onChange={(e) => setFocusTaskId(e.target.value)}
                  className="w-full max-w-xs min-h-[38px] rounded-xl border border-[#DADCE0] dark:border-[#3C4043] bg-white dark:bg-[#131314] px-3 text-xs text-[#202124] dark:text-[#E8EAED]"
                >
                  <option value="">General focus session (no linked task)</option>
                  {openTasks.slice(0, 20).map((t) => (
                    <option key={t.id} value={t.id}>
                      Focus on: {t.title}
                    </option>
                  ))}
                </select>
              )}

              <div className="space-y-2 w-full max-w-xs">
                <div className="inline-flex items-center gap-2 text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                  <Timer className="w-3.5 h-3.5 hub-text-accent" />
                  <span>
                    {timerRunning
                      ? 'Session in progress'
                      : secondsLeft === 0
                        ? 'Session finished'
                        : 'Ready'}
                  </span>
                </div>
                <p className="text-5xl font-mono font-semibold tabular-nums tracking-tight text-[#202124] dark:text-[#E8EAED]">
                  {timerFormatted}
                </p>
                <div className="h-1.5 w-full rounded-full bg-[#E8EAED] dark:bg-[#282A2C] overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${timerProgressPct}%`,
                      backgroundColor: 'var(--hub-accent)',
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (secondsLeft === 0) setSecondsLeft(timerPresetSec);
                    setTimerRunning((r) => !r);
                  }}
                  className="min-h-[44px] px-6 rounded-full hub-bg-accent text-sm font-medium inline-flex items-center gap-2"
                >
                  {timerRunning ? (
                    <>
                      <Pause className="w-4 h-4" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>{secondsLeft === 0 ? 'Restart' : 'Start Focus'}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Reset timer"
                  onClick={() => {
                    setTimerRunning(false);
                    setSecondsLeft(timerPresetSec);
                  }}
                  className="min-h-[44px] min-w-[44px] rounded-full border border-[#DADCE0] dark:border-[#3C4043] flex items-center justify-center text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Inline Google Tasks-style Quick Add */}
              <form
                onSubmit={handleInlineQuickAdd}
                className="px-4 sm:px-5 py-2 border-b border-[#E8EAED] dark:border-[#3C4043] flex items-center gap-2"
              >
                <Plus className="w-4 h-4 hub-text-accent shrink-0" />
                <input
                  type="text"
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  placeholder={
                    focusTab === 'habits'
                      ? 'Add a daily habit...'
                      : 'Add task (e.g. Pay rent tomorrow 9am !high)...'
                  }
                  className="flex-1 min-h-[40px] bg-transparent text-sm text-[#202124] dark:text-[#E8EAED] placeholder:text-[#5F6368] dark:placeholder:text-[#9AA0A6] focus:outline-none"
                />
                {quickInput.trim() && (
                  <button
                    type="submit"
                    className="min-h-[34px] px-3.5 rounded-full hub-bg-accent text-xs font-medium whitespace-nowrap"
                  >
                    Add
                  </button>
                )}
              </form>

              {/* Habits & Tasks Rows */}
              {(focusTab === 'all' &&
                focusHabits.length === 0 &&
                focusTasks.length === 0) ||
              (focusTab === 'tasks' && focusTasks.length === 0) ||
              (focusTab === 'habits' && focusHabits.length === 0) ? (
                <div className="py-12 px-6 text-center space-y-2">
                  <CheckSquare className="w-6 h-6 mx-auto text-[#5F6368] dark:text-[#9AA0A6]" />
                  <p className="text-sm text-[#5F6368] dark:text-[#9AA0A6]">
                    {focusTab === 'habits'
                      ? 'No habits scheduled yet.'
                      : 'All caught up for today.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#F1F3F4] dark:divide-[#282A2C]">
                  {(focusTab === 'all' || focusTab === 'habits') &&
                    focusHabits.map((habit) => {
                      const count = habit.logs[todayISO] ?? 0;
                      const done = count >= habit.targetPerDay;
                      const { current } = calculateHabitStreak(
                        habit.logs,
                        habit.targetPerDay,
                        habit
                      );
                      return (
                        <div
                          key={habit.id}
                          className="px-4 sm:px-5 py-2 flex items-center justify-between gap-3 hover:bg-[#F8F9FA] dark:hover:bg-[#282A2C]/60 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              void toggleHabitLog(
                                habit.id,
                                todayISO,
                                habit.targetPerDay > 1 ? 'increment' : 'toggle'
                              )
                            }
                            className="flex items-center gap-3 min-w-0 flex-1 text-left min-h-[44px]"
                          >
                            <span
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                done
                                  ? 'bg-[#146C2E] border-[#146C2E] text-white dark:bg-[#81C995] dark:border-[#81C995] dark:text-[#0A3818]'
                                  : 'border-[#5F6368] dark:border-[#9AA0A6]'
                              }`}
                            >
                              {done && <Check className="w-3 h-3" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-sm font-medium truncate ${
                                  done
                                    ? 'text-[#5F6368] dark:text-[#9AA0A6] line-through'
                                    : 'text-[#202124] dark:text-[#E8EAED]'
                                }`}
                              >
                                {habit.name}
                              </p>
                              <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] truncate tabular-nums">
                                Habit
                                {habit.targetPerDay > 1
                                  ? ` · ${count}/${habit.targetPerDay} ${habit.unit || 'units'}`
                                  : ''}
                                {' · '}
                                {formatHabitScheduleLabel(habit)}
                              </p>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditHabit(habit)}
                            className="text-xs font-mono tabular-nums text-[#5F6368] dark:text-[#9AA0A6] hover:underline shrink-0"
                          >
                            {current}d
                          </button>
                        </div>
                      );
                    })}

                  {(focusTab === 'all' || focusTab === 'tasks') &&
                    focusTasks.map((task) => {
                      const isOverdue = task.dueDate && task.dueDate < todayISO;
                      const isDueToday = task.dueDate === todayISO;
                      return (
                        <div
                          key={task.id}
                          className="px-4 sm:px-5 py-2 flex items-center gap-1.5 hover:bg-[#F8F9FA] dark:hover:bg-[#282A2C]/60 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => void toggleTaskCompleted(task.id)}
                            aria-label={`Complete ${task.title}`}
                            className="min-h-[44px] min-w-[40px] -ml-2 flex items-center justify-center shrink-0"
                          >
                            <span className="w-5 h-5 rounded-full border-2 border-[#5F6368] dark:border-[#9AA0A6] hover:border-[var(--hub-accent)] transition-colors" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditTask(task)}
                            className="min-w-0 flex-1 text-left py-1"
                          >
                            <p className="text-sm font-medium text-[#202124] dark:text-[#E8EAED] truncate">
                              {task.title}
                            </p>
                            <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] truncate">
                              <span className="capitalize">{task.priority}</span>
                              {task.dueDate && (
                                <span
                                  className={
                                    isOverdue
                                      ? ' text-[#C5221F] dark:text-[#F28B82] font-medium'
                                      : ''
                                  }
                                >
                                  {' · '}
                                  {isOverdue ? 'Overdue ' : ''}
                                  {formatShortDate(task.dueDate)}
                                </span>
                              )}
                              {task.area ? ` · ${task.area}` : ''}
                            </p>
                          </button>

                          {(isOverdue || isDueToday) && (
                            <button
                              type="button"
                              onClick={() => void snoozeTaskToTomorrow(task.id)}
                              title="Snooze to tomorrow"
                              className="min-h-[34px] px-2.5 rounded-full text-[11px] font-medium text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#E8EAED] dark:hover:bg-[#303134] inline-flex items-center gap-1 shrink-0"
                            >
                              <Clock className="w-3 h-3" />
                              <span className="hidden sm:inline">Tomorrow</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => void toggleTaskStarred(task.id)}
                            aria-label={task.starred ? 'Unstar task' : 'Star task'}
                            className="min-h-[44px] min-w-[40px] flex items-center justify-center rounded-full text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#E8EAED] dark:hover:bg-[#303134] shrink-0"
                          >
                            <Star
                              className={`w-4 h-4 ${
                                task.starred ? 'fill-current hub-text-accent' : ''
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </section>

        {/* Right: 7-Day Interactive Mini-Schedule, Recent Wallet & Scratchpad */}
        <section className="md:col-span-5 rounded-2xl border border-[#DADCE0] dark:border-[#3C4043] bg-white dark:bg-[#1E1F20] divide-y divide-[#E8EAED] dark:divide-[#3C4043] overflow-hidden">
          {/* Interactive 7-Day Mini-Schedule */}
          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#202124] dark:text-[#E8EAED]">
                7-Day Schedule
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenNewEvent(selectedScheduleDay)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] hover:text-[#202124] dark:hover:text-[#E8EAED]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Event</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('calendar')}
                  className="inline-flex items-center gap-1 text-xs font-medium hub-text-accent hover:underline"
                >
                  <span>Calendar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 7-Day Strip */}
            <div className="grid grid-cols-7 gap-1">
              {next7Days.map((day) => {
                const selected = selectedScheduleDay === day.iso;
                const isToday = day.iso === todayISO;
                return (
                  <button
                    key={day.iso}
                    type="button"
                    onClick={() => setSelectedScheduleDay(day.iso)}
                    className={`py-2 rounded-xl flex flex-col items-center gap-0.5 text-center transition-colors ${
                      selected
                        ? 'hub-bg-soft font-semibold'
                        : 'hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C] text-[#5F6368] dark:text-[#9AA0A6]'
                    }`}
                  >
                    <span className="text-[10px]">{day.weekday}</span>
                    <span
                      className={`text-xs font-mono tabular-nums ${
                        isToday && !selected ? 'hub-text-accent font-semibold' : ''
                      }`}
                    >
                      {day.dayNum}
                    </span>
                    <span
                      className={`w-1 h-1 rounded-full ${
                        day.totalCount > 0
                          ? 'bg-current opacity-80'
                          : 'opacity-0'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {selectedDayAgenda.events.length === 0 &&
            selectedDayAgenda.dayTasks.length === 0 &&
            selectedDayAgenda.renewals.length === 0 ? (
              <p className="py-2 text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                Nothing scheduled for {selectedScheduleDay === todayISO ? 'today' : formatShortDate(selectedScheduleDay)}.
              </p>
            ) : (
              <div className="divide-y divide-[#F1F3F4] dark:divide-[#282A2C]">
                {selectedDayAgenda.events.map((ev) => {
                  const days = ev.isMilestone
                    ? getDaysUntil(ev.date, todayISO)
                    : null;
                  const dTag =
                    days === null
                      ? ''
                      : days === 0
                        ? ' · Today'
                        : days > 0
                          ? ` · D-${days}`
                          : ` · D+${Math.abs(days)}`;
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => onEditEvent(ev)}
                      className="w-full text-left py-2.5 flex items-center justify-between gap-3 hover:opacity-80"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#202124] dark:text-[#E8EAED] truncate">
                          {ev.title}
                        </p>
                        <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] truncate">
                          {ev.allDay
                            ? 'All day'
                            : formatTime12h(ev.startTime)}
                          {ev.location ? ` · ${ev.location}` : ''}
                          {dTag}
                        </p>
                      </div>
                    </button>
                  );
                })}
                {selectedDayAgenda.dayTasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onEditTask(t)}
                    className="w-full text-left py-2.5 flex items-center justify-between gap-3 hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#202124] dark:text-[#E8EAED] truncate">
                        {t.title}
                      </p>
                      <p className="text-xs text-[#146C2E] dark:text-[#81C995]">
                        Task{t.dueTime ? ` · ${formatTime12h(t.dueTime)}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
                {selectedDayAgenda.renewals.map((sub) => (
                  <div
                    key={sub.id}
                    className="py-2.5 flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => onEditSubscription(sub)}
                      className="min-w-0 flex-1 text-left hover:opacity-80"
                    >
                      <p className="text-sm font-medium hub-text-accent truncate">
                        {sub.isTrial ? 'Trial ends' : 'Renewal'}: {sub.name}
                      </p>
                      <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] font-mono tabular-nums">
                        {formatCurrency(sub.amount, preferences.currency)} ·{' '}
                        {sub.billingCycle}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => void logSubscriptionPayment(sub.id)}
                      className="min-h-[32px] px-3 rounded-full hub-bg-soft text-xs font-medium shrink-0"
                    >
                      Log Paid
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Wallet Transactions */}
          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#202124] dark:text-[#E8EAED]">
                Recent Wallet Activity
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenNewPurchase}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] hover:text-[#202124] dark:hover:text-[#E8EAED]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('purchases')}
                  className="inline-flex items-center gap-1 text-xs font-medium hub-text-accent hover:underline"
                >
                  <span>Wallet</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {recentPurchases.length === 0 ? (
              <p className="py-2 text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                No recent purchases logged.
              </p>
            ) : (
              <div className="divide-y divide-[#F1F3F4] dark:divide-[#282A2C]">
                {recentPurchases.map((p) => {
                  const entryType = getPurchaseEntryType(p);
                  const isCredit = entryType === 'refund' || entryType === 'income';
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onEditPurchase(p)}
                      className="w-full text-left py-2.5 flex items-center justify-between gap-3 hover:opacity-80"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#202124] dark:text-[#E8EAED] truncate">
                          {p.title}
                        </p>
                        <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] truncate">
                          {formatShortDate(p.date)} · {p.category} ·{' '}
                          {p.paymentMethod}
                          {entryType === 'refund'
                            ? ' · Refund'
                            : entryType === 'income'
                              ? ' · Income'
                              : ''}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-mono font-semibold tabular-nums shrink-0 ${blurClass} ${
                          isCredit
                            ? 'text-[#146C2E] dark:text-[#81C995]'
                            : 'text-[#202124] dark:text-[#E8EAED]'
                        }`}
                      >
                        {isCredit
                          ? `+${formatCurrency(p.amount, preferences.currency)}`
                          : formatCurrency(p.amount, preferences.currency)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Encrypted Personal Scratchpad */}
          <div className="p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="home-scratchpad"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#202124] dark:text-[#E8EAED]"
              >
                <StickyNote className="w-4 h-4 hub-text-accent" />
                <span>Encrypted Note</span>
              </label>
              {scratchText !== (preferences.scratchpad ?? '') ? (
                <button
                  type="button"
                  onClick={() => void handleSaveScratchpad()}
                  className="text-xs font-medium hub-text-accent hover:underline"
                >
                  Save
                </button>
              ) : scratchSavedAt ? (
                <span className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
                  Saved encrypted
                </span>
              ) : null}
            </div>
            <textarea
              id="home-scratchpad"
              rows={3}
              value={scratchText}
              onChange={(e) => setScratchText(e.target.value)}
              onBlur={() => void handleSaveScratchpad()}
              placeholder="Jot down quick encrypted notes, links, or reminders..."
              className="w-full rounded-xl border border-[#E8EAED] dark:border-[#3C4043] bg-[#F8F9FA] dark:bg-[#131314] px-3 py-2 text-xs sm:text-sm text-[#202124] dark:text-[#E8EAED] placeholder:text-[#5F6368] dark:placeholder:text-[#9AA0A6] focus:outline-none focus:border-[var(--hub-accent)] resize-none"
            />
          </div>
        </section>
      </div>
    </div>
  );
};
