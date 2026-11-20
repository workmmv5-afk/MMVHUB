import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, X } from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { t } from '../lib/i18n';
import {
  advanceDateByCycle,
  calculateHabitStreak,
  formatCurrency,
  getOffsetDateISO,
  getPurchaseEntryType,
  getTodayISO,
  isHabitScheduledOnDate,
} from '../lib/format';

type Range = 'week' | 'month' | 'year';

function rangeStart(range: Range, today: string): string {
  if (range === 'week') return getOffsetDateISO(-6, today);
  if (range === 'month') return `${today.slice(0, 7)}-01`;
  return `${today.slice(0, 4)}-01-01`;
}

/** Weekly / monthly / yearly review: money, habits, tasks, goals, merchants. */
export const ReviewSheet: React.FC<{ onClose: () => void; initialRange?: Range }> = ({
  onClose,
  initialRange = 'week',
}) => {
  const { purchases, habits, tasks, goals, preferences, subscriptions, updatePreferences } = useVault();
  const [editRates, setEditRates] = useState(false);
  const [range, setRange] = useState<Range>(initialRange);
  const today = getTodayISO();
  const from = rangeStart(range, today);
  const blur = preferences.privacyBlur ? 'hub-privacy-blur' : '';
  const cur = preferences.currency;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const data = useMemo(() => {
    const inRange = (d: string) => d >= from && d <= today;
    // Money
    let spent = 0;
    let income = 0;
    const byCat = new Map<string, number>();
    const byMerchant = new Map<string, { total: number; count: number }>();
    const byMonth = new Map<string, number>();
    for (const p of purchases) {
      if (!inRange(p.date)) continue;
      const t = getPurchaseEntryType(p);
      if (t === 'income') {
        income += p.amount;
        continue;
      }
      const amt = t === 'refund' ? -p.amount : p.amount;
      spent += amt;
      byCat.set(p.category, (byCat.get(p.category) ?? 0) + amt);
      byMonth.set(p.date.slice(0, 7), (byMonth.get(p.date.slice(0, 7)) ?? 0) + amt);
      if (t === 'expense') {
        const key = p.title.trim().toLowerCase().replace(/\s*\(.*\)$/, '');
        const m = byMerchant.get(key) ?? { total: 0, count: 0 };
        m.total += p.amount;
        m.count++;
        byMerchant.set(key, m);
      }
    }
    const merchants = [...byMerchant.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    const categories = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topMonth = [...byMonth.entries()].sort((a, b) => b[1] - a[1])[0];

    // Habits: scheduled vs done in range
    let scheduled = 0;
    let done = 0;
    const days: string[] = [];
    for (let d = from; d <= today; d = getOffsetDateISO(1, d)) days.push(d);
    for (const h of habits) {
      if (h.archived) continue;
      for (const d of days) {
        if (!isHabitScheduledOnDate(h, d)) continue;
        scheduled++;
        if ((h.logs[d] ?? 0) >= h.targetPerDay) done++;
      }
    }
    const best = habits
      .filter((h) => !h.archived)
      .map((h) => ({ name: h.name, ...calculateHabitStreak(h.logs, h.targetPerDay, h) }))
      .sort((a, b) => b.best - a.best)[0];

    // Tasks & goals
    const fromMs = new Date(`${from}T00:00:00`).getTime();
    const tasksDone = tasks.filter((t) => t.completed && (t.completedAt ?? 0) >= fromMs).length;
    const focusMin = tasks.reduce((s, t) => s + (t.focusedMinutes ?? 0), 0);
    const goalsDone = goals.filter((g) => g.status === 'completed' && g.updatedAt >= fromMs).length;

    const budget =
      range === 'month' ? preferences.monthlyBudget : range === 'year' ? preferences.monthlyBudget * 12 : 0;

    // Estimated card rewards for the range
    const rates = preferences.rewardRates ?? {};
    let rewards = 0;
    for (const p of purchases) {
      if (!inRange(p.date) || getPurchaseEntryType(p) !== 'expense') continue;
      rewards += (p.amount * (rates[p.paymentMethod] ?? 0)) / 100;
    }

    // Renewal forecast: next 12 months
    const forecast: { key: string; label: string; total: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 + i, 1);
      forecast.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('en-US', { month: 'narrow' }),
        total: 0,
      });
    }
    const horizon = forecast[11].key;
    for (const sub of subscriptions) {
      if (!sub.active) continue;
      let next = sub.nextBillingDate;
      for (let guard = 0; guard < 60 && next.slice(0, 7) <= horizon; guard++) {
        const slot = forecast.find((f) => f.key === next.slice(0, 7));
        if (slot) slot.total += sub.amount;
        next = advanceDateByCycle(next, sub.billingCycle);
      }
    }

    return {
      spent,
      income,
      net: income - spent,
      categories,
      merchants,
      topMonth,
      habitPct: scheduled > 0 ? Math.round((done / scheduled) * 100) : null,
      habitDone: done,
      best,
      tasksDone,
      focusMin,
      goalsDone,
      budget,
      rewards,
      forecast,
    };
  }, [purchases, habits, tasks, goals, subscriptions, from, today, range, preferences.monthlyBudget, preferences.rewardRates]);

  const stat = (label: string, value: React.ReactNode, sub?: string) => (
    <div className="rounded-2xl bg-[#F8F9FA] dark:bg-[#131314] p-3">
      <p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">{label}</p>
      <p className="text-lg font-semibold font-mono tabular-nums mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6] truncate">{sub}</p>}
    </div>
  );

  const maxCat = Math.max(1, ...data.categories.map(([, v]) => v));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Review"
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#1E1F20] p-5 space-y-4 pb-safe"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold inline-flex items-center gap-2">
            <BarChart3 className="w-4 h-4 hub-text-accent" />
            {t('review.title')}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="min-h-[36px] min-w-[36px] rounded-full flex items-center justify-center hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 p-1 rounded-full bg-[#F1F3F4] dark:bg-[#282A2C]">
          {(['week', 'month', 'year'] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={`min-h-[32px] rounded-full text-xs font-semibold capitalize ${
                range === r ? 'bg-white dark:bg-[#1E1F20] shadow-2xs' : 'text-[#5F6368] dark:text-[#9AA0A6]'
              }`}
            >
              {t(`review.${r}`)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {stat(
            t('review.spent'),
            <span className={blur}>{formatCurrency(data.spent, cur)}</span>,
            data.budget > 0 ? `${Math.round((data.spent / data.budget) * 100)}% of budget` : undefined
          )}
          {stat(t('review.net'), <span className={`${blur} ${data.net >= 0 ? 'text-[#146C2E] dark:text-[#81C995]' : ''}`}>{formatCurrency(data.net, cur)}</span>, data.income > 0 ? `${formatCurrency(data.income, cur)} in` : undefined)}
          {stat(t('review.habits'), data.habitPct === null ? '—' : `${data.habitPct}%`, `${data.habitDone} check-ins`)}
          {stat(t('review.tasksDone'), data.tasksDone, data.goalsDone ? `${data.goalsDone} goal${data.goalsDone === 1 ? '' : 's'} completed` : undefined)}
        </div>

        {data.best && data.best.best > 0 && (
          <p className="text-xs text-[#444746] dark:text-[#C4C7C5]">
            🔥 Longest streak: <b>{data.best.name}</b> · {data.best.best} days
            {range === 'year' && data.topMonth ? ` · Top spending month: ${new Date(`${data.topMonth[0]}-01`).toLocaleDateString('en-US', { month: 'long' })}` : ''}
          </p>
        )}

        {data.categories.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-[#5F6368] dark:text-[#9AA0A6]">Top categories</p>
            {data.categories.map(([cat, v]) => (
              <div key={cat} className="grid grid-cols-[100px_1fr_auto] items-center gap-2 text-xs">
                <span className="truncate">{cat}</span>
                <span className="h-1.5 rounded-full bg-[#E8EAED] dark:bg-[#282A2C] overflow-hidden">
                  <span className="block h-full hub-bg-accent rounded-full" style={{ width: `${(Math.max(0, v) / maxCat) * 100}%` }} />
                </span>
                <span className={`font-mono tabular-nums text-[11px] ${blur}`}>{formatCurrency(v, cur)}</span>
              </div>
            ))}
          </div>
        )}

        {data.merchants.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-[#5F6368] dark:text-[#9AA0A6]">Top merchants</p>
            {data.merchants.map((m, i) => (
              <div key={m.name} className="flex items-center justify-between text-xs gap-2">
                <span className="truncate capitalize">
                  <span className="text-[#5F6368] dark:text-[#9AA0A6] font-mono mr-1.5">{i + 1}</span>
                  {m.name}
                </span>
                <span className="font-mono tabular-nums text-[11px] text-[#5F6368] dark:text-[#9AA0A6] shrink-0">
                  {m.count}× · <span className={blur}>{formatCurrency(m.total, cur)}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {data.forecast.some((f) => f.total > 0) && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-[#5F6368] dark:text-[#9AA0A6]">Renewals · next 12 months</p>
            <div className="flex items-end gap-1 h-16">
              {data.forecast.map((f) => {
                const max = Math.max(...data.forecast.map((x) => x.total), 1);
                return (
                  <div key={f.key} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end" title={`${f.key}: ${formatCurrency(f.total, cur)}`}>
                    <div
                      className={`w-full rounded-t ${f.total >= max * 0.75 ? 'bg-[#E37400]' : 'hub-bg-accent'}`}
                      style={{ height: `${Math.max(3, (f.total / max) * 100)}%`, opacity: f.total ? 1 : 0.2 }}
                    />
                    <span className="text-[9px] text-[#5F6368] dark:text-[#9AA0A6]">{f.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 text-xs">
          <span>
            Est. card rewards:{' '}
            <b className={blur}>{formatCurrency(data.rewards, cur)}</b>
          </span>
          <button type="button" onClick={() => setEditRates((v) => !v)} className="text-[11px] hub-text-accent">
            {editRates ? 'Done' : 'Set rates'}
          </button>
        </div>
        {editRates && (
          <div className="grid grid-cols-2 gap-2">
            {(['Card', 'Digital Wallet', 'Bank Transfer', 'Cash'] as const).map((m) => (
              <label key={m} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">{m}</span>
                <span className="inline-flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={0.1}
                    defaultValue={preferences.rewardRates?.[m] ?? ''}
                    onBlur={(e) =>
                      void updatePreferences((prev) => ({
                        rewardRates: { ...prev.rewardRates, [m]: Math.max(0, Math.min(20, parseFloat(e.target.value) || 0)) },
                      }))
                    }
                    className="w-14 min-h-[32px] rounded-lg border border-[#DADCE0] dark:border-[#444746] bg-transparent px-2 text-right font-mono"
                  />
                  %
                </span>
              </label>
            ))}
          </div>
        )}

        {data.focusMin > 0 && (
          <p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
            Total focus logged on tasks: {Math.floor(data.focusMin / 60)}h {data.focusMin % 60}m
          </p>
        )}
      </div>
    </div>
  );
};
