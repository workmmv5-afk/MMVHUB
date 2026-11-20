import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Flag,
  ListPlus,
  Minus,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Target,
  Trophy,
} from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { t } from '../lib/i18n';
import {
  computeGoalProgress,
  formatShortDate,
  getDaysUntil,
  getTodayISO,
  type GoalProgressSummary,
} from '../lib/format';
import type {
  CalendarColor,
  GoalRecord,
  GoalStatus,
  HabitRecord,
  TaskRecord,
} from '../types';

interface GoalsViewProps {
  onNewGoal: () => void;
  onEditGoal: (goal: GoalRecord) => void;
  onNewTaskForGoal: (goalId: string) => void;
  onEditTask: (task: TaskRecord) => void;
  onEditHabit: (habit: HabitRecord) => void;
}

type StatusFilter = GoalStatus | 'all';
type SortKey = 'deadline' | 'progress' | 'recent';

export const GOAL_COLOR_CLASSES: Record<
  CalendarColor,
  { bar: string; text: string; soft: string }
> = {
  blue: {
    bar: 'bg-[#1A73E8] dark:bg-[#8AB4F8]',
    text: 'text-[#1A73E8] dark:text-[#8AB4F8]',
    soft: 'bg-[#D3E3FD] dark:bg-[#004A77]',
  },
  green: {
    bar: 'bg-[#146C2E] dark:bg-[#81C995]',
    text: 'text-[#146C2E] dark:text-[#81C995]',
    soft: 'bg-[#C4EED0] dark:bg-[#0F5223]',
  },
  amber: {
    bar: 'bg-[#B06000] dark:bg-[#FDD663]',
    text: 'text-[#B06000] dark:text-[#FDD663]',
    soft: 'bg-[#FEF7E0] dark:bg-[#6B4E00]',
  },
  red: {
    bar: 'bg-[#C5221F] dark:bg-[#F28B82]',
    text: 'text-[#C5221F] dark:text-[#F28B82]',
    soft: 'bg-[#FCE8E6] dark:bg-[#8C1D18]',
  },
  purple: {
    bar: 'bg-[#6750A4] dark:bg-[#D0BCFF]',
    text: 'text-[#6750A4] dark:text-[#D0BCFF]',
    soft: 'bg-[#EADDFF] dark:bg-[#4F378B]',
  },
};

