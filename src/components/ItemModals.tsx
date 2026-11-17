import React, { useEffect, useState } from 'react';
import { Copy, Plus, Star, Trash2, X } from 'lucide-react';
import type {
  CalendarColor,
  CalendarEventRecord,
  HabitCadence,
  HabitCustomMode,
  HabitMode,
  HabitRecord,
  HabitTimeOfDay,
  PaymentMethod,
  PurchaseCategory,
  PurchaseEntryType,
  PurchaseRecord,
  RecurrenceCycle,
  SubscriptionBillingCycle,
  SubscriptionRecord,
  TaskListRecord,
  TaskPriority,
  TaskRecord,
  TaskSubItem,
} from '../types';
import {
  formatCurrency,
  getMonthlyEquivalent,
  getOffsetDateISO,
  getPurchaseEntryType,
  getTodayISO,
} from '../lib/format';
import { DEFAULT_TASK_LIST_ID } from '../context/VaultContext';

const PURCHASE_CATEGORIES: PurchaseCategory[] = [
  'Groceries',
  'Food & Dining',
  'Transport',
  'Utilities',
  'Tech & Gear',
  'Health',
  'Home',
  'Other',
];

const PAYMENT_METHODS: PaymentMethod[] = [
  'Card',
  'Digital Wallet',
  'Bank Transfer',
  'Cash',
];

