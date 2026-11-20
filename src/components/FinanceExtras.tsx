import React, { useState } from 'react';
import { Camera, ChevronDown, X } from 'lucide-react';
import { formatCurrency } from '../lib/format';
import type { PurchaseRecord, SubscriptionRecord } from '../types';

const label = 'block text-[11px] font-medium text-[#444746] dark:text-[#C4C7C5]';
const input =
  'w-full min-h-[40px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3 text-sm';

/** Shrink an image to a JPEG data URL under `maxChars` (fits the 32 KB sync limit). */
export async function compressReceipt(file: File, maxChars = 16000): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not read image'));
      i.src = url;
    });
    let width = 360;
    let quality = 0.6;
    for (let attempt = 0; attempt < 8; attempt++) {
      const scale = Math.min(1, width / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL('image/jpeg', quality);
      if (data.length <= maxChars) return data;
      width = Math.round(width * 0.82);
      quality = Math.max(0.35, quality - 0.06);
    }
    throw new Error('Receipt image is too detailed to store — try a closer crop.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

const Collapsible: React.FC<{ title: string; summary?: string; defaultOpen?: boolean; children: React.ReactNode }> = ({
  title,
  summary,
  defaultOpen = false,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-[#E1E3E1] dark:border-[#444746]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full min-h-[44px] px-3.5 flex items-center justify-between gap-2 text-left"
      >
        <span className="text-xs font-medium">{title}</span>
        <span className="flex items-center gap-2 min-w-0">
          {summary && !open && (
            <span className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6] truncate">{summary}</span>
          )}
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && <div className="px-3.5 pb-3.5 space-y-3">{children}</div>}
    </div>
  );
};

// ------------------------------------------------------------------ Purchase

export type PurchaseExtrasValue = Pick<
  PurchaseRecord,
  'fxAmount' | 'fxCurrency' | 'fxRate' | 'splitWays' | 'splitWith' | 'receiptThumb'
>;

export const PurchaseExtras: React.FC<{
  value: PurchaseExtrasValue;
  onChange: (v: PurchaseExtrasValue) => void;
  amount: number;
  onAmount: (base: number) => void;
  currency: string;
  isExpense: boolean;
}> = ({ value, onChange, amount, onAmount, currency, isExpense }) => {
  const [err, setErr] = useState('');
  const set = (p: Partial<PurchaseExtrasValue>) => onChange({ ...value, ...p });
  const recompute = (fxAmount?: number, fxRate?: number) => {
    if (fxAmount && fxRate) onAmount(Math.round(fxAmount * fxRate * 100) / 100);
  };
  const ways = value.splitWays ?? 1;
  const summary = [
    value.fxAmount ? `${value.fxAmount} ${value.fxCurrency ?? ''}` : '',
    ways > 1 ? `split ${ways}` : '',
    value.receiptThumb ? 'receipt' : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Collapsible title="More options" summary={summary} defaultOpen={Boolean(summary)}>
      {/* Foreign currency */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1 col-span-1">
          <label htmlFor="fx-amt" className={label}>Paid (foreign)</label>
          <input
            id="fx-amt"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={value.fxAmount ?? ''}
            onChange={(e) => {
              const v = parseFloat(e.target.value) || undefined;
              set({ fxAmount: v });
              recompute(v, value.fxRate);
            }}
            className={`${input} font-mono`}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="fx-cur" className={label}>Currency</label>
          <input
            id="fx-cur"
            type="text"
            maxLength={4}
            placeholder="EUR"
            value={value.fxCurrency ?? ''}
            onChange={(e) => set({ fxCurrency: e.target.value.toUpperCase() })}
            className={`${input} uppercase`}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="fx-rate" className={label}>Rate → {currency}</label>
          <input
            id="fx-rate"
            type="number"
            min="0"
            step="0.0001"
            inputMode="decimal"
            value={value.fxRate ?? ''}
            onChange={(e) => {
              const v = parseFloat(e.target.value) || undefined;
              set({ fxRate: v });
              recompute(value.fxAmount, v);
            }}
            className={`${input} font-mono`}
          />
        </div>
      </div>

      {/* Split */}
      {isExpense && (
        <div className="grid grid-cols-[auto_1fr] gap-2 items-end">
          <div className="space-y-1">
            <label htmlFor="split-ways" className={label}>Split between</label>
            <select
              id="split-ways"
              value={ways}
              onChange={(e) => set({ splitWays: Number(e.target.value) })}
              className={`${input} bg-white dark:bg-[#1E1F20]`}
            >
              {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? 'Just me' : `${n} people`}
                </option>
              ))}
            </select>
          </div>
          {ways > 1 && (
            <div className="space-y-1">
              <label htmlFor="split-with" className={label}>
                With · they owe {formatCurrency((amount * (ways - 1)) / ways, currency)}
              </label>
              <input
                id="split-with"
                type="text"
                maxLength={80}
                placeholder="Names"
                value={value.splitWith ?? ''}
                onChange={(e) => set({ splitWith: e.target.value })}
                className={input}
              />
            </div>
          )}
        </div>
      )}

      {/* Receipt */}
      <div className="flex items-center gap-3">
        {value.receiptThumb ? (
          <span className="relative">
            <img src={value.receiptThumb} alt="Receipt" className="h-16 w-16 object-cover rounded-lg border border-[#E1E3E1] dark:border-[#444746]" />
            <button
              type="button"
              aria-label="Remove receipt"
              onClick={() => set({ receiptThumb: undefined })}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#202124] text-white flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        ) : null}
        <label className="min-h-[38px] px-3.5 rounded-full border border-[#DADCE0] dark:border-[#444746] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer">
          <Camera className="w-3.5 h-3.5" />
          {value.receiptThumb ? 'Replace receipt' : 'Add receipt photo'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              setErr('');
              try {
                set({ receiptThumb: await compressReceipt(f) });
              } catch (er) {
                setErr(er instanceof Error ? er.message : 'Could not add receipt');
              }
            }}
          />
        </label>
        {err && <span className="text-[11px] text-[#C5221F]">{err}</span>}
      </div>
    </Collapsible>
  );
};

