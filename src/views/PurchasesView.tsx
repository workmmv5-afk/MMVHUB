import React, { useEffect, useMemo, useState } from 'react';
import { tx } from '../lib/i18n';
import {
  ArrowDownLeft,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Pause,
  Pencil,
  Play,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useVault } from '../context/VaultContext';
import type {
  PaymentMethod,
  PurchaseCategory,
  PurchaseRecord,
  SubscriptionRecord,
} from '../types';
import {
  formatCurrency,
  formatMonthLabel,
  formatShortDate,
  getDaysUntil,
  getMonthKey,
  getMonthlyEquivalent,
  getOffsetDateISO,
  getPurchaseEntryType,
  getTodayISO,
  shiftMonthKey,
} from '../lib/format';

interface PurchasesViewProps {
  initialSubTab?: SubViewTab;
  subTabSignal?: number;
  onNewPurchase: () => void;
  onEditPurchase: (purchase: PurchaseRecord) => void;
  onNewSubscription: () => void;
  onEditSubscription: (sub: SubscriptionRecord) => void;
  onOpenCalendar?: () => void;
}

const CATEGORIES: ('All' | PurchaseCategory)[] = [
  'All',
  'Groceries',
  'Food & Dining',
  'Transport',
  'Utilities',
  'Tech & Gear',
  'Health',
  'Home',
  'Other',
];

const PAYMENTS: ('All' | PaymentMethod)[] = [
  'All',
  'Card',
  'Digital Wallet',
  'Bank Transfer',
  'Cash',
];

type SortMode = 'newest' | 'highest' | 'title';
type SubViewTab = 'purchases' | 'subscriptions';
type TimeScope = 'month' | '30d' | 'ytd' | 'all';
type StatusFilter = 'all' | 'refunds' | 'income' | 'reimbursable' | 'pending';
type BreakdownMode = 'category' | 'payment' | 'merchant';
type SubFilterMode = 'all' | 'active' | 'trials' | 'dueSoon' | 'underused' | 'paused';
type SubSortMode = 'renewal' | 'cost' | 'name';

function signedSpend(p: PurchaseRecord): number {
  const t = getPurchaseEntryType(p);
  if (t === 'income') return 0;
  return t === 'refund' ? -p.amount : p.amount;
}

