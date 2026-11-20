import React, { useEffect, useState } from 'react';
import { Database, Download, RefreshCw } from 'lucide-react';
import { useVault, type BackupModule } from '../context/VaultContext';
import { getAllLocalRecords } from '../lib/indexeddb';
import type { VaultRecordKind } from '../types';
import { t } from '../lib/i18n';

const MODULES: { id: BackupModule; label: string }[] = [
  { id: 'purchases', label: 'Purchases' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'habits', label: 'Habits' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'events', label: 'Events' },
  { id: 'goals', label: 'Goals' },
];

const KIND_LABEL: Record<VaultRecordKind, string> = {
  purchase: 'Purchases',
  subscription: 'Subscriptions',
  habit: 'Habits',
  task: 'Tasks',
  tasklist: 'Task lists',
  calendar: 'Events',
  goal: 'Goals',
  prefs: 'Settings',
};

const kb = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`);

export function isBackupDue(prefs: { backupReminderDays?: number; lastBackupAt?: number }): boolean {
  const days = prefs.backupReminderDays ?? 0;
  if (days <= 0) return false;
  return Date.now() - (prefs.lastBackupAt ?? 0) > days * 86_400_000;
}

export const DataSettings: React.FC = () => {
  const {
    preferences,
    updatePreferences,
    exportPlaintextBackup,
    syncStatus,
    triggerSyncNow,
    user,
    isOnline,
    purchases,
    tasks,
    habits,
    goals,
    calendarEvents,
  } = useVault();
  const [stats, setStats] = useState<{ kind: VaultRecordKind; count: number; bytes: number }[]>([]);
  const [pending, setPending] = useState<{ id: string; kind: VaultRecordKind; deleted: boolean }[]>([]);
  const [selected, setSelected] = useState<BackupModule[]>([]);
  const [showQueue, setShowQueue] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getAllLocalRecords().then((recs) => {
      if (cancelled) return;
      const map = new Map<VaultRecordKind, { count: number; bytes: number }>();
      for (const r of recs) {
        if (r.deleted) continue;
        const cur = map.get(r.kind) ?? { count: 0, bytes: 0 };
        cur.count++;
        cur.bytes += r.ciphertext.length + r.iv.length;
        map.set(r.kind, cur);
      }
      setStats([...map.entries()].map(([kind, v]) => ({ kind, ...v })).sort((a, b) => b.bytes - a.bytes));
      setPending(recs.filter((r) => r.syncState === 'pending').map((r) => ({ id: r.id, kind: r.kind, deleted: r.deleted })));
    });
    return () => {
      cancelled = true;
    };
    // Recount whenever data or sync state changes
  }, [purchases, tasks, habits, goals, calendarEvents, preferences, syncStatus.lastSyncedAt]);

  const total = stats.reduce((s, x) => s + x.bytes, 0);
  const max = Math.max(1, ...stats.map((s) => s.bytes));

  const exportSelected = () => {
    const json = exportPlaintextBackup(selected);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mmv-hub-${selected.length ? selected.join('-') : 'all'}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const chip = (on: boolean) =>
    `min-h-[34px] px-3 rounded-full text-xs font-medium border transition-colors ${
      on ? 'hub-bg-soft border-transparent' : 'border-[#DADCE0] dark:border-[#444746] text-[#5F6368] dark:text-[#9AA0A6]'
    }`;

  return (
    <section
      id="settings-data"
      className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-5 sm:p-6 space-y-4 scroll-mt-20"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#1F1F1F] dark:text-[#E3E3E3]">
          <Database className="w-4 h-4 hub-text-accent" />
          {t('settings.data')}
        </h2>
        <span className="text-xs font-mono text-[#5F6368] dark:text-[#9AA0A6]">{kb(total)} encrypted</span>
      </div>

      {/* Storage meter */}
      <ul className="space-y-1.5">
        {stats.map((s) => (
          <li key={s.kind} className="grid grid-cols-[96px_1fr_auto] items-center gap-2 text-xs">
            <span className="text-[#444746] dark:text-[#C4C7C5] truncate">{KIND_LABEL[s.kind]}</span>
            <span className="h-1.5 rounded-full bg-[#E8EAED] dark:bg-[#282A2C] overflow-hidden">
              <span className="block h-full rounded-full hub-bg-accent" style={{ width: `${(s.bytes / max) * 100}%` }} />
            </span>
            <span className="font-mono text-[11px] text-[#5F6368] dark:text-[#9AA0A6] tabular-nums">
              {s.count} · {kb(s.bytes)}
            </span>
          </li>
        ))}
      </ul>

      {/* Sync queue */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#F0F4F9] dark:border-[#282A2C]">
        <button type="button" className="text-left" onClick={() => setShowQueue((v) => !v)}>
          <p className="text-sm font-medium">Sync queue</p>
          <p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
            {!user ? 'Local only' : pending.length === 0 ? 'All synced' : `${pending.length} waiting · tap to view`}
          </p>
        </button>
        {user && (
          <button
            type="button"
            disabled={!isOnline || syncStatus.phase === 'syncing'}
            onClick={() => void triggerSyncNow()}
            className="min-h-[36px] px-3.5 rounded-full border border-[#DADCE0] dark:border-[#444746] text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.phase === 'syncing' ? 'animate-spin' : ''}`} />
            Sync now
          </button>
        )}
      </div>
      {showQueue && pending.length > 0 && (
        <ul className="text-[11px] font-mono text-[#5F6368] dark:text-[#9AA0A6] space-y-0.5 max-h-32 overflow-y-auto">
          {pending.slice(0, 50).map((p) => (
            <li key={p.id}>
              {KIND_LABEL[p.kind]} · {p.deleted ? 'delete' : 'update'} · {p.id.slice(0, 18)}…
            </li>
          ))}
        </ul>
      )}
      {syncStatus.errorMessage && (
        <p className="text-[11px] text-[#C5221F] dark:text-[#F28B82]">{syncStatus.errorMessage}</p>
      )}

      {/* Selective export */}
      <div className="space-y-2 pt-3 border-t border-[#F0F4F9] dark:border-[#282A2C]">
        <p className="text-sm font-medium">Export</p>
        <div className="flex flex-wrap gap-2">
          {MODULES.map((m) => {
            const on = selected.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={on}
                className={chip(on)}
                onClick={() => setSelected((prev) => (on ? prev.filter((x) => x !== m.id) : [...prev, m.id]))}
              >
                {m.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={exportSelected}
          className="min-h-[38px] px-4 rounded-full hub-bg-accent text-xs font-medium inline-flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          {selected.length === 0 ? 'Export everything' : `Export ${selected.length} selected`}
        </button>
      </div>

      {/* Backup reminder */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#F0F4F9] dark:border-[#282A2C]">
        <div>
          <p className="text-sm font-medium">Backup reminder</p>
          <p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
            Last: {preferences.lastBackupAt ? new Date(preferences.lastBackupAt).toLocaleDateString() : 'never'}
          </p>
        </div>
        <select
          aria-label="Backup reminder"
          value={preferences.backupReminderDays ?? 0}
          onChange={(e) => void updatePreferences({ backupReminderDays: Number(e.target.value) })}
          className="min-h-[38px] rounded-full border border-[#DADCE0] dark:border-[#444746] bg-white dark:bg-[#1E1F20] px-3 text-xs"
        >
          <option value={0}>Off</option>
          <option value={7}>Weekly</option>
          <option value={14}>Every 2 weeks</option>
          <option value={30}>Monthly</option>
        </select>
      </div>
    </section>
  );
};