// -------------------------------------------------------------- Subscription

export type SubscriptionExtrasValue = Pick<
  SubscriptionRecord,
  'seats' | 'annualPrice' | 'variableAmount' | 'cancelledOn' | 'cancelRef'
>;

export const SubscriptionExtras: React.FC<{
  value: SubscriptionExtrasValue;
  onChange: (v: SubscriptionExtrasValue) => void;
  amount: number;
  billingCycle: SubscriptionRecord['billingCycle'];
  active: boolean;
  currency: string;
  recentPayments: number[]; // newest first
}> = ({ value, onChange, amount, billingCycle, active, currency, recentPayments }) => {
  const set = (p: Partial<SubscriptionExtrasValue>) => onChange({ ...value, ...p });
  const seats = value.seats ?? 1;
  const perYear =
    billingCycle === 'weekly' ? amount * 52 : billingCycle === 'monthly' ? amount * 12 : billingCycle === 'quarterly' ? amount * 4 : amount;
  const annualSaving = value.annualPrice && billingCycle !== 'yearly' ? perYear - value.annualPrice : 0;
  const avg3 =
    recentPayments.length > 0
      ? recentPayments.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, recentPayments.length)
      : 0;
  const summary = [seats > 1 ? `${seats} seats` : '', value.annualPrice ? 'annual price' : '', value.variableAmount ? 'variable' : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <Collapsible title="More options" summary={summary} defaultOpen={Boolean(summary) || !active}>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label htmlFor="sub-seats" className={label}>Shared by</label>
          <select
            id="sub-seats"
            value={seats}
            onChange={(e) => set({ seats: Number(e.target.value) })}
            className={`${input} bg-white dark:bg-[#1E1F20]`}
          >
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? 'Just me' : `${n} people`}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="sub-annual" className={label}>Yearly plan price</label>
          <input
            id="sub-annual"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={value.annualPrice ?? ''}
            onChange={(e) => set({ annualPrice: parseFloat(e.target.value) || undefined })}
            className={`${input} font-mono`}
          />
        </div>
      </div>
      {(seats > 1 || annualSaving > 0) && (
        <p className="text-[11px] text-[#444746] dark:text-[#C4C7C5]">
          {seats > 1 && `Your share ${formatCurrency(amount / seats, currency)} · others owe ${formatCurrency((amount * (seats - 1)) / seats, currency)} per bill. `}
          {annualSaving > 0 && `Yearly billing saves ${formatCurrency(annualSaving, currency)}/yr.`}
        </p>
      )}

      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={Boolean(value.variableAmount)}
          onChange={(e) => set({ variableAmount: e.target.checked })}
          className="w-4 h-4 accent-[var(--hub-accent)]"
        />
        Amount varies (utility bill)
        {value.variableAmount && avg3 > 0 && (
          <span className="text-[#5F6368] dark:text-[#9AA0A6]">· avg of last {Math.min(3, recentPayments.length)}: {formatCurrency(avg3, currency)}</span>
        )}
      </label>

      {!active && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="space-y-1">
            <label htmlFor="sub-cancel-date" className={label}>Cancelled on</label>
            <input
              id="sub-cancel-date"
              type="date"
              value={value.cancelledOn ?? ''}
              onChange={(e) => set({ cancelledOn: e.target.value || undefined })}
              className={`${input} font-mono`}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="sub-cancel-ref" className={label}>Confirmation #</label>
            <input
              id="sub-cancel-ref"
              type="text"
              maxLength={120}
              value={value.cancelRef ?? ''}
              onChange={(e) => set({ cancelRef: e.target.value })}
              className={input}
            />
          </div>
        </div>
      )}
    </Collapsible>
  );
};