const RECURRENCE_OPTIONS: { value: RecurrenceCycle; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const CALENDAR_COLORS: {
  id: CalendarColor;
  label: string;
  swatchClass: string;
}[] = [
  { id: 'blue', label: 'Cobalt', swatchClass: 'bg-[#0B57D0] dark:bg-[#A8C7FA]' },
  { id: 'green', label: 'Sage', swatchClass: 'bg-[#146C2E] dark:bg-[#6DD58C]' },
  { id: 'amber', label: 'Amber', swatchClass: 'bg-[#B06000] dark:bg-[#FCD663]' },
  { id: 'red', label: 'Crimson', swatchClass: 'bg-[#B3261E] dark:bg-[#F2B8B5]' },
  { id: 'purple', label: 'Plum', swatchClass: 'bg-[#6750A4] dark:bg-[#D0BCFF]' },
];

interface SheetShellProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const SheetShell: React.FC<SheetShellProps> = ({
  title,
  onClose,
  children,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#1E1F20] border border-[#E1E3E1] dark:border-[#444746] p-5 sm:p-6 pb-8 sm:pb-6 space-y-5"
      >
        <div className="sm:hidden w-10 h-1 bg-[#C4C7C5] dark:bg-[#444746] rounded-full mx-auto -mt-1 mb-2" />
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-[#1F1F1F] dark:text-[#E3E3E3]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

/* ---------------- Purchase Modal ---------------- */

const QUICK_TAG_SUGGESTIONS = ['Essential', 'Work', 'Shared', 'Travel', 'Gift'];

interface PurchaseModalProps {
  initial?: PurchaseRecord | null;
  recentPurchases?: PurchaseRecord[];
  currency: string;
  onSave: (
    data: Omit<PurchaseRecord, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    }
  ) => Promise<void>;
  onDuplicate?: (purchase: PurchaseRecord) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
}

export const PurchaseModal: React.FC<PurchaseModalProps> = ({
  initial,
  recentPurchases = [],
  currency,
  onSave,
  onDuplicate,
  onDelete,
  onClose,
}) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [entryType, setEntryType] = useState<PurchaseEntryType>(
    initial ? getPurchaseEntryType(initial) : 'expense'
  );
  const [category, setCategory] = useState<PurchaseCategory>(
    initial?.category ?? 'Groceries'
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initial?.paymentMethod ?? 'Card'
  );
  const [date, setDate] = useState(initial?.date ?? getTodayISO());
  const [returnByDate, setReturnByDate] = useState(initial?.returnByDate ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [tagsInput, setTagsInput] = useState(
    initial?.tags ? initial.tags.join(', ') : ''
  );
  const [recurring, setRecurring] = useState(initial?.recurring ?? false);
  const [reimbursable, setReimbursable] = useState(
    initial?.reimbursable ?? false
  );
  const [reimbursed, setReimbursed] = useState(initial?.reimbursed ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isCreditEntry = entryType === 'refund' || entryType === 'income';

  // Top frequent merchants from the user's own history for 1-tap autofill
  const merchantPresets = React.useMemo(() => {
    if (initial || recentPurchases.length === 0) return [];
    const counts = new Map<
      string,
      { count: number; sample: PurchaseRecord }
    >();
    for (const p of recentPurchases) {
      if (getPurchaseEntryType(p) !== 'expense') continue;
      const key = p.title.trim().toLowerCase();
      if (!key) continue;
      const prev = counts.get(key);
      if (prev) {
        prev.count += 1;
      } else {
        counts.set(key, { count: 1, sample: p });
      }
    }
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count || b.sample.updatedAt - a.sample.updatedAt)
      .slice(0, 4)
      .map((entry) => entry.sample);
  }, [initial, recentPurchases]);

  const parsedTags = React.useMemo(
    () =>
      Array.from(
        new Set(
          tagsInput
            .split(',')
            .map((t) => t.trim().replace(/^#/, ''))
            .filter(Boolean)
        )
      ).slice(0, 8),
    [tagsInput]
  );

  const toggleTagChip = (tag: string) => {
    const exists = parsedTags.some(
      (t) => t.toLowerCase() === tag.toLowerCase()
    );
    const next = exists
      ? parsedTags.filter((t) => t.toLowerCase() !== tag.toLowerCase())
      : [...parsedTags, tag];
    setTagsInput(next.join(', '));
  };

  const applyPreset = (sample: PurchaseRecord) => {
    setTitle(sample.title);
    setAmount(String(sample.amount));
    setCategory(sample.category);
    setPaymentMethod(sample.paymentMethod);
    if (sample.tags && sample.tags.length > 0) {
      setTagsInput(sample.tags.join(', '));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const num = parseFloat(amount);
    if (!title.trim()) {
      setError('Enter a merchant or item title.');
      return;
    }
    if (!Number.isFinite(num) || num <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        title: title.trim(),
        amount: Math.round(num * 100) / 100,
        category,
        paymentMethod,
        date,
        returnByDate:
          entryType === 'expense' ? returnByDate || undefined : undefined,
        notes: notes.trim() || undefined,
        recurring,
        entryType,
        isRefund: entryType === 'refund',
        reimbursable: entryType === 'expense' ? reimbursable : false,
        reimbursed:
          entryType === 'expense' && reimbursable ? reimbursed : false,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save purchase.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetShell
      title={
        initial
          ? 'Edit Entry'
          : entryType === 'income'
            ? 'Log Income'
            : entryType === 'refund'
              ? 'Log Refund / Credit'
              : 'Log Purchase'
      }
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-xs text-[#B3261E] dark:text-[#F2B8B5]">{error}</p>
        )}

        {/* Expense vs Refund vs Income switcher */}
        <div className="grid grid-cols-3 p-1 rounded-full border border-[#E1E3E1] dark:border-[#444746] bg-[#F8FAFD] dark:bg-[#131314]">
          <button
            type="button"
            onClick={() => setEntryType('expense')}
            className={`min-h-[38px] rounded-full text-xs font-medium transition-colors ${
              entryType === 'expense'
                ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF]'
                : 'text-[#444746] dark:text-[#C4C7C5]'
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setEntryType('refund')}
            className={`min-h-[38px] rounded-full text-xs font-medium transition-colors ${
              entryType === 'refund'
                ? 'bg-[#C4EED0] dark:bg-[#0F5223] text-[#072711] dark:text-[#C4EED0]'
                : 'text-[#444746] dark:text-[#C4C7C5]'
            }`}
          >
            Refund
          </button>
          <button
            type="button"
            onClick={() => setEntryType('income')}
            className={`min-h-[38px] rounded-full text-xs font-medium transition-colors ${
              entryType === 'income'
                ? 'bg-[#C4EED0] dark:bg-[#0F5223] text-[#072711] dark:text-[#C4EED0]'
                : 'text-[#444746] dark:text-[#C4C7C5]'
            }`}
          >
            Income
          </button>
        </div>

        {/* Quick-fill frequent merchants when creating */}
        {merchantPresets.length > 0 && (
          <div className="space-y-1.5">
            <span className="block text-[11px] font-medium text-[#444746] dark:text-[#C4C7C5]">
              Frequent merchants
            </span>
            <div className="flex flex-wrap gap-1.5">
              {merchantPresets.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => applyPreset(m)}
                  className="min-h-[32px] px-3 rounded-full border border-[#DADCE0] dark:border-[#444746] text-xs text-[#1F1F1F] dark:text-[#E3E3E3] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] transition-colors"
                >
                  {m.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label
              htmlFor="pur-amount"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              {entryType === 'income'
                ? `Income Amount (${currency})`
                : entryType === 'refund'
                  ? `Credit Amount (${currency})`
                  : `Amount (${currency})`}
            </label>
            <input
              id="pur-amount"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              className={`w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 font-mono tabular-nums text-base font-semibold focus:outline-none focus:border-[#0B57D0] dark:focus:border-[#A8C7FA] ${
                isCreditEntry
                  ? 'text-[#146C2E] dark:text-[#6DD58C]'
                  : 'text-[#1F1F1F] dark:text-[#E3E3E3]'
              }`}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="pur-date"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              Date
            </label>
            <input
              id="pur-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3] focus:outline-none focus:border-[#0B57D0] dark:focus:border-[#A8C7FA]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="pur-title"
            className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
          >
            {entryType === 'income' ? 'Source or Payer' : 'Merchant or Item'}
          </label>
          <input
            id="pur-title"
            type="text"
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              entryType === 'income'
                ? 'e.g., Salary, Freelance invoice, Dividend'
                : entryType === 'refund'
                  ? 'e.g., Store return, Cashback credit, Split payback'
                  : 'e.g., Whole Foods, Metro Pass, Electric Bill'
            }
            className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3] focus:outline-none focus:border-[#0B57D0] dark:focus:border-[#A8C7FA]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label
              htmlFor="pur-cat"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              Category
            </label>
            <select
              id="pur-cat"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as PurchaseCategory)
              }
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-white dark:bg-[#1E1F20] px-3 text-sm text-[#1F1F1F] dark:text-[#E3E3E3] focus:outline-none focus:border-[#0B57D0] dark:focus:border-[#A8C7FA]"
            >
              {PURCHASE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="pur-pay"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              Payment Method
            </label>
            <select
              id="pur-pay"
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as PaymentMethod)
              }
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-white dark:bg-[#1E1F20] px-3 text-sm text-[#1F1F1F] dark:text-[#E3E3E3] focus:outline-none focus:border-[#0B57D0] dark:focus:border-[#A8C7FA]"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="pur-tags"
            className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
          >
            Tags (optional, comma-separated)
          </label>
          <input
            id="pur-tags"
            type="text"
            maxLength={120}
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g., Work, Travel, Shared"
            className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3] focus:outline-none focus:border-[#0B57D0] dark:focus:border-[#A8C7FA]"
          />
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {QUICK_TAG_SUGGESTIONS.map((tag) => {
              const selected = parsedTags.some(
                (t) => t.toLowerCase() === tag.toLowerCase()
              );
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTagChip(tag)}
                  className={`min-h-[30px] px-3 rounded-full text-xs font-medium border transition-colors ${
                    selected
                      ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF] border-transparent'
                      : 'border-[#DADCE0] dark:border-[#444746] text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]'
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="pur-notes"
            className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
          >
            Notes (optional)
          </label>
          <input
            id="pur-notes"
            type="text"
            maxLength={240}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Receipt note, order ID, or split context"
            className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3] focus:outline-none focus:border-[#0B57D0] dark:focus:border-[#A8C7FA]"
          />
        </div>

        {entryType === 'expense' && (
          <div className="space-y-1.5">
            <label
              htmlFor="pur-return"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              Return / Warranty Deadline (optional reminder)
            </label>
            <input
              id="pur-return"
              type="date"
              value={returnByDate}
              onChange={(e) => setReturnByDate(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3] focus:outline-none focus:border-[#0B57D0] dark:focus:border-[#A8C7FA]"
            />
          </div>
        )}

        <div className="space-y-1">
          <label className="flex items-center gap-3 min-h-[40px] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              className="w-4 h-4 accent-[#0B57D0] dark:accent-[#A8C7FA]"
            />
            <span className="text-sm text-[#1F1F1F] dark:text-[#E3E3E3]">
              {entryType === 'income' ? 'Recurring income' : 'Recurring expense'}
            </span>
          </label>

          {entryType === 'expense' && (
            <div className="space-y-1">
              <label className="flex items-center gap-3 min-h-[40px] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={reimbursable}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setReimbursable(checked);
                    if (!checked) setReimbursed(false);
                  }}
                  className="w-4 h-4 accent-[#0B57D0] dark:accent-[#A8C7FA]"
                />
                <span className="text-sm text-[#1F1F1F] dark:text-[#E3E3E3]">
                  Reimbursable (expecting payback or work claim)
                </span>
              </label>

              {reimbursable && (
                <label className="flex items-center gap-3 min-h-[38px] pl-7 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={reimbursed}
                    onChange={(e) => setReimbursed(e.target.checked)}
                    className="w-4 h-4 accent-[#146C2E] dark:accent-[#6DD58C]"
                  />
                  <span className="text-xs font-medium text-[#146C2E] dark:text-[#6DD58C]">
                    Already reimbursed
                  </span>
                </label>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-2">
          {initial && onDelete && (
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await onDelete(initial.id);
                onClose();
              }}
              className="min-h-[44px] px-4 rounded-full border border-[#F2B8B5] dark:border-[#8C1D18] text-[#B3261E] dark:text-[#F2B8B5] text-sm font-medium hover:bg-[#FCE8E6] dark:hover:bg-[#601410]/40 transition-colors"
            >
              Delete
            </button>
          )}
          {initial && onDuplicate && (
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await onDuplicate(initial);
                onClose();
              }}
              className="min-h-[44px] px-4 rounded-full border border-[#DADCE0] dark:border-[#444746] text-[#1F1F1F] dark:text-[#E3E3E3] text-sm font-medium inline-flex items-center gap-1.5 hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Duplicate Today</span>
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex-1 min-h-[44px] px-6 rounded-full hub-bg-accent text-sm font-medium hover:opacity-95 disabled:opacity-50 transition-opacity"
          >
            {saving
              ? 'Encrypting...'
              : initial
                ? 'Save Changes'
                : entryType === 'income'
                  ? 'Log Income'
                  : entryType === 'refund'
                    ? 'Log Credit'
                    : 'Log Purchase'}
          </button>
        </div>
      </form>
    </SheetShell>
  );
};

/* ---------------- Subscription Modal ---------------- */

const REMINDER_DAY_OPTIONS = [0, 1, 3, 7] as const;

interface SubscriptionModalProps {
  initial?: SubscriptionRecord | null;
  currency: string;
  onSave: (
    data: Omit<SubscriptionRecord, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    }
  ) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  initial,
  currency,
  onSave,
  onDelete,
  onClose,
}) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [billingCycle, setBillingCycle] =
    useState<SubscriptionBillingCycle>(initial?.billingCycle ?? 'monthly');
  const [nextBillingDate, setNextBillingDate] = useState(
    initial?.nextBillingDate ?? getTodayISO()
  );
  const [category, setCategory] = useState<PurchaseCategory>(
    initial?.category ?? 'Tech & Gear'
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initial?.paymentMethod ?? 'Card'
  );
  const [active, setActive] = useState(initial?.active ?? true);
  const [isTrial, setIsTrial] = useState(initial?.isTrial ?? false);
  const [reminderDays, setReminderDays] = useState<number>(
    initial?.reminderDays ?? 3
  );
  const [manageUrl, setManageUrl] = useState(initial?.manageUrl ?? '');
  const [cardLast4, setCardLast4] = useState(initial?.cardLast4 ?? '');
  const [cardExpiry, setCardExpiry] = useState(initial?.cardExpiry ?? '');
  const [usageStatus, setUsageStatus] = useState<'active' | 'underused'>(
    initial?.usageStatus ?? 'active'
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const parsedAmount = parseFloat(amount);
  const validPreviewAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const monthlyPreview = validPreviewAmount
    ? getMonthlyEquivalent(parsedAmount, billingCycle)
    : 0;
  const yearlyPreview = monthlyPreview * 12;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const num = parseFloat(amount);
    if (!name.trim()) {
      setError('Enter a service or subscription name.');
      return;
    }
    if (!Number.isFinite(num) || num <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }
    const trimmedUrl = manageUrl.trim();
    if (
      trimmedUrl &&
      !trimmedUrl.startsWith('https://') &&
      !trimmedUrl.startsWith('http://')
    ) {
      setError('Manage link must start with https:// or http://.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        name: name.trim(),
        amount: Math.round(num * 100) / 100,
        billingCycle,
        nextBillingDate,
        category,
        paymentMethod,
        active,
        isTrial,
        reminderDays,
        manageUrl: trimmedUrl || undefined,
        cardLast4: cardLast4.replace(/\D/g, '').slice(0, 4) || undefined,
        cardExpiry: cardExpiry.trim() || undefined,
        usageStatus,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save subscription.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetShell
      title={initial ? 'Edit Subscription' : 'New Subscription'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-xs text-[#B3261E] dark:text-[#F2B8B5]">{error}</p>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="sub-name"
            className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
          >
            Service Name
          </label>
          <input
            id="sub-name"
            type="text"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Google One, Spotify, Gym Membership"
            autoFocus
            className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3] focus:outline-none focus:border-[#0B57D0] dark:focus:border-[#A8C7FA]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label
              htmlFor="sub-amount"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              {isTrial ? `Post-Trial Price (${currency})` : `Amount (${currency})`}
            </label>
            <input
              id="sub-amount"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="9.99"
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 font-mono tabular-nums text-base font-semibold text-[#1F1F1F] dark:text-[#E3E3E3] focus:outline-none focus:border-[#0B57D0] dark:focus:border-[#A8C7FA]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="sub-date"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              {isTrial ? 'Trial Ends / First Charge' : 'Next Renewal Date'}
            </label>
            <input
              id="sub-date"
              type="date"
              value={nextBillingDate}
              onChange={(e) => setNextBillingDate(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3] focus:outline-none focus:border-[#0B57D0] dark:focus:border-[#A8C7FA]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]">
            Billing Cycle
          </span>
          <div className="grid grid-cols-4 gap-1.5">
            {(
              ['weekly', 'monthly', 'quarterly', 'yearly'] as SubscriptionBillingCycle[]
            ).map((cycle) => (
              <button
                key={cycle}
                type="button"
                onClick={() => setBillingCycle(cycle)}
                className={`min-h-[42px] rounded-full text-xs font-medium capitalize border transition-colors ${
                  billingCycle === cycle
                    ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF] border-transparent'
                    : 'bg-transparent text-[#444746] dark:text-[#C4C7C5] border-[#DADCE0] dark:border-[#444746] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]'
                }`}
              >
                {cycle}
              </button>
            ))}
          </div>
          {validPreviewAmount && (
            <p className="text-[11px] font-mono tabular-nums text-[#444746] dark:text-[#C4C7C5] pt-0.5">
              Normalized cost: {formatCurrency(monthlyPreview, currency)}/mo ·{' '}
              {formatCurrency(yearlyPreview, currency)}/yr
              {billingCycle === 'monthly'
                ? ` · Annual plan (~16% off) saves ~${formatCurrency(yearlyPreview * 0.16, currency)}/yr`
                : ''}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label
              htmlFor="sub-cat"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              Category
            </label>
            <select
              id="sub-cat"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as PurchaseCategory)
              }
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-white dark:bg-[#1E1F20] px-3 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
            >
              {PURCHASE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="sub-pay"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              Payment Method
            </label>
            <select
              id="sub-pay"
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as PaymentMethod)
              }
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-white dark:bg-[#1E1F20] px-3 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label
              htmlFor="sub-last4"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              Card Last 4 (optional)
            </label>
            <input
              id="sub-last4"
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={cardLast4}
              onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, ''))}
              placeholder="4242"
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 font-mono text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="sub-exp"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              Card Expiry (MM/YY)
            </label>
            <input
              id="sub-exp"
              type="text"
              maxLength={7}
              value={cardExpiry}
              onChange={(e) => setCardExpiry(e.target.value)}
              placeholder="08/27"
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 font-mono text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]">
            Renewal Alert Window
          </span>
          <div className="grid grid-cols-4 gap-1.5">
            {REMINDER_DAY_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setReminderDays(days)}
                className={`min-h-[38px] rounded-full text-xs font-medium border transition-colors ${
                  reminderDays === days
                    ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF] border-transparent'
                    : 'bg-transparent text-[#444746] dark:text-[#C4C7C5] border-[#DADCE0] dark:border-[#444746] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]'
                }`}
              >
                {days === 0 ? 'Same day' : `${days}d before`}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="sub-url"
            className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
          >
            Manage / Cancel URL (optional)
          </label>
          <input
            id="sub-url"
            type="url"
            maxLength={300}
            value={manageUrl}
            onChange={(e) => setManageUrl(e.target.value)}
            placeholder="https://myaccount.google.com/subscriptions"
            className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="sub-notes"
            className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
          >
            Notes (optional)
          </label>
          <input
            id="sub-notes"
            type="text"
            maxLength={200}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Plan tier, seats, or account email"
            className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
          />
        </div>

        {initial?.priceHistory && initial.priceHistory.length > 1 && (
          <div className="rounded-2xl border border-[#E1E3E1] dark:border-[#444746] p-3 space-y-1">
            <span className="block text-[11px] font-medium text-[#444746] dark:text-[#C4C7C5]">
              Price Change History
            </span>
            <p className="text-xs font-mono tabular-nums text-[#1F1F1F] dark:text-[#E3E3E3]">
              {initial.priceHistory
                .map((h) => `${h.date}: ${formatCurrency(h.amount, currency)}`)
                .join(' → ')}
            </p>
          </div>
        )}

        <div className="space-y-1">
          <label className="flex items-center gap-3 min-h-[40px] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isTrial}
              onChange={(e) => setIsTrial(e.target.checked)}
              className="w-4 h-4 accent-[#B06000] dark:accent-[#FCD663]"
            />
            <span className="text-sm text-[#1F1F1F] dark:text-[#E3E3E3]">
              Free trial (highlight before conversion)
            </span>
          </label>

          <label className="flex items-center gap-3 min-h-[40px] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={usageStatus === 'underused'}
              onChange={(e) =>
                setUsageStatus(e.target.checked ? 'underused' : 'active')
              }
              className="w-4 h-4 accent-[#B3261E] dark:accent-[#F2B8B5]"
            />
            <span className="text-sm text-[#1F1F1F] dark:text-[#E3E3E3]">
              Flag as underused / candidate to cancel
            </span>
          </label>

          <label className="flex items-center gap-3 min-h-[40px] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 accent-[#0B57D0] dark:accent-[#A8C7FA]"
            />
            <span className="text-sm text-[#1F1F1F] dark:text-[#E3E3E3]">
              Active subscription (auto-renews)
            </span>
          </label>
        </div>

        <div className="flex items-center gap-3 pt-2">
          {initial && onDelete && (
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await onDelete(initial.id);
                onClose();
              }}
              className="min-h-[44px] px-4 rounded-full border border-[#F2B8B5] dark:border-[#8C1D18] text-[#B3261E] dark:text-[#F2B8B5] text-sm font-medium hover:bg-[#FCE8E6] dark:hover:bg-[#601410]/40 transition-colors"
            >
              Delete
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex-1 min-h-[44px] rounded-full hub-bg-accent text-sm font-medium hover:opacity-95 disabled:opacity-50"
          >
            {saving
              ? 'Encrypting...'
              : initial
                ? 'Save Subscription'
                : 'Add Subscription'}
          </button>
        </div>
      </form>
    </SheetShell>
  );
};

/* ---------------- Habit Modal (Google Calendar Goals Style) ---------------- */

const HABIT_CATEGORIES = [
  'Health',
  'Fitness',
  'Focus',
  'Mindfulness',
  'Learning',
  'Finance',
  'Personal',
];

const WEEKDAY_CIRCLE_OPTIONS = [
  { day: 0, short: 'S', label: 'Sunday' },
  { day: 1, short: 'M', label: 'Monday' },
  { day: 2, short: 'T', label: 'Tuesday' },
  { day: 3, short: 'W', label: 'Wednesday' },
  { day: 4, short: 'T', label: 'Thursday' },
  { day: 5, short: 'F', label: 'Friday' },
  { day: 6, short: 'S', label: 'Saturday' },
];

interface HabitModalProps {
  initial?: HabitRecord | null;
  onSave: (
    data: Omit<HabitRecord, 'id' | 'createdAt' | 'updatedAt' | 'logs'> & {
      id?: string;
    }
  ) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
}

export const HabitModal: React.FC<HabitModalProps> = ({
  initial,
  onSave,
  onDelete,
  onClose,
}) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [mode, setMode] = useState<HabitMode>(initial?.mode ?? 'build');
  const [cadence, setCadence] = useState<HabitCadence>(
    initial?.cadence ?? 'daily'
  );
  const [weeklyQuotaEnabled, setWeeklyQuotaEnabled] = useState(
    Boolean(initial?.weeklyQuota && initial.weeklyQuota > 0)
  );
  const [weeklyQuota, setWeeklyQuota] = useState(
    String(initial?.weeklyQuota ?? 3)
  );
  const [customMode, setCustomMode] = useState<HabitCustomMode>(
    initial?.customMode ?? 'weekdays'
  );
  const [customWeekdays, setCustomWeekdays] = useState<number[]>(
    initial?.customWeekdays && initial.customWeekdays.length > 0
      ? initial.customWeekdays
      : initial?.cadence === 'weekly'
        ? [new Date().getDay()]
        : [1, 3, 5]
  );
  const [intervalDays, setIntervalDays] = useState(
    String(initial?.intervalDays ?? 2)
  );
  const [startDate, setStartDate] = useState(
    initial?.startDate ?? getTodayISO()
  );
  const [monthlyDays, setMonthlyDays] = useState<number[]>(
    initial?.monthlyDays && initial.monthlyDays.length > 0
      ? initial.monthlyDays
      : [new Date().getDate()]
  );
  const [timeOfDay, setTimeOfDay] = useState<HabitTimeOfDay>(
    initial?.timeOfDay ?? 'anytime'
  );
  const [preferredTime, setPreferredTime] = useState(
    initial?.preferredTime ?? ''
  );
  const [category, setCategory] = useState(initial?.category ?? 'Health');
  const [color, setColor] = useState<CalendarColor>(initial?.color ?? 'green');
  const [targetPerDay, setTargetPerDay] = useState(
    String(initial?.targetPerDay ?? 1)
  );
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleWeekday = (day: number) => {
    setCustomWeekdays((prev) => {
      if (prev.includes(day)) {
        return prev.length > 1 ? prev.filter((d) => d !== day) : prev;
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  };

  const toggleMonthlyDay = (day: number) => {
    setMonthlyDays((prev) => {
      if (prev.includes(day)) {
        return prev.length > 1 ? prev.filter((d) => d !== day) : prev;
      }
      return [...prev, day];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Enter a habit goal name.');
      return;
    }
    const target = Math.max(1, parseInt(targetPerDay, 10) || 1);
    const interval = Math.max(1, parseInt(intervalDays, 10) || 2);
    const quota = weeklyQuotaEnabled
      ? Math.min(7, Math.max(1, parseInt(weeklyQuota, 10) || 3))
      : undefined;

    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        name: name.trim(),
        mode,
        cadence,
        weeklyQuota: quota,
        customWeekdays:
          !quota &&
          (cadence === 'weekly' ||
            (cadence === 'custom' && customMode === 'weekdays'))
            ? customWeekdays
            : undefined,
        customMode: !quota && cadence === 'custom' ? customMode : undefined,
        intervalDays:
          !quota && cadence === 'custom' && customMode === 'interval'
            ? interval
            : undefined,
        startDate:
          !quota && cadence === 'custom' && customMode === 'interval'
            ? startDate
            : initial?.startDate ?? getTodayISO(),
        monthlyDays: !quota && cadence === 'monthly' ? monthlyDays : undefined,
        timeOfDay,
        preferredTime: preferredTime || undefined,
        category,
        color,
        notes: notes.trim() || undefined,
        targetPerDay: target,
        unit: unit.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save habit.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetShell
      title={initial ? 'Edit Habit Goal' : 'New Habit Goal'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-xs text-[#B3261E] dark:text-[#F2B8B5]">{error}</p>
        )}

        {/* Build vs Quit Mode */}
        <div className="grid grid-cols-2 p-1 rounded-full border border-[#E1E3E1] dark:border-[#444746] bg-[#F8FAFD] dark:bg-[#131314]">
          <button
            type="button"
            onClick={() => setMode('build')}
            className={`min-h-[36px] rounded-full text-xs font-medium transition-colors ${
              mode === 'build'
                ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF]'
                : 'text-[#444746] dark:text-[#C4C7C5]'
            }`}
          >
            Build Positive
          </button>
          <button
            type="button"
            onClick={() => setMode('quit')}
            className={`min-h-[36px] rounded-full text-xs font-medium transition-colors ${
              mode === 'quit'
                ? 'bg-[#C4EED0] dark:bg-[#0F5223] text-[#072711] dark:text-[#C4EED0]'
                : 'text-[#444746] dark:text-[#C4C7C5]'
            }`}
          >
            Quit / Abstain
          </button>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="hab-name"
            className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
          >
            Goal Name
          </label>
          <input
            id="hab-name"
            type="text"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              mode === 'quit'
                ? 'e.g., No Sugar, Zero Social Scrolling, No Smoking'
                : 'e.g., Morning Run, Read 20 Pages, Hydrate'
            }
            autoFocus
            className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3] focus:outline-none focus:border-[#0B57D0] dark:focus:border-[#A8C7FA]"
          />
        </div>

        {/* Recurring Cadence Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#444746] dark:text-[#C4C7C5]">
              Recurring Schedule
            </span>
            <label className="inline-flex items-center gap-2 text-xs text-[#444746] dark:text-[#C4C7C5] cursor-pointer">
              <input
                type="checkbox"
                checked={weeklyQuotaEnabled}
                onChange={(e) => setWeeklyQuotaEnabled(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#0B57D0] dark:accent-[#A8C7FA]"
              />
              <span>Flexible X× / week</span>
            </label>
          </div>

          {weeklyQuotaEnabled ? (
            <div className="rounded-2xl bg-[#F8FAFD] dark:bg-[#282A2C] p-3 flex items-center justify-between gap-3">
              <span className="text-xs text-[#1F1F1F] dark:text-[#E3E3E3]">
                Complete on any{' '}
                <strong className="font-mono">{weeklyQuota}</strong> days per week
              </span>
              <select
                aria-label="Weekly quota days"
                value={weeklyQuota}
                onChange={(e) => setWeeklyQuota(e.target.value)}
                className="min-h-[36px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-white dark:bg-[#1E1F20] px-2.5 text-xs font-mono text-[#1F1F1F] dark:text-[#E3E3E3]"
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}× / week
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-1">
              {(
                [
                  { id: 'daily', label: 'Daily' },
                  { id: 'weekdays', label: 'Weekdays' },
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'monthly', label: 'Monthly' },
                  { id: 'custom', label: 'Custom' },
                ] as { id: HabitCadence; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCadence(opt.id)}
                  className={`min-h-[40px] px-1 rounded-full text-[11px] font-medium border transition-colors whitespace-nowrap ${
                    cadence === opt.id
                      ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF] border-transparent'
                      : 'bg-transparent text-[#444746] dark:text-[#C4C7C5] border-[#DADCE0] dark:border-[#444746] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Weekly or Custom-Weekdays Picker (Google Calendar style circle selector) */}
          {!weeklyQuotaEnabled &&
            (cadence === 'weekly' ||
              (cadence === 'custom' && customMode === 'weekdays')) && (
            <div className="rounded-2xl bg-[#F8FAFD] dark:bg-[#282A2C] p-3 space-y-2.5">
              {cadence === 'custom' && (
                <div className="flex items-center gap-1.5 pb-1">
                  <button
                    type="button"
                    onClick={() => setCustomMode('weekdays')}
                    className="min-h-[32px] px-3 rounded-full text-xs font-medium bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF]"
                  >
                    Specific weekdays
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomMode('interval')}
                    className="min-h-[32px] px-3 rounded-full text-xs font-medium text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#333537]"
                  >
                    Every N days
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between gap-1">
                {WEEKDAY_CIRCLE_OPTIONS.map((opt) => {
                  const active = customWeekdays.includes(opt.day);
                  return (
                    <button
                      key={opt.day}
                      type="button"
                      aria-label={opt.label}
                      aria-pressed={active}
                      onClick={() => toggleWeekday(opt.day)}
                      className={`w-9 h-9 rounded-full text-xs font-semibold transition-colors flex items-center justify-center ${
                        active
                          ? 'hub-bg-accent'
                          : 'bg-white dark:bg-[#1E1F20] border border-[#DADCE0] dark:border-[#444746] text-[#444746] dark:text-[#C4C7C5]'
                      }`}
                    >
                      {opt.short}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#444746] dark:text-[#C4C7C5]">
                Tap days of the week when this habit repeats.
              </p>
            </div>
          )}

          {/* Custom Interval (Every N Days) */}
          {!weeklyQuotaEnabled &&
            cadence === 'custom' &&
            customMode === 'interval' && (
            <div className="rounded-2xl bg-[#F8FAFD] dark:bg-[#282A2C] p-3 space-y-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCustomMode('weekdays')}
                  className="min-h-[32px] px-3 rounded-full text-xs font-medium text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#333537]"
                >
                  Specific weekdays
                </button>
                <button
                  type="button"
                  onClick={() => setCustomMode('interval')}
                  className="min-h-[32px] px-3 rounded-full text-xs font-medium bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF]"
                >
                  Every N days
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="hab-interval"
                    className="block text-[11px] text-[#444746] dark:text-[#C4C7C5]"
                  >
                    Repeat every (days)
                  </label>
                  <input
                    id="hab-interval"
                    type="number"
                    min="1"
                    max="90"
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(e.target.value)}
                    className="w-full min-h-[40px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-white dark:bg-[#1E1F20] px-3 font-mono tabular-nums text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="hab-start"
                    className="block text-[11px] text-[#444746] dark:text-[#C4C7C5]"
                  >
                    Anchor Start Date
                  </label>
                  <input
                    id="hab-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full min-h-[40px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-white dark:bg-[#1E1F20] px-2.5 text-xs text-[#1F1F1F] dark:text-[#E3E3E3]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Monthly Day-of-Month Selector */}
          {!weeklyQuotaEnabled && cadence === 'monthly' && (
            <div className="rounded-2xl bg-[#F8FAFD] dark:bg-[#282A2C] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#444746] dark:text-[#C4C7C5]">
                  Select day(s) of the month
                </span>
                <button
                  type="button"
                  onClick={() => toggleMonthlyDay(-1)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    monthlyDays.includes(-1)
                      ? 'hub-bg-accent'
                      : 'bg-white dark:bg-[#1E1F20] border border-[#DADCE0] dark:border-[#444746] text-[#444746] dark:text-[#C4C7C5]'
                  }`}
                >
                  Last day
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((dayNum) => {
                  const active = monthlyDays.includes(dayNum);
                  return (
                    <button
                      key={dayNum}
                      type="button"
                      onClick={() => toggleMonthlyDay(dayNum)}
                      className={`h-8 rounded-lg text-xs font-mono tabular-nums transition-colors ${
                        active
                          ? 'hub-bg-accent font-semibold'
                          : 'bg-white dark:bg-[#1E1F20] text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#333537]'
                      }`}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Google Calendar Goal Time-of-Day + Preferred Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label
              htmlFor="hab-tod"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              Time of Day
            </label>
            <select
              id="hab-tod"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value as HabitTimeOfDay)}
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-white dark:bg-[#1E1F20] px-3 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
            >
              <option value="anytime">Anytime</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="hab-pref-time"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              Target Time (optional)
            </label>
            <input
              id="hab-pref-time"
              type="time"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
            />
          </div>
        </div>

        {/* Category + Color */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
          <div className="space-y-1.5">
            <label
              htmlFor="hab-cat"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              Focus Area
            </label>
            <select
              id="hab-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-white dark:bg-[#1E1F20] px-3 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
            >
              {HABIT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]">
              Accent Color
            </span>
            <div className="flex items-center gap-2 min-h-[44px]">
              {CALENDAR_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-label={c.label}
                  onClick={() => setColor(c.id)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-transform ${
                    color === c.id
                      ? 'border-[#1F1F1F] dark:border-[#E3E3E3] scale-110'
                      : 'border-transparent'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full ${c.swatchClass}`} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Daily Target + Unit */}
        <div className="grid grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label
              htmlFor="hab-target"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              Daily Target
            </label>
            <input
              id="hab-target"
              type="number"
              min="1"
              max="100"
              value={targetPerDay}
              onChange={(e) => setTargetPerDay(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 font-mono tabular-nums text-sm text-[#1F1F1F] dark:text-[#E3E3E3] focus:outline-none focus:border-[#0B57D0] dark:focus:border-[#A8C7FA]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="hab-unit"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              Unit (optional)
            </label>
            <input
              id="hab-unit"
              type="text"
              maxLength={24}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g., glasses, min"
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3] focus:outline-none focus:border-[#0B57D0] dark:focus:border-[#A8C7FA]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="hab-notes"
            className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
          >
            Cue or Note (optional)
          </label>
          <input
            id="hab-notes"
            type="text"
            maxLength={200}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Right after morning coffee"
            className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          {initial && onDelete && (
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await onDelete(initial.id);
                onClose();
              }}
              className="min-h-[44px] px-4 rounded-full border border-[#F2B8B5] dark:border-[#8C1D18] text-[#B3261E] dark:text-[#F2B8B5] text-sm font-medium hover:bg-[#FCE8E6] dark:hover:bg-[#601410]/40 transition-colors"
            >
              Delete
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex-1 min-h-[44px] rounded-full hub-bg-accent text-sm font-medium hover:opacity-95 disabled:opacity-50 transition-opacity"
          >
            {saving
              ? 'Encrypting...'
              : initial
                ? 'Save Habit'
                : 'Create Goal'}
          </button>
        </div>
      </form>
    </SheetShell>
  );
};

/* ---------------- Google Tasks Modal ---------------- */

interface TaskModalProps {
  initial?: TaskRecord | null;
  defaultListId?: string;
  taskLists: TaskListRecord[];
  onSave: (
    data: Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  initial,
  defaultListId,
  taskLists,
  onSave,
  onDelete,
  onClose,
}) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [listId, setListId] = useState(
    initial?.listId ?? defaultListId ?? DEFAULT_TASK_LIST_ID
  );
  const [starred, setStarred] = useState(initial?.starred ?? false);
  const [priority, setPriority] = useState<TaskPriority>(
    initial?.priority ?? 'medium'
  );
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');
  const [dueTime, setDueTime] = useState(initial?.dueTime ?? '');
  const [repeat, setRepeat] = useState<RecurrenceCycle>(
    initial?.repeat ?? 'none'
  );
  const [estimateMinutes, setEstimateMinutes] = useState(
    initial?.estimateMinutes ? String(initial.estimateMinutes) : ''
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [subtasks, setSubtasks] = useState<TaskSubItem[]>(
    initial?.subtasks ?? []
  );
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addSubtask = () => {
    if (!newSubtaskText.trim()) return;
    setSubtasks((prev) => [
      ...prev,
      {
        id: `sub_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
        text: newSubtaskText.trim(),
        done: false,
      },
    ]);
    setNewSubtaskText('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) {
      setError('Enter a task title.');
      return;
    }
    const parsedEst = parseInt(estimateMinutes, 10);
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        listId,
        title: title.trim(),
        completed: initial?.completed ?? false,
        starred,
        priority,
        dueDate: dueDate || undefined,
        dueTime: dueDate && dueTime ? dueTime : undefined,
        repeat,
        estimateMinutes:
          Number.isFinite(parsedEst) && parsedEst > 0 ? parsedEst : undefined,
        notes: notes.trim() || undefined,
        subtasks: subtasks.length > 0 ? subtasks : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetShell
      title={initial ? 'Edit Task' : 'New Task'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-xs text-[#B3261E] dark:text-[#F2B8B5]">{error}</p>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <label
              htmlFor="tsk-title"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              Title
            </label>
            <input
              id="tsk-title"
              type="text"
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to get done?"
              autoFocus
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3] focus:outline-none focus:border-[#0B57D0] dark:focus:border-[#A8C7FA]"
            />
          </div>
          <button
            type="button"
            onClick={() => setStarred((s) => !s)}
            aria-label={starred ? 'Remove from Starred' : 'Add to Starred'}
            className={`min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center transition-colors ${
              starred
                ? 'border-[#0B57D0] dark:border-[#A8C7FA] bg-[#C2E7FF] dark:bg-[#004A77] text-[#0B57D0] dark:text-[#A8C7FA]'
                : 'border-[#DADCE0] dark:border-[#444746] text-[#444746] dark:text-[#C4C7C5]'
            }`}
          >
            <Star className={`w-4 h-4 ${starred ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label
              htmlFor="tsk-list"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              Task List
            </label>
            <select
              id="tsk-list"
              value={listId}
              onChange={(e) => setListId(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-white dark:bg-[#1E1F20] px-3 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
            >
              <option value={DEFAULT_TASK_LIST_ID}>My Tasks</option>
              {taskLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="tsk-repeat"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              Repeat
            </label>
            <select
              id="tsk-repeat"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value as RecurrenceCycle)}
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-white dark:bg-[#1E1F20] px-3 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
            >
              {RECURRENCE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Google Tasks Quick Date Chips + Date/Time Picker */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#444746] dark:text-[#C4C7C5]">
              Date & Time
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setDueDate(getTodayISO())}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#E9EEF6] dark:bg-[#282A2C] text-[#1F1F1F] dark:text-[#E3E3E3] hover:bg-[#C2E7FF] dark:hover:bg-[#004A77]"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDueDate(getOffsetDateISO(1))}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#E9EEF6] dark:bg-[#282A2C] text-[#1F1F1F] dark:text-[#E3E3E3] hover:bg-[#C2E7FF] dark:hover:bg-[#004A77]"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setDueDate(getOffsetDateISO(7))}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#E9EEF6] dark:bg-[#282A2C] text-[#1F1F1F] dark:text-[#E3E3E3] hover:bg-[#C2E7FF] dark:hover:bg-[#004A77]"
              >
                Next week
              </button>
              {dueDate && (
                <button
                  type="button"
                  onClick={() => {
                    setDueDate('');
                    setDueTime('');
                  }}
                  className="px-2 py-1 text-[11px] text-[#747775] hover:text-[#B3261E]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              aria-label="Due date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
            />
            <input
              aria-label="Due time"
              type="time"
              value={dueTime}
              disabled={!dueDate}
              onChange={(e) => setDueTime(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3] disabled:opacity-40"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]">
              Priority
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(['low', 'medium', 'high'] as TaskPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`min-h-[42px] rounded-full text-xs font-medium capitalize border transition-colors ${
                    priority === p
                      ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF] border-transparent'
                      : 'bg-transparent text-[#444746] dark:text-[#C4C7C5] border-[#DADCE0] dark:border-[#444746] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="tsk-est"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              Estimate (min{initial?.focusedMinutes ? ` · ${initial.focusedMinutes}m logged` : ''})
            </label>
            <input
              id="tsk-est"
              type="number"
              min="5"
              max="600"
              step="5"
              value={estimateMinutes}
              onChange={(e) => setEstimateMinutes(e.target.value)}
              placeholder="e.g., 25"
              className="w-full min-h-[42px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 font-mono text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
            />
          </div>
        </div>

        <div className="space-y-2">
          <span className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]">
            Subtasks ({subtasks.length})
          </span>
          {subtasks.length > 0 && (
            <div className="space-y-1.5">
              {subtasks.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center gap-2 rounded-xl border border-[#E1E3E1] dark:border-[#444746] px-3 py-1.5"
                >
                  <input
                    type="checkbox"
                    checked={sub.done}
                    onChange={() =>
                      setSubtasks((prev) =>
                        prev.map((s) =>
                          s.id === sub.id ? { ...s, done: !s.done } : s
                        )
                      )
                    }
                    className="w-4 h-4 accent-[#0B57D0] dark:accent-[#A8C7FA]"
                  />
                  <span
                    className={`flex-1 text-sm ${
                      sub.done
                        ? 'line-through text-[#747775]'
                        : 'text-[#1F1F1F] dark:text-[#E3E3E3]'
                    }`}
                  >
                    {sub.text}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove subtask"
                    onClick={() =>
                      setSubtasks((prev) => prev.filter((s) => s.id !== sub.id))
                    }
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#747775] hover:text-[#B3261E]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newSubtaskText}
              onChange={(e) => setNewSubtaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSubtask();
                }
              }}
              placeholder="Add subtask..."
              className="flex-1 min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
            />
            <button
              type="button"
              onClick={addSubtask}
              aria-label="Add subtask"
              className="min-h-[44px] min-w-[44px] rounded-xl bg-[#E9EEF6] dark:bg-[#282A2C] flex items-center justify-center text-[#1F1F1F] dark:text-[#E3E3E3]"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="tsk-notes"
            className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
          >
            Details (optional)
          </label>
          <textarea
            id="tsk-notes"
            rows={2}
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add details or notes"
            className="w-full rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent p-3 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          {initial && onDelete && (
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await onDelete(initial.id);
                onClose();
              }}
              className="min-h-[44px] px-4 rounded-full border border-[#F2B8B5] dark:border-[#8C1D18] text-[#B3261E] dark:text-[#F2B8B5] text-sm font-medium hover:bg-[#FCE8E6] dark:hover:bg-[#601410]/40"
            >
              Delete
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex-1 min-h-[44px] rounded-full hub-bg-accent text-sm font-medium hover:opacity-95 disabled:opacity-50"
          >
            {saving ? 'Encrypting...' : initial ? 'Save Task' : 'Save'}
          </button>
        </div>
      </form>
    </SheetShell>
  );
};

/* ---------------- Calendar Event Modal ---------------- */

interface CalendarEventModalProps {
  initial?: CalendarEventRecord | null;
  defaultDate?: string;
  onSave: (
    data: Omit<CalendarEventRecord, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    }
  ) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
}

export const CalendarEventModal: React.FC<CalendarEventModalProps> = ({
  initial,
  defaultDate,
  onSave,
  onDelete,
  onClose,
}) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [date, setDate] = useState(
    initial?.date ?? defaultDate ?? getTodayISO()
  );
  const [allDay, setAllDay] = useState(initial?.allDay ?? false);
  const [startTime, setStartTime] = useState(initial?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(initial?.endTime ?? '10:00');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [color, setColor] = useState<CalendarColor>(initial?.color ?? 'blue');
  const [repeat, setRepeat] = useState<RecurrenceCycle>(
    initial?.repeat ?? 'none'
  );
  const [reminderOffsetMinutes, setReminderOffsetMinutes] = useState<number>(
    initial?.reminderOffsetMinutes ?? 0
  );
  const [isMilestone, setIsMilestone] = useState(
    initial?.isMilestone ?? false
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) {
      setError('Add an event title.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        title: title.trim(),
        date,
        allDay,
        startTime: allDay ? undefined : startTime,
        endTime: allDay ? undefined : endTime,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        color,
        repeat,
        reminderOffsetMinutes,
        isMilestone,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save event.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetShell
      title={initial ? 'Edit Event' : 'New Calendar Event'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-xs text-[#B3261E] dark:text-[#F2B8B5]">{error}</p>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="cal-title"
            className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
          >
            Event Title
          </label>
          <input
            id="cal-title"
            type="text"
            maxLength={140}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add title"
            autoFocus
            className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3] focus:outline-none focus:border-[#0B57D0] dark:focus:border-[#A8C7FA]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label
              htmlFor="cal-date"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              Date
            </label>
            <input
              id="cal-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="cal-repeat"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              Repeat
            </label>
            <select
              id="cal-repeat"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value as RecurrenceCycle)}
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-white dark:bg-[#1E1F20] px-3 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
            >
              {RECURRENCE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-3 min-h-[40px] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="w-4 h-4 accent-[#0B57D0] dark:accent-[#A8C7FA]"
          />
          <span className="text-sm text-[#1F1F1F] dark:text-[#E3E3E3]">
            All-day event
          </span>
        </label>

        {!allDay && (
          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label
                htmlFor="cal-start"
                className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
              >
                Start Time
              </label>
              <input
                id="cal-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="cal-end"
                className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
              >
                End Time
              </label>
              <input
                id="cal-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center">
          <div className="space-y-1.5">
            <label
              htmlFor="cal-alert"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              Reminder Alert
            </label>
            <select
              id="cal-alert"
              value={reminderOffsetMinutes}
              onChange={(e) => setReminderOffsetMinutes(Number(e.target.value))}
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-white dark:bg-[#1E1F20] px-3 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
            >
              <option value={0}>At time of event</option>
              <option value={10}>10 minutes before</option>
              <option value={30}>30 minutes before</option>
              <option value={60}>1 hour before</option>
              <option value={1440}>1 day before</option>
            </select>
          </div>

          <label className="flex items-center gap-3 min-h-[44px] sm:pt-5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isMilestone}
              onChange={(e) => setIsMilestone(e.target.checked)}
              className="w-4 h-4 accent-[#0B57D0] dark:accent-[#A8C7FA]"
            />
            <span className="text-sm text-[#1F1F1F] dark:text-[#E3E3E3]">
              Milestone countdown (D-day)
            </span>
          </label>
        </div>

        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]">
            Color
          </span>
          <div className="flex items-center gap-2.5">
            {CALENDAR_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-label={c.label}
                onClick={() => setColor(c.id)}
                className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-transform ${
                  color === c.id
                    ? 'border-[#1F1F1F] dark:border-[#E3E3E3] scale-110'
                    : 'border-transparent'
                }`}
              >
                <span className={`w-6 h-6 rounded-full ${c.swatchClass}`} />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="cal-loc"
            className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
          >
            Location or Link (optional)
          </label>
          <input
            id="cal-loc"
            type="text"
            maxLength={140}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Add location or meeting link"
            className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="cal-notes"
            className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
          >
            Description (optional)
          </label>
          <textarea
            id="cal-notes"
            rows={2}
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add description"
            className="w-full rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent p-3 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          {initial && onDelete && (
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await onDelete(initial.id);
                onClose();
              }}
              className="min-h-[44px] px-4 rounded-full border border-[#F2B8B5] dark:border-[#8C1D18] text-[#B3261E] dark:text-[#F2B8B5] text-sm font-medium hover:bg-[#FCE8E6] dark:hover:bg-[#601410]/40"
            >
              Delete
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex-1 min-h-[44px] rounded-full hub-bg-accent text-sm font-medium hover:opacity-95 disabled:opacity-50"
          >
            {saving ? 'Encrypting...' : initial ? 'Save Event' : 'Save'}
          </button>
        </div>
      </form>
    </SheetShell>
  );
};