function formatDateGroupHeader(dateISO: string, todayISO: string): string {
  if (dateISO === todayISO) return 'Today';
  if (dateISO === getOffsetDateISO(-1, todayISO)) return 'Yesterday';
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  initialSubTab = 'purchases',
  subTabSignal = 0,
  onNewPurchase,
  onEditPurchase,
  onNewSubscription,
  onEditSubscription,
  onOpenCalendar,
}) => {
  const {
    purchases,
    subscriptions,
    preferences,
    togglePurchaseReimbursed,
    logSubscriptionPayment,
    toggleSubscriptionActive,
  } = useVault();

  const todayISO = getTodayISO();
  const currentMonthKey = getMonthKey(todayISO);

  const [subTab, setSubTab] = useState<SubViewTab>(initialSubTab);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab, subTabSignal]);
  const [timeScope, setTimeScope] = useState<TimeScope>('month');
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [categoryFilter, setCategoryFilter] = useState<
    'All' | PurchaseCategory
  >('All');
  const [paymentFilter, setPaymentFilter] = useState<'All' | PaymentMethod>(
    'All'
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [tagFilter, setTagFilter] = useState<string>('All');
  const [breakdownMode, setBreakdownMode] = useState<BreakdownMode>('category');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [search, setSearch] = useState('');

  // Subscriptions tab state
  const [subSearch, setSubSearch] = useState('');
  const [subFilter, setSubFilter] = useState<SubFilterMode>('all');
  const [subSort, setSubSort] = useState<SubSortMode>('renewal');

  // Purchases scoped by time window
  const scopedPurchases = useMemo(() => {
    if (timeScope === 'month') {
      return purchases.filter((p) => getMonthKey(p.date) === selectedMonth);
    }
    if (timeScope === '30d') {
      const cutoff = getOffsetDateISO(-29, todayISO);
      return purchases.filter((p) => p.date >= cutoff && p.date <= todayISO);
    }
    if (timeScope === 'ytd') {
      const yearPrefix = `${todayISO.slice(0, 4)}-`;
      return purchases.filter((p) => p.date.startsWith(yearPrefix));
    }
    return purchases;
  }, [purchases, timeScope, selectedMonth, todayISO]);

  // Previous month purchases for Month-over-Month delta
  const prevMonthKey = useMemo(
    () => shiftMonthKey(selectedMonth, -1),
    [selectedMonth]
  );

  const prevMonthNet = useMemo(() => {
    return purchases
      .filter((p) => getMonthKey(p.date) === prevMonthKey)
      .reduce((sum, p) => sum + signedSpend(p), 0);
  }, [purchases, prevMonthKey]);

  const prevMonthHasEntries = useMemo(
    () => purchases.some((p) => getMonthKey(p.date) === prevMonthKey),
    [purchases, prevMonthKey]
  );

  const blurClass = preferences.privacyBlur ? 'hub-privacy-blur' : '';

  // Financial aggregates for scoped purchases
  const purchaseStats = useMemo(() => {
    let grossExpense = 0;
    let totalRefunds = 0;
    let totalIncome = 0;
    let expenseCount = 0;
    let recurringExpense = 0;
    let pendingReimburseTotal = 0;
    let pendingReimburseCount = 0;

    for (const p of scopedPurchases) {
      const entryType = getPurchaseEntryType(p);
      if (entryType === 'income') {
        totalIncome += p.amount;
      } else if (entryType === 'refund') {
        totalRefunds += p.amount;
      } else {
        grossExpense += p.amount;
        expenseCount += 1;
        if (p.recurring) recurringExpense += p.amount;
        if (p.reimbursable && !p.reimbursed) {
          pendingReimburseTotal += p.amount;
          pendingReimburseCount += 1;
        }
      }
    }

    const netSpend = grossExpense - totalRefunds;
    const netCashflow = totalIncome - netSpend;
    const avgTicket = expenseCount > 0 ? grossExpense / expenseCount : 0;
    const recurringSharePct =
      grossExpense > 0
        ? Math.round((recurringExpense / grossExpense) * 100)
        : 0;

    // Month-over-month delta (when in Month scope & prev month exists)
    const momDeltaPct =
      timeScope === 'month' && prevMonthHasEntries && prevMonthNet > 0
        ? Math.round(((netSpend - prevMonthNet) / prevMonthNet) * 100)
        : null;

    // Daily pace & end-of-month projection (current month)
    let dailyPace = 0;
    let projectedMonthEnd: number | null = null;
    if (timeScope === 'month') {
      const [yStr, mStr] = selectedMonth.split('-');
      const daysInMonth = new Date(Number(yStr), Number(mStr), 0).getDate();
      if (selectedMonth === currentMonthKey) {
        const dayOfMonth = Math.max(1, Number(todayISO.slice(8, 10)));
        dailyPace = netSpend / dayOfMonth;
        projectedMonthEnd = dailyPace * daysInMonth;
      } else {
        dailyPace = netSpend / daysInMonth;
      }
    } else if (timeScope === '30d') {
      dailyPace = netSpend / 30;
    }

    return {
      grossExpense,
      totalRefunds,
      totalIncome,
      netSpend,
      netCashflow,
      expenseCount,
      avgTicket,
      recurringExpense,
      recurringSharePct,
      pendingReimburseTotal,
      pendingReimburseCount,
      momDeltaPct,
      dailyPace,
      projectedMonthEnd,
    };
  }, [
    scopedPurchases,
    timeScope,
    prevMonthHasEntries,
    prevMonthNet,
    selectedMonth,
    currentMonthKey,
    todayISO,
  ]);

  // Activity sparkline bars (daily for Month / 30d; monthly for YTD / All)
  const timelineBars = useMemo(() => {
    if (timeScope === 'month') {
      const [yStr, mStr] = selectedMonth.split('-');
      const daysInMonth = new Date(Number(yStr), Number(mStr), 0).getDate();
      const totals = new Array<number>(daysInMonth).fill(0);
      for (const p of scopedPurchases) {
        if (getPurchaseEntryType(p) !== 'expense') continue;
        const dayNum = parseInt(p.date.slice(8, 10), 10);
        if (dayNum >= 1 && dayNum <= daysInMonth) {
          totals[dayNum - 1] += p.amount;
        }
      }
      const maxVal = Math.max(...totals, 1);
      return totals.map((val, idx) => ({
        key: `d-${idx + 1}`,
        label: `Day ${idx + 1}`,
        amount: val,
        heightPct: Math.round((val / maxVal) * 100),
      }));
    }

    if (timeScope === '30d') {
      const totals = new Array<number>(30).fill(0);
      const dates: string[] = [];
      for (let i = 29; i >= 0; i--) {
        dates.push(getOffsetDateISO(-i, todayISO));
      }
      const indexByDate = new Map(dates.map((d, i) => [d, i]));
      for (const p of scopedPurchases) {
        if (getPurchaseEntryType(p) !== 'expense') continue;
        const idx = indexByDate.get(p.date);
        if (idx !== undefined) totals[idx] += p.amount;
      }
      const maxVal = Math.max(...totals, 1);
      return totals.map((val, idx) => ({
        key: dates[idx],
        label: formatShortDate(dates[idx]),
        amount: val,
        heightPct: Math.round((val / maxVal) * 100),
      }));
    }

    // YTD or All Time: monthly buckets (last 12 months)
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      months.push(shiftMonthKey(currentMonthKey, -i));
    }
    const totals = new Map<string, number>();
    for (const p of scopedPurchases) {
      if (getPurchaseEntryType(p) !== 'expense') continue;
      const mk = getMonthKey(p.date);
      totals.set(mk, (totals.get(mk) ?? 0) + p.amount);
    }
    const vals = months.map((mk) => totals.get(mk) ?? 0);
    const maxVal = Math.max(...vals, 1);
    return months.map((mk, i) => ({
      key: mk,
      label: formatMonthLabel(mk),
      amount: vals[i],
      heightPct: Math.round((vals[i] / maxVal) * 100),
    }));
  }, [scopedPurchases, timeScope, selectedMonth, todayISO, currentMonthKey]);

  const categoryBreakdown = useMemo(() => {
    const totals = new Map<PurchaseCategory, number>();
    for (const p of scopedPurchases) {
      const spend = signedSpend(p);
      if (spend === 0) continue;
      totals.set(p.category, (totals.get(p.category) ?? 0) + spend);
    }
    return Array.from(totals.entries())
      .map(([category, total]) => ({ category, total }))
      .filter((x) => x.total !== 0)
      .sort((a, b) => b.total - a.total);
  }, [scopedPurchases]);

  const paymentBreakdown = useMemo(() => {
    const totals = new Map<PaymentMethod, number>();
    for (const p of scopedPurchases) {
      const spend = signedSpend(p);
      if (spend === 0) continue;
      totals.set(p.paymentMethod, (totals.get(p.paymentMethod) ?? 0) + spend);
    }
    return Array.from(totals.entries())
      .map(([method, total]) => ({ method, total }))
      .filter((x) => x.total !== 0)
      .sort((a, b) => b.total - a.total);
  }, [scopedPurchases]);

  const merchantBreakdown = useMemo(() => {
    const totals = new Map<
      string,
      { name: string; total: number; count: number }
    >();
    for (const p of scopedPurchases) {
      if (getPurchaseEntryType(p) !== 'expense') continue;
      const key = p.title.trim().toLowerCase();
      if (!key) continue;
      const prev = totals.get(key);
      if (prev) {
        prev.total += p.amount;
        prev.count += 1;
      } else {
        totals.set(key, { name: p.title.trim(), total: p.amount, count: 1 });
      }
    }
    return Array.from(totals.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [scopedPurchases]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const p of scopedPurchases) {
      for (const t of p.tags ?? []) {
        if (t.trim()) set.add(t.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scopedPurchases]);

  const filteredPurchases = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = scopedPurchases.filter((p) => {
      const entryType = getPurchaseEntryType(p);
      if (categoryFilter !== 'All' && p.category !== categoryFilter) {
        return false;
      }
      if (paymentFilter !== 'All' && p.paymentMethod !== paymentFilter) {
        return false;
      }
      if (statusFilter === 'refunds' && entryType !== 'refund') return false;
      if (statusFilter === 'income' && entryType !== 'income') return false;
      if (statusFilter === 'reimbursable' && !p.reimbursable) return false;
      if (
        statusFilter === 'pending' &&
        !(p.reimbursable && !p.reimbursed && entryType === 'expense')
      ) {
        return false;
      }
      if (
        tagFilter !== 'All' &&
        !(p.tags ?? []).some(
          (t) => t.toLowerCase() === tagFilter.toLowerCase()
        )
      ) {
        return false;
      }
      if (
        q &&
        !p.title.toLowerCase().includes(q) &&
        !p.category.toLowerCase().includes(q) &&
        !(p.notes ?? '').toLowerCase().includes(q) &&
        !(p.tags ?? []).some((t) => t.toLowerCase().includes(q))
      ) {
        return false;
      }
      return true;
    });

    if (sortMode === 'highest') {
      return [...list].sort((a, b) => b.amount - a.amount);
    }
    if (sortMode === 'title') {
      return [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    return [...list].sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt
    );
  }, [
    scopedPurchases,
    categoryFilter,
    paymentFilter,
    statusFilter,
    tagFilter,
    sortMode,
    search,
  ]);

  // Date-grouped ledger for 'newest' sort (Google Wallet style)
  const dateGroups = useMemo(() => {
    if (sortMode !== 'newest') return [];
    const groups: {
      date: string;
      label: string;
      items: PurchaseRecord[];
      netTotal: number;
    }[] = [];
    const byDate = new Map<string, PurchaseRecord[]>();
    for (const p of filteredPurchases) {
      const arr = byDate.get(p.date);
      if (arr) {
        arr.push(p);
      } else {
        byDate.set(p.date, [p]);
      }
    }
    for (const [date, items] of byDate.entries()) {
      groups.push({
        date,
        label: formatDateGroupHeader(date, todayISO),
        items,
        netTotal: items.reduce((s, item) => s + signedSpend(item), 0),
      });
    }
    return groups;
  }, [filteredPurchases, sortMode, todayISO]);

  const hasActiveFilters =
    categoryFilter !== 'All' ||
    paymentFilter !== 'All' ||
    statusFilter !== 'all' ||
    tagFilter !== 'All' ||
    search.trim() !== '';

  const clearPurchaseFilters = () => {
    setCategoryFilter('All');
    setPaymentFilter('All');
    setStatusFilter('all');
    setTagFilter('All');
    setSearch('');
  };

  // Subscription analytics
  const subscriptionMetrics = useMemo(() => {
    const activeSubs = subscriptions.filter((s) => s.active);
    const pausedSubs = subscriptions.filter((s) => !s.active);

    const monthlyNormalized = activeSubs.reduce(
      (sum, s) => sum + getMonthlyEquivalent(s.amount, s.billingCycle),
      0
    );
    const pausedMonthlySavings = pausedSubs.reduce(
      (sum, s) => sum + getMonthlyEquivalent(s.amount, s.billingCycle),
      0
    );
    const annualized = monthlyNormalized * 12;

    // Next 30 days cashflow forecast + due count
    let next30DaysTotal = 0;
    let next30DaysCount = 0;
    let alertDueCount = 0;
    let trialCount = 0;
    let underusedCount = 0;

    for (const s of activeSubs) {
      const days = getDaysUntil(s.nextBillingDate, todayISO);
      const alertWindow = s.reminderDays ?? 3;
      if (days <= alertWindow) {
        alertDueCount += 1;
      }
      if (s.isTrial) {
        trialCount += 1;
      }
      if (s.usageStatus === 'underused') {
        underusedCount += 1;
      }
      if (days >= 0 && days <= 30) {
        next30DaysTotal += s.amount;
        next30DaysCount += 1;
      } else if (days < 0) {
        next30DaysTotal += s.amount;
        next30DaysCount += 1;
      }
    }

    const catTotals = new Map<PurchaseCategory, number>();
    for (const s of activeSubs) {
      const eq = getMonthlyEquivalent(s.amount, s.billingCycle);
      catTotals.set(s.category, (catTotals.get(s.category) ?? 0) + eq);
    }
    const categoryShares = Array.from(catTotals.entries())
      .map(([category, monthly]) => ({ category, monthly }))
      .sort((a, b) => b.monthly - a.monthly);

    return {
      activeCount: activeSubs.length,
      pausedCount: pausedSubs.length,
      monthlyNormalized,
      pausedMonthlySavings,
      annualized,
      next30DaysTotal,
      next30DaysCount,
      alertDueCount,
      trialCount,
      underusedCount,
      categoryShares,
    };
  }, [subscriptions, todayISO]);

  const filteredSubscriptions = useMemo(() => {
    const q = subSearch.trim().toLowerCase();
    const list = subscriptions.filter((s) => {
      if (subFilter === 'active' && !s.active) return false;
      if (subFilter === 'paused' && s.active) return false;
      if (subFilter === 'trials' && (!s.active || !s.isTrial)) return false;
      if (subFilter === 'underused' && (!s.active || s.usageStatus !== 'underused')) {
        return false;
      }
      if (subFilter === 'dueSoon') {
        const days = getDaysUntil(s.nextBillingDate, todayISO);
        if (!s.active || days > (s.reminderDays ?? 3)) return false;
      }
      if (
        q &&
        !s.name.toLowerCase().includes(q) &&
        !s.category.toLowerCase().includes(q) &&
        !(s.notes ?? '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    if (subSort === 'cost') {
      return [...list].sort(
        (a, b) =>
          getMonthlyEquivalent(b.amount, b.billingCycle) -
          getMonthlyEquivalent(a.amount, a.billingCycle)
      );
    }
    if (subSort === 'name') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return [...list].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.nextBillingDate.localeCompare(b.nextBillingDate);
    });
  }, [subscriptions, subFilter, subSearch, subSort, todayISO]);

  const budgetRemaining =
    preferences.monthlyBudget - purchaseStats.netSpend;
  const budgetPct =
    preferences.monthlyBudget > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round((purchaseStats.netSpend / preferences.monthlyBudget) * 100)
          )
        )
      : 0;

  const scopeLabel =
    timeScope === 'month'
      ? formatMonthLabel(selectedMonth)
      : timeScope === '30d'
        ? 'Last 30 days'
        : timeScope === 'ytd'
          ? `${todayISO.slice(0, 4)} Year-to-Date`
          : 'All time';

  const exportCsv = () => {
    const headers = [
      'Date',
      'Type',
      'Title',
      'Category',
      'Payment',
      'Amount',
      'Recurring',
      'Reimbursable',
      'Reimbursed',
      'Tags',
      'Notes',
    ];
    const rows = filteredPurchases.map((p) => {
      const entryType = getPurchaseEntryType(p);
      return [
        p.date,
        entryType === 'income'
          ? 'Income'
          : entryType === 'refund'
            ? 'Refund'
            : 'Expense',
        `"${p.title.replace(/"/g, '""')}"`,
        p.category,
        p.paymentMethod,
        (entryType === 'income' ? p.amount : signedSpend(p)).toFixed(2),
        p.recurring ? 'Yes' : 'No',
        p.reimbursable ? 'Yes' : 'No',
        p.reimbursed ? 'Yes' : 'No',
        `"${(p.tags ?? []).join(', ').replace(/"/g, '""')}"`,
        `"${(p.notes || '').replace(/"/g, '""')}"`,
      ];
    });
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = timeScope === 'month' ? selectedMonth : timeScope;
    a.download = `mmv-hub-purchases-${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderPurchaseRow = (p: PurchaseRecord, showDateInSubline: boolean) => {
    const entryType = getPurchaseEntryType(p);
    const isCredit = entryType === 'refund' || entryType === 'income';
    const isPendingReimburse = Boolean(
      p.reimbursable && !p.reimbursed && entryType === 'expense'
    );
    const isCompletedReimburse = Boolean(
      p.reimbursable && p.reimbursed && entryType === 'expense'
    );

    return (
      <div
        key={p.id}
        className="px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] transition-colors min-h-[60px]"
      >
        <button
          type="button"
          onClick={() => onEditPurchase(p)}
          className="min-w-0 flex-1 text-left space-y-0.5"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-[#1F1F1F] dark:text-[#E3E3E3] truncate">
              {p.title}
            </span>
            {entryType === 'refund' && (
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-[#146C2E] dark:text-[#6DD58C] shrink-0">
                <ArrowDownLeft className="w-3 h-3" />
                <span>Refund</span>
              </span>
            )}
            {entryType === 'income' && (
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-[#146C2E] dark:text-[#6DD58C] shrink-0">
                <ArrowDownLeft className="w-3 h-3" />
                <span>Income</span>
              </span>
            )}
            {p.recurring && entryType === 'expense' && (
              <span className="text-xs text-[#0B57D0] dark:text-[#A8C7FA] shrink-0">
                · Recurring
              </span>
            )}
            {isPendingReimburse && (
              <span className="text-xs font-medium text-[#B06000] dark:text-[#FCD663] shrink-0">
                · Awaiting payback
              </span>
            )}
            {isCompletedReimburse && (
              <span className="text-xs font-medium text-[#146C2E] dark:text-[#6DD58C] shrink-0">
                · Reimbursed
              </span>
            )}
          </div>
          <p className="text-xs text-[#444746] dark:text-[#C4C7C5] truncate">
            {showDateInSubline ? `${formatShortDate(p.date)} · ` : ''}
            {p.category} · {p.paymentMethod}
            {p.returnByDate && entryType === 'expense' ? (
              <span
                className={
                  p.returnByDate <= todayISO
                    ? ' text-[#B3261E] dark:text-[#F2B8B5] font-medium'
                    : ''
                }
              >
                {' '}
                · Return by {formatShortDate(p.returnByDate)}
              </span>
            ) : null}
            {p.tags && p.tags.length > 0
              ? ` · ${p.tags.map((t) => `#${t}`).join(' ')}`
              : ''}
            {p.notes ? ` · ${p.notes}` : ''}
          </p>
        </button>

        <div className="flex items-center gap-2.5 shrink-0">
          {p.reimbursable && entryType === 'expense' && (
            <button
              type="button"
              onClick={() => void togglePurchaseReimbursed(p.id)}
              title={
                p.reimbursed
                  ? 'Mark as awaiting reimbursement'
                  : 'Mark as reimbursed'
              }
              className={`min-h-[34px] px-3 rounded-full text-xs font-medium inline-flex items-center gap-1 border transition-colors ${
                p.reimbursed
                  ? 'border-[#C4EED0] dark:border-[#146C2E] text-[#146C2E] dark:text-[#6DD58C] hover:bg-[#E6F4EA] dark:hover:bg-[#0F5223]/40'
                  : 'border-[#DADCE0] dark:border-[#444746] text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {p.reimbursed ? 'Paid back' : 'Mark paid'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onEditPurchase(p)}
            className={`text-sm sm:text-base font-mono font-semibold tabular-nums ${blurClass} ${
              isCredit
                ? 'text-[#146C2E] dark:text-[#6DD58C]'
                : 'text-[#1F1F1F] dark:text-[#E3E3E3]'
            }`}
          >
            {isCredit
              ? `+${formatCurrency(p.amount, preferences.currency)}`
              : formatCurrency(p.amount, preferences.currency)}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Minimal Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-[#1F1F1F] dark:text-[#E3E3E3] truncate">
            {subTab === 'purchases' ? 'Purchases' : 'Subscriptions'}
          </h1>

          <div className="flex items-center gap-2 shrink-0">
            {subTab === 'subscriptions' && onOpenCalendar && (
              <button
                type="button"
                onClick={onOpenCalendar}
                className="min-h-[36px] px-3 rounded-lg text-xs font-medium text-[#444746] dark:text-[#C4C7C5] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C] inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Calendar</span>
              </button>
            )}
            <button
              type="button"
              onClick={subTab === 'purchases' ? onNewPurchase : onNewSubscription}
              className="min-h-[36px] px-3.5 rounded-full hub-bg-accent text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{subTab === 'purchases' ? 'Log Purchase' : 'Add Plan'}</span>
            </button>
          </div>
        </div>

        {/* Clean Underline Tabs + Inline Scope Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E8EAED] dark:border-[#3C4043]">
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setSubTab('purchases')}
              className={`pb-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
                subTab === 'purchases'
                  ? 'hub-border-accent hub-text-accent'
                  : 'border-transparent text-[#5F6368] dark:text-[#9AA0A6] hover:text-[#202124] dark:hover:text-[#E8EAED]'
              }`}
            >
              <span>Purchases</span>
              <span className="font-mono tabular-nums text-[11px] opacity-75">
                {scopedPurchases.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('subscriptions')}
              className={`pb-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
                subTab === 'subscriptions'
                  ? 'hub-border-accent hub-text-accent'
                  : 'border-transparent text-[#5F6368] dark:text-[#9AA0A6] hover:text-[#202124] dark:hover:text-[#E8EAED]'
              }`}
            >
              <span>Subscriptions</span>
              <span className="font-mono tabular-nums text-[11px] opacity-75">
                {subscriptionMetrics.activeCount}
              </span>
            </button>
          </div>

          {subTab === 'purchases' && (
            <div className="flex items-center justify-between sm:justify-end gap-2 pb-2 sm:pb-1.5">
              <div className="inline-flex items-center gap-0.5">
                {(
                  [
                    { id: 'month', label: 'Month' },
                    { id: '30d', label: '30d' },
                    { id: 'ytd', label: 'YTD' },
                    { id: 'all', label: 'All' },
                  ] as { id: TimeScope; label: string }[]
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setTimeScope(s.id)}
                    className={`min-h-[30px] px-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      timeScope === s.id
                        ? 'hub-bg-soft'
                        : 'text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {timeScope === 'month' && (
                <div className="inline-flex items-center gap-0.5 text-xs font-medium text-[#202124] dark:text-[#E8EAED]">
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() => setSelectedMonth((m) => shiftMonthKey(m, -1))}
                    className="min-h-[30px] min-w-[30px] flex items-center justify-center rounded-lg text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1 whitespace-nowrap tabular-nums">
                    {formatMonthLabel(selectedMonth)}
                  </span>
                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() => setSelectedMonth((m) => shiftMonthKey(m, 1))}
                    className="min-h-[30px] min-w-[30px] flex items-center justify-center rounded-lg text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {subTab === 'purchases' ? (
        <>
          {/* Google Finance / Wallet Insights Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-5 space-y-4">
              <div className="flex items-center justify-between text-xs text-[#444746] dark:text-[#C4C7C5]">
                <span>Net Spend · {scopeLabel}</span>
                <span className="tabular-nums">
                  {scopedPurchases.length}{' '}
                  {scopedPurchases.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <p className={`text-3xl font-semibold font-mono tabular-nums text-[#1F1F1F] dark:text-[#E3E3E3] ${blurClass}`}>
                    {formatCurrency(
                      purchaseStats.netSpend,
                      preferences.currency
                    )}
                  </p>
                  {purchaseStats.momDeltaPct !== null && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-mono font-medium tabular-nums ${
                        purchaseStats.momDeltaPct > 0
                          ? 'text-[#B3261E] dark:text-[#F2B8B5]'
                          : 'text-[#146C2E] dark:text-[#6DD58C]'
                      }`}
                    >
                      {purchaseStats.momDeltaPct > 0 ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                      {purchaseStats.momDeltaPct > 0 ? '+' : ''}
                      {purchaseStats.momDeltaPct}% vs prev mo
                    </span>
                  )}
                </div>

                {(purchaseStats.totalRefunds > 0 ||
                  purchaseStats.totalIncome > 0) && (
                  <p className={`text-[11px] font-mono tabular-nums text-[#146C2E] dark:text-[#6DD58C] ${blurClass}`}>
                    {purchaseStats.totalIncome > 0
                      ? `Income +${formatCurrency(purchaseStats.totalIncome, preferences.currency)} · Net cash ${formatCurrency(purchaseStats.netCashflow, preferences.currency)}`
                      : `Gross ${formatCurrency(purchaseStats.grossExpense, preferences.currency)} − ${formatCurrency(purchaseStats.totalRefunds, preferences.currency)} refunds`}
                  </p>
                )}
              </div>

              {timeScope === 'month' ? (
                <div className="space-y-1.5">
                  <div className="h-2 rounded-full bg-[#E9EEF6] dark:bg-[#282A2C] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        budgetRemaining < 0
                          ? 'bg-[#B3261E] dark:bg-[#F2B8B5]'
                          : 'bg-[#0B57D0] dark:bg-[#A8C7FA]'
                      }`}
                      style={{ width: `${budgetPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs tabular-nums">
                    <span
                      className={
                        budgetRemaining < 0
                          ? 'text-[#B3261E] dark:text-[#F2B8B5] font-medium'
                          : 'text-[#444746] dark:text-[#C4C7C5]'
                      }
                    >
                      {budgetRemaining < 0
                        ? `${formatCurrency(Math.abs(budgetRemaining), preferences.currency)} over`
                        : `${formatCurrency(budgetRemaining, preferences.currency)} left`}
                    </span>
                    <span className="text-[#444746] dark:text-[#C4C7C5]">
                      Budget{' '}
                      {formatCurrency(
                        preferences.monthlyBudget,
                        preferences.currency
                      )}
                    </span>
                  </div>
                  {purchaseStats.projectedMonthEnd !== null &&
                    purchaseStats.netSpend > 0 && (
                      <p className="text-[11px] text-[#444746] dark:text-[#C4C7C5] font-mono tabular-nums">
                        Pace{' '}
                        {formatCurrency(
                          purchaseStats.dailyPace,
                          preferences.currency
                        )}
                        /day · Projected{' '}
                        {formatCurrency(
                          purchaseStats.projectedMonthEnd,
                          preferences.currency
                        )}
                      </p>
                    )}
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs font-mono tabular-nums text-[#444746] dark:text-[#C4C7C5]">
                  <span>
                    {purchaseStats.expenseCount} expenses
                    {purchaseStats.dailyPace > 0
                      ? ` · ${formatCurrency(purchaseStats.dailyPace, preferences.currency)}/day`
                      : ''}
                  </span>
                  <span>
                    {formatCurrency(
                      purchaseStats.totalRefunds,
                      preferences.currency
                    )}{' '}
                    credits
                  </span>
                </div>
              )}

              {/* Activity Timeline Sparkline */}
              <div className="pt-2 border-t border-[#F0F4F9] dark:border-[#282A2C] space-y-1.5">
                <span className="text-[11px] font-medium text-[#444746] dark:text-[#C4C7C5]">
                  {timeScope === 'month' || timeScope === '30d'
                    ? 'Daily spend activity'
                    : 'Monthly spend trend (12 mo)'}
                </span>
                <div className="flex items-end gap-[2px] h-12">
                  {timelineBars.map((bar) => (
                    <div
                      key={bar.key}
                      title={`${bar.label}: ${formatCurrency(bar.amount, preferences.currency)}`}
                      className={`flex-1 rounded-t-xs transition-all ${
                        bar.amount > 0
                          ? 'bg-[#0B57D0] dark:bg-[#A8C7FA]'
                          : 'bg-[#E9EEF6] dark:bg-[#282A2C]'
                      }`}
                      style={{
                        height:
                          bar.amount > 0
                            ? `${Math.max(15, bar.heightPct)}%`
                            : '10%',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="md:col-span-2 rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center p-0.5 rounded-full border border-[#E1E3E1] dark:border-[#444746]">
                  <button
                    type="button"
                    onClick={() => setBreakdownMode('category')}
                    className={`min-h-[30px] px-3 rounded-full text-xs font-medium transition-colors ${
                      breakdownMode === 'category'
                        ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF]'
                        : 'text-[#444746] dark:text-[#C4C7C5]'
                    }`}
                  >
                    {tx('Categories')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBreakdownMode('payment')}
                    className={`min-h-[30px] px-3 rounded-full text-xs font-medium transition-colors ${
                      breakdownMode === 'payment'
                        ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF]'
                        : 'text-[#444746] dark:text-[#C4C7C5]'
                    }`}
                  >
                    {tx('Payments')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBreakdownMode('merchant')}
                    className={`min-h-[30px] px-3 rounded-full text-xs font-medium transition-colors ${
                      breakdownMode === 'merchant'
                        ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF]'
                        : 'text-[#444746] dark:text-[#C4C7C5]'
                    }`}
                  >
                    {tx('Merchants')}
                  </button>
                </div>

                {filteredPurchases.length > 0 && (
                  <button
                    type="button"
                    onClick={exportCsv}
                    className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full text-xs font-medium text-[#0B57D0] dark:text-[#A8C7FA] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                )}
              </div>

              {/* Mini Google Finance Metric Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-3 border-b border-[#F0F4F9] dark:border-[#282A2C]">
                <div>
                  <span className="text-[11px] text-[#747775]">Avg Expense</span>
                  <p className="text-sm font-mono font-semibold tabular-nums text-[#1F1F1F] dark:text-[#E3E3E3]">
                    {formatCurrency(
                      purchaseStats.avgTicket,
                      preferences.currency
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-[#747775]">
                    {tx('Top Category')}
                  </span>
                  <p className="text-sm font-semibold text-[#1F1F1F] dark:text-[#E3E3E3] truncate">
                    {categoryBreakdown[0]?.category ?? '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-[#747775]">
                    {tx('Recurring Share')}
                  </span>
                  <p className="text-sm font-mono font-semibold tabular-nums text-[#1F1F1F] dark:text-[#E3E3E3]">
                    {purchaseStats.recurringSharePct}%
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setStatusFilter((prev) =>
                      prev === 'pending' ? 'all' : 'pending'
                    )
                  }
                  className="text-left group"
                  title="Filter to pending reimbursements"
                >
                  <span className="text-[11px] text-[#747775] group-hover:underline">
                    Pending Payback ({purchaseStats.pendingReimburseCount})
                  </span>
                  <p
                    className={`text-sm font-mono font-semibold tabular-nums ${
                      purchaseStats.pendingReimburseTotal > 0
                        ? 'text-[#B06000] dark:text-[#FCD663]'
                        : 'text-[#1F1F1F] dark:text-[#E3E3E3]'
                    }`}
                  >
                    {formatCurrency(
                      purchaseStats.pendingReimburseTotal,
                      preferences.currency
                    )}
                  </p>
                </button>
              </div>

              {breakdownMode === 'category' ? (
                categoryBreakdown.length === 0 ? (
                  <p className="text-sm text-[#444746] dark:text-[#C4C7C5] py-4">
                    Category spending insights will appear once you log purchases
                    for {scopeLabel}.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                    {categoryBreakdown.map(({ category, total }) => {
                      const catCap =
                        timeScope === 'month'
                          ? preferences.categoryBudgets?.[category]
                          : undefined;
                      const base =
                        catCap && catCap > 0
                          ? catCap
                          : Math.max(purchaseStats.netSpend, 1);
                      const share = Math.max(
                        0,
                        Math.min(100, Math.round((total / base) * 100))
                      );
                      const overCatBudget = Boolean(
                        catCap && catCap > 0 && total > catCap
                      );
                      const isSelected = categoryFilter === category;
                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() =>
                            setCategoryFilter((prev) =>
                              prev === category ? 'All' : category
                            )
                          }
                          className={`text-left space-y-1 rounded-xl p-1.5 -m-1.5 transition-colors ${
                            isSelected
                              ? 'bg-[#E9EEF6] dark:bg-[#282A2C]'
                              : 'hover:bg-[#F8FAFD] dark:hover:bg-[#282A2C]/60'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-[#1F1F1F] dark:text-[#E3E3E3] truncate">
                              {category}
                            </span>
                            <span
                              className={`font-mono tabular-nums ml-2 ${blurClass} ${
                                overCatBudget
                                  ? 'text-[#B3261E] dark:text-[#F2B8B5] font-semibold'
                                  : 'text-[#444746] dark:text-[#C4C7C5]'
                              }`}
                            >
                              {formatCurrency(total, preferences.currency)}
                              {catCap && catCap > 0
                                ? ` / ${formatCurrency(catCap, preferences.currency)}`
                                : ` · ${share}%`}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#E9EEF6] dark:bg-[#282A2C] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                overCatBudget
                                  ? 'bg-[#B3261E] dark:bg-[#F2B8B5]'
                                  : 'bg-[#0B57D0] dark:bg-[#A8C7FA]'
                              }`}
                              style={{ width: `${share}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )
              ) : breakdownMode === 'payment' ? (
                paymentBreakdown.length === 0 ? (
                  <p className="text-sm text-[#444746] dark:text-[#C4C7C5] py-4">
                    {tx('Payment method totals will appear once purchases are logged.')}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                    {paymentBreakdown.map(({ method, total }) => {
                      const base = Math.max(purchaseStats.netSpend, 1);
                      const share = Math.max(
                        0,
                        Math.min(100, Math.round((total / base) * 100))
                      );
                      const isSelected = paymentFilter === method;
                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() =>
                            setPaymentFilter((prev) =>
                              prev === method ? 'All' : method
                            )
                          }
                          className={`text-left space-y-1 rounded-xl p-1.5 -m-1.5 transition-colors ${
                            isSelected
                              ? 'bg-[#E9EEF6] dark:bg-[#282A2C]'
                              : 'hover:bg-[#F8FAFD] dark:hover:bg-[#282A2C]/60'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-[#1F1F1F] dark:text-[#E3E3E3] truncate">
                              {method}
                            </span>
                            <span className={`font-mono tabular-nums text-[#444746] dark:text-[#C4C7C5] ml-2 ${blurClass}`}>
                              {formatCurrency(total, preferences.currency)} ·{' '}
                              {share}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#E9EEF6] dark:bg-[#282A2C] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#146C2E] dark:bg-[#6DD58C]"
                              style={{ width: `${share}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )
              ) : merchantBreakdown.length === 0 ? (
                <p className="text-sm text-[#444746] dark:text-[#C4C7C5] py-4">
                  Top merchants will appear once purchases are logged for{' '}
                  {scopeLabel}.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                  {merchantBreakdown.map((m) => {
                    const maxTotal = Math.max(
                      merchantBreakdown[0]?.total ?? 1,
                      1
                    );
                    const widthPct = Math.max(
                      8,
                      Math.round((m.total / maxTotal) * 100)
                    );
                    const isSelected =
                      search.trim().toLowerCase() === m.name.toLowerCase();
                    return (
                      <button
                        key={m.name}
                        type="button"
                        onClick={() =>
                          setSearch((prev) =>
                            prev.trim().toLowerCase() === m.name.toLowerCase()
                              ? ''
                              : m.name
                          )
                        }
                        className={`text-left space-y-1 rounded-xl p-1.5 -m-1.5 transition-colors ${
                          isSelected
                            ? 'bg-[#E9EEF6] dark:bg-[#282A2C]'
                            : 'hover:bg-[#F8FAFD] dark:hover:bg-[#282A2C]/60'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-[#1F1F1F] dark:text-[#E3E3E3] truncate">
                            {m.name} ({m.count}×)
                          </span>
                          <span className={`font-mono tabular-nums text-[#444746] dark:text-[#C4C7C5] ml-2 ${blurClass}`}>
                            {formatCurrency(m.total, preferences.currency)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#E9EEF6] dark:bg-[#282A2C] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#0B57D0] dark:bg-[#A8C7FA]"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Filter, Search & Sort Toolbar */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#747775] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search merchant, category, #tag, or notes..."
                  className="w-full min-h-[44px] rounded-full border border-[#DADCE0] dark:border-[#444746] bg-white dark:bg-[#1E1F20] pl-10 pr-4 text-sm text-[#1F1F1F] dark:text-[#E3E3E3] placeholder:text-[#747775] focus:outline-none focus:border-[#0B57D0] dark:focus:border-[#A8C7FA]"
                />
              </div>

              <div className="flex gap-2">
                <select
                  aria-label="Filter by payment method"
                  value={paymentFilter}
                  onChange={(e) =>
                    setPaymentFilter(e.target.value as 'All' | PaymentMethod)
                  }
                  className="min-h-[44px] rounded-full border border-[#DADCE0] dark:border-[#444746] bg-white dark:bg-[#1E1F20] px-4 text-xs font-medium text-[#1F1F1F] dark:text-[#E3E3E3]"
                >
                  {PAYMENTS.map((pm) => (
                    <option key={pm} value={pm}>
                      {pm === 'All' ? 'All Payments' : pm}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Sort purchases"
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="min-h-[44px] rounded-full border border-[#DADCE0] dark:border-[#444746] bg-white dark:bg-[#1E1F20] px-4 text-xs font-medium text-[#1F1F1F] dark:text-[#E3E3E3]"
                >
                  <option value="newest">Newest</option>
                  <option value="highest">Highest Amount</option>
                  <option value="title">Merchant A–Z</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`min-h-[36px] px-3.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    categoryFilter === cat
                      ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF]'
                      : 'bg-white dark:bg-[#1E1F20] border border-[#DADCE0] dark:border-[#444746] text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]'
                  }`}
                >
                  {cat}
                </button>
              ))}

              <span className="h-5 w-px bg-[#E1E3E1] dark:bg-[#444746] mx-1 shrink-0" />

              {(
                [
                  { id: 'refunds', label: 'Refunds' },
                  { id: 'income', label: 'Income' },
                  { id: 'reimbursable', label: 'Reimbursable' },
                  { id: 'pending', label: 'Pending Payback' },
                ] as { id: StatusFilter; label: string }[]
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() =>
                    setStatusFilter((prev) => (prev === st.id ? 'all' : st.id))
                  }
                  className={`min-h-[36px] px-3.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    statusFilter === st.id
                      ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF]'
                      : 'bg-white dark:bg-[#1E1F20] border border-[#DADCE0] dark:border-[#444746] text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]'
                  }`}
                >
                  {st.label}
                </button>
              ))}

              {availableTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setTagFilter((prev) => (prev === tag ? 'All' : tag))
                  }
                  className={`min-h-[36px] px-3.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    tagFilter === tag
                      ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF]'
                      : 'bg-white dark:bg-[#1E1F20] border border-[#DADCE0] dark:border-[#444746] text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Purchases Ledger */}
          <section className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] overflow-hidden">
            {filteredPurchases.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-3">
                <Receipt className="w-7 h-7 mx-auto text-[#747775]" />
                <p className="text-sm text-[#444746] dark:text-[#C4C7C5]">
                  {scopedPurchases.length === 0
                    ? `No purchases recorded for ${scopeLabel}.`
                    : 'No entries match your current filter.'}
                </p>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearPurchaseFilters}
                    className="min-h-[44px] px-5 rounded-full border border-[#DADCE0] dark:border-[#444746] text-xs font-medium text-[#0B57D0] dark:text-[#A8C7FA]"
                  >
                    {tx('Clear Filters')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onNewPurchase}
                    className="min-h-[44px] px-5 rounded-full hub-bg-accent text-xs font-medium"
                  >
                    {tx('Log Purchase')}
                  </button>
                )}
              </div>
            ) : sortMode === 'newest' ? (
              <div>
                {dateGroups.map((group) => (
                  <div key={group.date}>
                    <div className="px-4 sm:px-6 py-2 bg-[#F8FAFD] dark:bg-[#131314] border-y first:border-t-0 border-[#F0F4F9] dark:border-[#282A2C] flex items-center justify-between text-xs">
                      <span className="font-medium text-[#444746] dark:text-[#C4C7C5]">
                        {group.label}
                      </span>
                      <span className="font-mono tabular-nums text-[#747775]">
                        {formatCurrency(group.netTotal, preferences.currency)}
                      </span>
                    </div>
                    <div className="divide-y divide-[#F0F4F9] dark:divide-[#282A2C]">
                      {group.items.map((p) => renderPurchaseRow(p, false))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-[#F0F4F9] dark:divide-[#282A2C]">
                {filteredPurchases.map((p) => renderPurchaseRow(p, true))}
              </div>
            )}
          </section>
        </>
      ) : (
        /* ---------------- Subscription Tracker Section ---------------- */
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-4 sm:p-5">
              <span className="text-xs text-[#444746] dark:text-[#C4C7C5]">
                {tx('Monthly Normalized')}
              </span>
              <p className={`mt-1.5 text-2xl font-semibold font-mono tabular-nums text-[#1F1F1F] dark:text-[#E3E3E3] ${blurClass}`}>
                {formatCurrency(
                  subscriptionMetrics.monthlyNormalized,
                  preferences.currency
                )}
              </p>
              <p className="mt-1 text-[11px] text-[#747775] tabular-nums">
                {subscriptionMetrics.pausedMonthlySavings > 0
                  ? `Saving ${formatCurrency(subscriptionMetrics.pausedMonthlySavings, preferences.currency)}/mo paused`
                  : `${subscriptionMetrics.activeCount} active plans`}
              </p>
            </div>

            <div className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-4 sm:p-5">
              <span className="text-xs text-[#444746] dark:text-[#C4C7C5]">
                {tx('Annualized Run Rate')}
              </span>
              <p className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-[#1F1F1F] dark:text-[#E3E3E3]">
                {formatCurrency(
                  subscriptionMetrics.annualized,
                  preferences.currency
                )}
              </p>
              <p className="mt-1 text-[11px] text-[#747775]">estimated / yr</p>
            </div>

            <div className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-4 sm:p-5">
              <span className="text-xs text-[#444746] dark:text-[#C4C7C5]">
                {tx('Next 30 Days Due')}
              </span>
              <p className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-[#1F1F1F] dark:text-[#E3E3E3]">
                {formatCurrency(
                  subscriptionMetrics.next30DaysTotal,
                  preferences.currency
                )}
              </p>
              <p className="mt-1 text-[11px] text-[#747775] tabular-nums">
                {subscriptionMetrics.next30DaysCount}{' '}
                {subscriptionMetrics.next30DaysCount === 1
                  ? 'renewal'
                  : 'renewals'}{' '}
                due
              </p>
            </div>

            <div className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-4 sm:p-5">
              <span className="text-xs text-[#444746] dark:text-[#C4C7C5]">
                {tx('Trials & Alerts')}
              </span>
              <p
                className={`mt-1.5 text-2xl font-semibold font-mono tabular-nums ${
                  subscriptionMetrics.alertDueCount > 0 ||
                  subscriptionMetrics.trialCount > 0
                    ? 'text-[#0B57D0] dark:text-[#A8C7FA]'
                    : 'text-[#1F1F1F] dark:text-[#E3E3E3]'
                }`}
              >
                {subscriptionMetrics.alertDueCount}
              </p>
              <p className="mt-1 text-[11px] text-[#747775] tabular-nums">
                {subscriptionMetrics.trialCount} active{' '}
                {subscriptionMetrics.trialCount === 1 ? 'trial' : 'trials'} ·{' '}
                {subscriptionMetrics.pausedCount} paused
              </p>
            </div>
          </div>

          {subscriptionMetrics.categoryShares.length > 0 && (
            <div className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-5 space-y-3">
              <span className="text-xs font-medium text-[#444746] dark:text-[#C4C7C5]">
                {tx('Recurring Spend by Category (Monthly Equivalent)')}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5">
                {subscriptionMetrics.categoryShares.map(
                  ({ category, monthly }) => {
                    const share =
                      subscriptionMetrics.monthlyNormalized > 0
                        ? Math.round(
                            (monthly / subscriptionMetrics.monthlyNormalized) *
                              100
                          )
                        : 0;
                    return (
                      <div key={category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-[#1F1F1F] dark:text-[#E3E3E3]">
                            {category}
                          </span>
                          <span className="font-mono tabular-nums text-[#444746] dark:text-[#C4C7C5]">
                            {formatCurrency(monthly, preferences.currency)}/mo ·{' '}
                            {share}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#E9EEF6] dark:bg-[#282A2C] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#0B57D0] dark:bg-[#A8C7FA]"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}

          {/* Subscription Search, Filter & Sort Toolbar */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#747775] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={subSearch}
                  onChange={(e) => setSubSearch(e.target.value)}
                  placeholder="Search subscriptions, category, or notes..."
                  className="w-full min-h-[44px] rounded-full border border-[#DADCE0] dark:border-[#444746] bg-white dark:bg-[#1E1F20] pl-10 pr-4 text-sm text-[#1F1F1F] dark:text-[#E3E3E3] placeholder:text-[#747775] focus:outline-none focus:border-[#0B57D0] dark:focus:border-[#A8C7FA]"
                />
              </div>

              <select
                aria-label="Sort subscriptions"
                value={subSort}
                onChange={(e) => setSubSort(e.target.value as SubSortMode)}
                className="min-h-[44px] rounded-full border border-[#DADCE0] dark:border-[#444746] bg-white dark:bg-[#1E1F20] px-4 text-xs font-medium text-[#1F1F1F] dark:text-[#E3E3E3]"
              >
                <option value="renewal">Sort: Next Renewal</option>
                <option value="cost">Sort: Highest Monthly</option>
                <option value="name">Sort: Name A–Z</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(
                [
                  { id: 'all', label: `All (${subscriptions.length})` },
                  {
                    id: 'active',
                    label: `Active (${subscriptionMetrics.activeCount})`,
                  },
                  {
                    id: 'dueSoon',
                    label: `Due Alerts (${subscriptionMetrics.alertDueCount})`,
                  },
                  {
                    id: 'trials',
                    label: `Trials (${subscriptionMetrics.trialCount})`,
                  },
                  ...(subscriptionMetrics.underusedCount > 0
                    ? [
                        {
                          id: 'underused' as SubFilterMode,
                          label: `Underused (${subscriptionMetrics.underusedCount})`,
                        },
                      ]
                    : []),
                  {
                    id: 'paused',
                    label: `Paused (${subscriptionMetrics.pausedCount})`,
                  },
                ] as { id: SubFilterMode; label: string }[]
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSubFilter(f.id)}
                  className={`min-h-[36px] px-4 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    subFilter === f.id
                      ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF]'
                      : 'bg-white dark:bg-[#1E1F20] border border-[#DADCE0] dark:border-[#444746] text-[#444746] dark:text-[#C4C7C5]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <section className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] overflow-hidden">
            {filteredSubscriptions.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-3">
                <CalendarClock className="w-7 h-7 mx-auto text-[#747775]" />
                <p className="text-sm text-[#444746] dark:text-[#C4C7C5]">
                  {subscriptions.length === 0
                    ? 'No subscriptions tracked yet. Add memberships, cloud plans, or utility bills to monitor renewals.'
                    : 'No subscriptions match your current filter.'}
                </p>
                {subscriptions.length === 0 && (
                  <button
                    type="button"
                    onClick={onNewSubscription}
                    className="min-h-[44px] px-5 rounded-full hub-bg-accent text-xs font-medium"
                  >
                    {tx('Add First Subscription')}
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#F0F4F9] dark:divide-[#282A2C]">
                {filteredSubscriptions.map((sub) => {
                  const days = getDaysUntil(sub.nextBillingDate, todayISO);
                  const alertWindow = sub.reminderDays ?? 3;
                  const inAlertWindow = sub.active && days <= alertWindow;
                  const dueText = !sub.active
                    ? 'Paused'
                    : days < 0
                      ? `Overdue ${Math.abs(days)}d`
                      : days === 0
                        ? 'Due today'
                        : days === 1
                          ? 'Due tomorrow'
                          : `In ${days} days`;

                  return (
                    <div
                      key={sub.id}
                      className={`px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        !sub.active ? 'opacity-65' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onEditSubscription(sub)}
                        className="min-w-0 flex-1 text-left space-y-1"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-[#1F1F1F] dark:text-[#E3E3E3] truncate">
                            {sub.name}
                          </span>
                          {sub.isTrial && sub.active && (
                            <span className="text-xs font-medium text-[#B06000] dark:text-[#FCD663] shrink-0">
                              · Free Trial
                            </span>
                          )}
                          {sub.usageStatus === 'underused' && sub.active && (
                            <span className="text-xs font-medium text-[#B06000] dark:text-[#FCD663] shrink-0">
                              · Underused
                            </span>
                          )}
                          <span
                            className={`text-xs font-medium shrink-0 ${
                              !sub.active
                                ? 'text-[#747775]'
                                : days <= 0
                                  ? 'text-[#B3261E] dark:text-[#F2B8B5]'
                                  : inAlertWindow
                                    ? 'text-[#0B57D0] dark:text-[#A8C7FA]'
                                    : 'text-[#444746] dark:text-[#C4C7C5]'
                            }`}
                          >
                            · {dueText}
                          </span>
                        </div>
                        <p className="text-xs text-[#444746] dark:text-[#C4C7C5] truncate">
                          {sub.isTrial ? 'Trial ends: ' : 'Next: '}
                          {formatShortDate(sub.nextBillingDate)} ·{' '}
                          <span className="capitalize">{sub.billingCycle}</span>{' '}
                          · {sub.category} · {sub.paymentMethod}
                          {sub.cardLast4
                            ? ` · ••${sub.cardLast4}${sub.cardExpiry ? ` (${sub.cardExpiry})` : ''}`
                            : ''}
                          {sub.totalPaidCount && sub.totalPaidCount > 0
                            ? ` · Paid ${sub.totalPaidCount}×${sub.lastPaidDate ? ` (${formatShortDate(sub.lastPaidDate)})` : ''}`
                            : ''}
                          {sub.notes ? ` · ${sub.notes}` : ''}
                        </p>
                      </button>

                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                        <div className={`text-right mr-1 ${blurClass}`}>
                          <p className="text-sm sm:text-base font-mono font-semibold tabular-nums text-[#1F1F1F] dark:text-[#E3E3E3]">
                            {formatCurrency(sub.amount, preferences.currency)}
                          </p>
                          <p className="text-[11px] font-mono tabular-nums text-[#747775]">
                            {formatCurrency(
                              getMonthlyEquivalent(
                                sub.amount,
                                sub.billingCycle
                              ),
                              preferences.currency
                            )}
                            /mo
                          </p>
                        </div>

                        {sub.manageUrl && (
                          <a
                            href={sub.manageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open subscription management page"
                            aria-label={`Manage ${sub.name} externally`}
                            className="min-h-[38px] min-w-[38px] rounded-full border border-[#DADCE0] dark:border-[#444746] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {sub.active && (
                          <button
                            type="button"
                            onClick={() => void logSubscriptionPayment(sub.id)}
                            title="Log payment into Purchases and advance next renewal date"
                            className="min-h-[38px] px-3.5 rounded-full bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF] text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-95 whitespace-nowrap"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Log Payment</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => void toggleSubscriptionActive(sub.id)}
                          aria-label={
                            sub.active
                              ? `Pause ${sub.name}`
                              : `Resume ${sub.name}`
                          }
                          title={sub.active ? 'Pause' : 'Resume'}
                          className="min-h-[38px] min-w-[38px] rounded-full border border-[#DADCE0] dark:border-[#444746] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]"
                        >
                          {sub.active ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onEditSubscription(sub)}
                          aria-label={`Edit ${sub.name}`}
                          className="min-h-[38px] min-w-[38px] rounded-full flex items-center justify-center text-[#747775] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