/** Compare actual progress with linear progress from creation to target date. */
export function getGoalPace(
  goal: GoalRecord,
  pct: number,
  todayISO = getTodayISO()
): { label: string; tone: 'good' | 'warn' | 'bad' | 'neutral' } | null {
  if (goal.status !== 'active' || !goal.targetDate) return null;
  const daysLeft = getDaysUntil(goal.targetDate, todayISO);
  if (daysLeft < 0) {
    return { label: `${Math.abs(daysLeft)}d past target`, tone: 'bad' };
  }
  const created = new Date(goal.createdAt || Date.now());
  const createdISO = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`;
  const totalDays = Math.max(1, getDaysUntil(goal.targetDate, createdISO));
  const elapsed = Math.min(totalDays, Math.max(0, totalDays - daysLeft));
  const expected = Math.round((elapsed / totalDays) * 100);
  const when = daysLeft === 0 ? 'due today' : `${daysLeft}d left`;
  if (pct >= 100) return { label: `Target reached · ${when}`, tone: 'good' };
  if (elapsed === 0) return { label: when, tone: 'neutral' };
  if (pct >= expected) return { label: `On track · ${when}`, tone: 'good' };
  if (pct >= expected - 15) return { label: `Slightly behind · ${when}`, tone: 'warn' };
  return { label: `Behind (${expected}% expected) · ${when}`, tone: 'bad' };
}

const PACE_TONE_CLASS = {
  good: 'text-[#146C2E] dark:text-[#81C995]',
  warn: 'text-[#B06000] dark:text-[#FDD663]',
  bad: 'text-[#C5221F] dark:text-[#F28B82]',
  neutral: 'text-[#5F6368] dark:text-[#9AA0A6]',
} as const;

export const GoalsView: React.FC<GoalsViewProps> = ({
  onNewGoal,
  onEditGoal,
  onNewTaskForGoal,
  onEditTask,
  onEditHabit,
}) => {
  const {
    goals,
    tasks,
    habits,
    setGoalStatus,
    adjustGoalValue,
    toggleGoalMilestone,
    toggleTaskCompleted,
  } = useVault();

  const todayISO = getTodayISO();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('deadline');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [logAmounts, setLogAmounts] = useState<Record<string, string>>({});

  const progressById = useMemo(() => {
    const map = new Map<string, GoalProgressSummary>();
    for (const g of goals) map.set(g.id, computeGoalProgress(g, tasks, habits));
    return map;
  }, [goals, tasks, habits]);

  const categories = useMemo(
    () => [...new Set(goals.map((g) => g.category))].sort(),
    [goals]
  );

  const counts = useMemo(() => {
    const c = { active: 0, paused: 0, completed: 0, all: goals.length };
    for (const g of goals) c[g.status]++;
    return c;
  }, [goals]);

  const activeGoals = goals.filter((g) => g.status === 'active');
  const avgProgress =
    activeGoals.length > 0
      ? Math.round(
          activeGoals.reduce(
            (sum, g) => sum + (progressById.get(g.id)?.pct ?? 0),
            0
          ) / activeGoals.length
        )
      : 0;
  const dueSoonCount = activeGoals.filter(
    (g) => g.targetDate && getDaysUntil(g.targetDate, todayISO) <= 30
  ).length;

  const visibleGoals = useMemo(() => {
    const list = goals.filter(
      (g) =>
        (statusFilter === 'all' || g.status === statusFilter) &&
        (categoryFilter === 'all' || g.category === categoryFilter)
    );
    return [...list].sort((a, b) => {
      if (sortKey === 'progress') {
        return (
          (progressById.get(b.id)?.pct ?? 0) - (progressById.get(a.id)?.pct ?? 0)
        );
      }
      if (sortKey === 'recent') return b.updatedAt - a.updatedAt;
      return (
        (a.targetDate || '9999').localeCompare(b.targetDate || '9999') ||
        a.createdAt - b.createdAt
      );
    });
  }, [goals, statusFilter, categoryFilter, sortKey, progressById]);

  const numericStep = (g: GoalRecord) => {
    const t = g.targetValue ?? 0;
    if (t >= 10000) return 100;
    if (t >= 1000) return 10;
    return 1;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1F1F1F] dark:text-[#E3E3E3]">
            {t('goals.title')}
          </h1>
          <p className="text-sm text-[#444746] dark:text-[#C4C7C5]">
            Long-term targets with milestones, numbers, and linked tasks & habits
          </p>
        </div>
        <button
          type="button"
          onClick={onNewGoal}
          className="self-start sm:self-auto min-h-[44px] px-5 rounded-full hub-bg-accent text-sm font-medium inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('goals.new')}
        </button>
      </div>

      {/* Stats */}
      <section
        aria-label="Goal summary"
        className="rounded-2xl border border-[#DADCE0] dark:border-[#3C4043] bg-[#E8EAED] dark:bg-[#3C4043] grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden"
      >
        {[
          { label: t('goals.active'), value: String(counts.active), icon: Target },
          { label: t('goals.avg'), value: `${avgProgress}%`, icon: Flag },
          { label: t('goals.due30'), value: String(dueSoonCount), icon: Flag },
          { label: t('goals.completed'), value: String(counts.completed), icon: Trophy },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white dark:bg-[#1E1F20] p-4 sm:p-5">
              <span className="text-xs text-[#5F6368] dark:text-[#9AA0A6] inline-flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                {s.label}
              </span>
              <p className="mt-1.5 text-xl sm:text-2xl font-semibold font-mono tabular-nums text-[#202124] dark:text-[#E8EAED]">
                {s.value}
              </p>
            </div>
          );
        })}
      </section>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Goal status"
          className="flex items-center gap-1 p-0.5 rounded-full bg-[#F1F3F4] dark:bg-[#282A2C] overflow-x-auto"
        >
          {(['active', 'paused', 'completed', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              className={`min-h-[34px] px-3.5 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-colors ${
                statusFilter === s
                  ? 'bg-white dark:bg-[#1E1F20] text-[#202124] dark:text-[#E8EAED] shadow-2xs'
                  : 'text-[#5F6368] dark:text-[#9AA0A6]'
              }`}
            >
              {s === 'all' ? t('common.all') : t(`goals.${s}`)} ({counts[s]})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {categories.length > 1 && (
            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="min-h-[36px] rounded-full border border-[#DADCE0] dark:border-[#3C4043] bg-white dark:bg-[#1E1F20] px-3 text-xs text-[#202124] dark:text-[#E8EAED]"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Sort goals"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="min-h-[36px] rounded-full border border-[#DADCE0] dark:border-[#3C4043] bg-white dark:bg-[#1E1F20] px-3 text-xs text-[#202124] dark:text-[#E8EAED]"
          >
            <option value="deadline">Sort: Target date</option>
            <option value="progress">Sort: Progress</option>
            <option value="recent">Sort: Recently updated</option>
          </select>
        </div>
      </div>

      {/* Goal cards */}
      {visibleGoals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#DADCE0] dark:border-[#3C4043] py-14 px-6 text-center space-y-3">
          <Target className="w-8 h-8 mx-auto text-[#5F6368] dark:text-[#9AA0A6]" />
          <p className="text-sm text-[#5F6368] dark:text-[#9AA0A6]">
            {goals.length === 0
              ? 'Set your first long-term goal — track it with a number, milestones, or linked tasks.'
              : 'No goals match this filter.'}
          </p>
          {goals.length === 0 ? (
            <button
              type="button"
              onClick={onNewGoal}
              className="min-h-[40px] px-4 rounded-full hub-bg-accent text-xs font-medium"
            >
              Create a goal
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setCategoryFilter('all');
              }}
              className="min-h-[40px] px-4 rounded-full text-xs font-medium hub-text-accent hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]"
            >
              Show all goals
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
          {visibleGoals.map((goal) => {
            const progress = progressById.get(goal.id)!;
            const colors = GOAL_COLOR_CLASSES[goal.color] ?? GOAL_COLOR_CLASSES.blue;
            const pace = getGoalPace(goal, progress.pct, todayISO);
            const linkedTasks = tasks.filter((t) => t.goalId === goal.id);
            const linkedHabits = habits.filter(
              (h) => !h.archived && h.goalId === goal.id
            );
            const milestones = goal.milestones ?? [];
            const isOpen = Boolean(expanded[goal.id]);
            const shownMilestones = isOpen ? milestones : milestones.slice(0, 4);
            const hasNumeric = Boolean(goal.targetValue && goal.targetValue > 0);
            const step = numericStep(goal);
            const isDone = goal.status === 'completed';

            return (
              <article
                key={goal.id}
                className={`rounded-2xl border border-[#DADCE0] dark:border-[#3C4043] bg-white dark:bg-[#1E1F20] overflow-hidden flex flex-col ${
                  goal.status === 'paused' ? 'opacity-75' : ''
                }`}
              >
                {goal.imageUrl ? (
                  <img
                    src={goal.imageUrl}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                    className="w-full h-28 object-cover"
                    style={{
                      objectPosition: `${goal.imageConfig?.posX ?? 50}% ${goal.imageConfig?.posY ?? 50}%`,
                    }}
                  />
                ) : (
                  <div className={`h-1.5 ${colors.bar}`} />
                )}

                <div className="p-4 sm:p-5 space-y-3.5 flex-1">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onEditGoal(goal)}
                      className="min-w-0 text-left group"
                    >
                      <h2
                        className={`text-base font-semibold text-[#202124] dark:text-[#E8EAED] group-hover:underline ${
                          isDone ? 'line-through decoration-1' : ''
                        }`}
                      >
                        {goal.title}
                      </h2>
                      <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mt-0.5">
                        <span className={colors.text}>●</span> {goal.category}
                        {goal.targetDate
                          ? ` · Target ${formatShortDate(goal.targetDate)}`
                          : ''}
                        {goal.status !== 'active' ? ` · ${goal.status}` : ''}
                      </p>
                    </button>
                    <span
                      className={`shrink-0 text-lg font-mono font-semibold tabular-nums ${colors.text}`}
                    >
                      {progress.pct}%
                    </span>
                  </div>

                  {goal.description && (
                    <p className="text-xs text-[#444746] dark:text-[#C4C7C5] line-clamp-2">
                      {goal.description}
                    </p>
                  )}

                  {/* Progress */}
                  <div className="space-y-1.5">
                    <div
                      role="progressbar"
                      aria-valuenow={progress.pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${goal.title} progress`}
                      className="h-2 rounded-full bg-[#E8EAED] dark:bg-[#282A2C] overflow-hidden"
                    >
                      <div
                        className={`h-full rounded-full transition-all ${colors.bar}`}
                        style={{ width: `${progress.pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-[#5F6368] dark:text-[#9AA0A6] truncate tabular-nums">
                        {progress.summaryLabel}
                      </span>
                      {pace && (
                        <span className={`shrink-0 font-medium ${PACE_TONE_CLASS[pace.tone]}`}>
                          {pace.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Numeric logging */}
                  {hasNumeric && !isDone && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void adjustGoalValue(goal.id, -step)}
                        aria-label={`Decrease by ${step}`}
                        className="min-h-[36px] min-w-[36px] rounded-full border border-[#DADCE0] dark:border-[#3C4043] flex items-center justify-center text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void adjustGoalValue(goal.id, step)}
                        aria-label={`Increase by ${step}`}
                        className={`min-h-[36px] px-3 rounded-full text-xs font-medium inline-flex items-center gap-1 ${colors.soft} text-[#202124] dark:text-[#E8EAED]`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {step}
                        {goal.unit ? ` ${goal.unit}` : ''}
                      </button>
                      <form
                        className="flex items-center gap-1.5 ml-auto"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const amt = parseFloat(logAmounts[goal.id] ?? '');
                          if (!Number.isFinite(amt) || amt === 0) return;
                          void adjustGoalValue(goal.id, amt);
                          setLogAmounts((p) => ({ ...p, [goal.id]: '' }));
                        }}
                      >
                        <input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          aria-label={`Log amount for ${goal.title}`}
                          placeholder="Amount"
                          value={logAmounts[goal.id] ?? ''}
                          onChange={(e) =>
                            setLogAmounts((p) => ({ ...p, [goal.id]: e.target.value }))
                          }
                          className="w-20 min-h-[36px] rounded-full border border-[#DADCE0] dark:border-[#3C4043] bg-transparent px-3 font-mono text-xs text-[#202124] dark:text-[#E8EAED]"
                        />
                        <button
                          type="submit"
                          className="min-h-[36px] px-3 rounded-full text-xs font-medium hub-text-accent hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]"
                        >
                          Log
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Milestones */}
                  {milestones.length > 0 && (
                    <ul className="space-y-0.5">
                      {shownMilestones.map((m) => {
                        const overdue =
                          !m.done && m.targetDate && m.targetDate < todayISO;
                        return (
                          <li key={m.id}>
                            <button
                              type="button"
                              disabled={isDone}
                              onClick={() => void toggleGoalMilestone(goal.id, m.id)}
                              className="w-full min-h-[34px] flex items-center gap-2.5 text-left rounded-lg px-1 -mx-1 hover:bg-[#F8F9FA] dark:hover:bg-[#282A2C] disabled:hover:bg-transparent"
                            >
                              <span
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                                  m.done
                                    ? `${colors.bar} border-transparent text-white dark:text-[#202124]`
                                    : 'border-[#5F6368] dark:border-[#9AA0A6]'
                                }`}
                              >
                                {m.done && <Check className="w-3 h-3" />}
                              </span>
                              <span
                                className={`flex-1 min-w-0 truncate text-sm ${
                                  m.done
                                    ? 'line-through text-[#5F6368] dark:text-[#9AA0A6]'
                                    : 'text-[#202124] dark:text-[#E8EAED]'
                                }`}
                              >
                                {m.title}
                              </span>
                              {m.targetDate && (
                                <span
                                  className={`text-[11px] font-mono shrink-0 ${
                                    overdue
                                      ? 'text-[#C5221F] dark:text-[#F28B82]'
                                      : 'text-[#5F6368] dark:text-[#9AA0A6]'
                                  }`}
                                >
                                  {formatShortDate(m.targetDate)}
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {/* Linked tasks & habits */}
                  {(linkedTasks.length > 0 || linkedHabits.length > 0) && (
                    <div className="pt-2 border-t border-[#F1F3F4] dark:border-[#282A2C] space-y-1">
                      <p className="text-[11px] font-medium text-[#5F6368] dark:text-[#9AA0A6]">
                        Linked: {progress.linkedTasksDone}/{linkedTasks.length} tasks
                        {linkedHabits.length > 0
                          ? ` · ${linkedHabits.length} habit${linkedHabits.length === 1 ? '' : 's'} (${progress.linkedHabitCheckins} check-ins)`
                          : ''}
                      </p>
                      {isOpen && (
                        <ul className="space-y-0.5">
                          {linkedTasks
                            .slice()
                            .sort((a, b) => Number(a.completed) - Number(b.completed))
                            .map((t) => (
                              <li key={t.id} className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void toggleTaskCompleted(t.id)}
                                  aria-label={
                                    t.completed
                                      ? `Mark ${t.title} not done`
                                      : `Complete ${t.title}`
                                  }
                                  className="min-h-[32px] min-w-[28px] flex items-center justify-center"
                                >
                                  {t.completed ? (
                                    <CheckCircle2 className="w-4 h-4 hub-text-accent" />
                                  ) : (
                                    <span className="w-4 h-4 rounded-full border-2 border-[#5F6368] dark:border-[#9AA0A6]" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onEditTask(t)}
                                  className={`flex-1 min-w-0 truncate text-left text-sm ${
                                    t.completed
                                      ? 'line-through text-[#5F6368] dark:text-[#9AA0A6]'
                                      : 'text-[#202124] dark:text-[#E8EAED]'
                                  }`}
                                >
                                  {t.title}
                                </button>
                                {t.dueDate && !t.completed && (
                                  <span className="text-[11px] font-mono text-[#5F6368] dark:text-[#9AA0A6] shrink-0">
                                    {formatShortDate(t.dueDate)}
                                  </span>
                                )}
                              </li>
                            ))}
                          {linkedHabits.map((h) => (
                            <li key={h.id}>
                              <button
                                type="button"
                                onClick={() => onEditHabit(h)}
                                className="w-full min-h-[32px] text-left text-sm text-[#202124] dark:text-[#E8EAED] truncate pl-9"
                              >
                                ↻ {h.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {(milestones.length > 4 ||
                    linkedTasks.length > 0 ||
                    linkedHabits.length > 0) && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((p) => ({ ...p, [goal.id]: !p[goal.id] }))
                      }
                      className="inline-flex items-center gap-1 text-xs font-medium hub-text-accent"
                    >
                      {isOpen ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" /> Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          {milestones.length > 4
                            ? `Show all (${milestones.length - 4} more milestones)`
                            : 'Show linked items'}
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div className="px-3 py-2 border-t border-[#E8EAED] dark:border-[#3C4043] flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    {!isDone && (
                      <button
                        type="button"
                        onClick={() => onNewTaskForGoal(goal.id)}
                        className="min-h-[36px] px-2.5 rounded-full text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C] inline-flex items-center gap-1.5"
                      >
                        <ListPlus className="w-3.5 h-3.5" />
                        {t('goals.addTask')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onEditGoal(goal)}
                      className="min-h-[36px] px-2.5 rounded-full text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C] inline-flex items-center gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    {goal.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => void setGoalStatus(goal.id, 'paused')}
                        aria-label={`Pause ${goal.title}`}
                        title="Pause"
                        className="min-h-[36px] min-w-[36px] rounded-full flex items-center justify-center text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    )}
                    {goal.status === 'paused' && (
                      <button
                        type="button"
                        onClick={() => void setGoalStatus(goal.id, 'active')}
                        className="min-h-[36px] px-3 rounded-full text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C] inline-flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5" />
                        {t('goals.resume')}
                      </button>
                    )}
                    {isDone ? (
                      <button
                        type="button"
                        onClick={() => void setGoalStatus(goal.id, 'active')}
                        className="min-h-[36px] px-3 rounded-full text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C] inline-flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {t('goals.reopen')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void setGoalStatus(goal.id, 'completed')}
                        className="min-h-[36px] px-3 rounded-full text-xs font-medium hub-bg-soft inline-flex items-center gap-1.5"
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        {t('goals.complete')}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
