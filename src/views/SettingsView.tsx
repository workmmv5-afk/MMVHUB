import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
  Check,
  Cloud,
  Database,
  Download,
  KeyRound,
  LayoutGrid,
  Lock,
  Palette,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { NotificationCustomizer } from '../components/NotificationCustomizer';
import { WidgetCustomizer } from '../components/WidgetCustomizer';
import { getWidgetMeta, resolveHomeWidgets } from '../lib/homeWidgets';
import {
  collectDueReminders,
  getNotificationPermission,
  requestNotificationPermission,
} from '../lib/notifications';
import type {
  AccentTheme,
  PurchaseCategory,
  ThemeMode,
  UiDensity,
} from '../types';

export type SettingsSection = 'themes' | 'notifications' | 'widgets';

interface SettingsViewProps {
  focusSection?: SettingsSection | null;
  focusSignal?: number;
}

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

const ACCENT_THEMES: {
  id: AccentTheme;
  label: string;
  lightSwatch: string;
  darkSwatch: string;
}[] = [
  {
    id: 'blue',
    label: 'Google Blue',
    lightSwatch: '#1A73E8',
    darkSwatch: '#8AB4F8',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    lightSwatch: '#146C2E',
    darkSwatch: '#81C995',
  },
  {
    id: 'slate',
    label: 'Slate',
    lightSwatch: '#202124',
    darkSwatch: '#E8EAED',
  },
  {
    id: 'plum',
    label: 'Plum',
    lightSwatch: '#6750A4',
    darkSwatch: '#D0BCFF',
  },
  {
    id: 'amber',
    label: 'Amber',
    lightSwatch: '#B06000',
    darkSwatch: '#FDD663',
  },
  {
    id: 'crimson',
    label: 'Crimson',
    lightSwatch: '#C5221F',
    darkSwatch: '#F28B82',
  },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  focusSection = null,
  focusSignal = 0,
}) => {
  const {
    vaultMeta,
    user,
    isOnline,
    syncStatus,
    theme,
    setTheme,
    accentTheme,
    setAccentTheme,
    purchases,
    subscriptions,
    habits,
    tasks,
    calendarEvents,
    preferences,
    updatePreferences,
    sendTestNotification,
    runReminderSweepNow,
    lockVault,
    signInWithGoogle,
    signOutGoogle,
    triggerSyncNow,
    changeVaultPassphrase,
    exportEncryptedBackup,
    exportPlaintextBackup,
    importPlaintextBackup,
    wipeLocalVault,
  } = useVault();

  const [currency, setCurrency] = useState(preferences.currency);
  const [budget, setBudget] = useState(String(preferences.monthlyBudget));
  const [savingsGoal, setSavingsGoal] = useState(
    String(preferences.monthlySavingsGoal ?? 500)
  );
  const [autoLock, setAutoLock] = useState(String(preferences.autoLockMinutes));
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, string>>(
    () => {
      const init: Record<string, string> = {};
      for (const c of PURCHASE_CATEGORIES) {
        const val = preferences.categoryBudgets?.[c];
        init[c] = val ? String(val) : '';
      }
      return init;
    }
  );
  const [showCategoryBudgets, setShowCategoryBudgets] = useState(false);

  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [notifPerm, setNotifPerm] = useState<
    NotificationPermission | 'unsupported'
  >(() => getNotificationPermission());

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const themesSectionRef = useRef<HTMLElement | null>(null);
  const notificationsSectionRef = useRef<HTMLElement | null>(null);
  const widgetsSectionRef = useRef<HTMLElement | null>(null);
  const [widgetCustomizerOpen, setWidgetCustomizerOpen] = useState(false);
  const homeWidgets = useMemo(
    () => resolveHomeWidgets(preferences),
    [preferences]
  );

  useEffect(() => {
    setCurrency(preferences.currency);
    setBudget(String(preferences.monthlyBudget));
    setSavingsGoal(String(preferences.monthlySavingsGoal ?? 500));
    setAutoLock(String(preferences.autoLockMinutes));
    const nextCats: Record<string, string> = {};
    for (const c of PURCHASE_CATEGORIES) {
      const val = preferences.categoryBudgets?.[c];
      nextCats[c] = val ? String(val) : '';
    }
    setCategoryBudgets(nextCats);
  }, [
    preferences.currency,
    preferences.monthlyBudget,
    preferences.monthlySavingsGoal,
    preferences.autoLockMinutes,
    preferences.categoryBudgets,
  ]);

  useEffect(() => {
    if (!focusSection) return;
    const target =
      focusSection === 'themes'
        ? themesSectionRef.current
        : focusSection === 'notifications'
          ? notificationsSectionRef.current
          : focusSection === 'widgets'
            ? widgetsSectionRef.current
            : null;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [focusSection, focusSignal]);

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

  const passStrength = useMemo(() => {
    if (!newPass) return null;
    if (newPass.length < 6) return 'Too short';
    let score = 0;
    if (newPass.length >= 10) score++;
    if (/[A-Z]/.test(newPass) && /[a-z]/.test(newPass)) score++;
    if (/[0-9]/.test(newPass)) score++;
    if (/[^A-Za-z0-9]/.test(newPass)) score++;
    if (score >= 3) return 'Strong';
    if (score >= 2) return 'Good';
    return 'Fair';
  }, [newPass]);

  const handleSelectAccent = async (nextAccent: AccentTheme) => {
    setAccentTheme(nextAccent);
    await updatePreferences({ accentTheme: nextAccent });
  };

  const handleSelectDensity = async (density: UiDensity) => {
    await updatePreferences({ density });
  };

  const handleSelectWeekStart = async (weekStartsOn: 'sunday' | 'monday') => {
    await updatePreferences({ weekStartsOn });
  };

  const handleToggleNotifications = async () => {
    setErrorMessage('');
    if (!preferences.notificationsEnabled) {
      const perm = await requestNotificationPermission();
      setNotifPerm(perm);
      if (perm === 'denied') {
        setErrorMessage(
          'Notifications are blocked by your browser site settings. Allow notifications for this site and try again.'
        );
        return;
      }
      if (perm === 'unsupported') {
        setErrorMessage(
          'This browser does not support Web Notifications.'
        );
        return;
      }
      await updatePreferences({ notificationsEnabled: true });
      setStatusMessage('Reminder notifications enabled.');
    } else {
      await updatePreferences({ notificationsEnabled: false });
      setStatusMessage('Reminder notifications paused.');
    }
  };

  const handleSavePrefs = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage('');
    setErrorMessage('');
    const parsedBudget = Math.max(0, parseFloat(budget) || 0);
    const parsedSavings = Math.max(0, parseFloat(savingsGoal) || 0);
    const parsedAutoLock = Math.max(0, parseInt(autoLock, 10) || 0);
    const parsedCategories: Partial<Record<PurchaseCategory, number>> = {};
    for (const c of PURCHASE_CATEGORIES) {
      const val = parseFloat(categoryBudgets[c] || '');
      if (!Number.isNaN(val) && val > 0) {
        parsedCategories[c] = val;
      }
    }
    await updatePreferences({
      currency: currency.trim() || '$',
      monthlyBudget: parsedBudget,
      monthlySavingsGoal: parsedSavings,
      autoLockMinutes: parsedAutoLock,
      categoryBudgets: parsedCategories,
    });
    setStatusMessage('Preferences encrypted and saved.');
  };

  const handlePassphraseUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage('');
    setErrorMessage('');
    if (newPass.length < 6) {
      setErrorMessage('Passphrase must be at least 6 characters.');
      return;
    }
    if (newPass !== confirmPass) {
      setErrorMessage('Passphrases do not match.');
      return;
    }
    setBusy(true);
    try {
      await changeVaultPassphrase(newPass);
      setNewPass('');
      setConfirmPass('');
      setStatusMessage(
        'Vault re-encrypted with new AES-256-GCM key and queued for sync.'
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to update passphrase.'
      );
    } finally {
      setBusy(false);
    }
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking synchronously can cancel the download in Firefox/Safari
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage('');
    setStatusMessage('');
    try {
      const text = await file.text();
      const count = await importPlaintextBackup(text);
      setStatusMessage(`Imported and encrypted ${count} records into vault.`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Invalid backup file.'
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#1F1F1F] dark:text-[#E3E3E3]">
          Settings
        </h1>
        <p className="text-sm text-[#444746] dark:text-[#C4C7C5]">
          Themes, reminder alerts, Google Account sync, and vault encryption
        </p>
      </div>

      {statusMessage && (
        <div className="rounded-2xl border border-[#C4EED0] dark:border-[#0F5223] bg-[#E6F4EA] dark:bg-[#0A3818]/60 px-4 py-3 text-xs text-[#146C2E] dark:text-[#6DD58C]">
          {statusMessage}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-2xl border border-[#F2B8B5] dark:border-[#8C1D18] bg-[#FCE8E6] dark:bg-[#601410]/60 px-4 py-3 text-xs text-[#B3261E] dark:text-[#F2B8B5]">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Themes & Appearance */}
      <section
        ref={themesSectionRef}
        id="settings-themes"
        className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-5 sm:p-6 space-y-5 scroll-mt-20"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#1F1F1F] dark:text-[#E3E3E3]">
            <Palette className="w-4 h-4 hub-text-accent" />
            <span>Themes & Appearance</span>
          </div>
          <p className="text-xs text-[#444746] dark:text-[#C4C7C5]">
            Customize color palette, dark mode, layout density, and calendar defaults.
          </p>
        </div>

        {/* Light / Dark / System */}
        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]">
            Theme Mode
          </span>
          <div className="grid grid-cols-3 gap-2">
            {(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setTheme(mode)}
                className={`min-h-[44px] rounded-full text-xs font-medium capitalize border transition-colors ${
                  theme === mode
                    ? 'hub-bg-soft border-transparent font-semibold'
                    : 'bg-transparent text-[#444746] dark:text-[#C4C7C5] border-[#DADCE0] dark:border-[#444746] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Material You 6-Palette Color Themes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]">
              Accent Color Theme
            </span>
            <span className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">
              {ACCENT_THEMES.find((t) => t.id === accentTheme)?.label ??
                'Google Blue'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {ACCENT_THEMES.map((item) => {
              const selected = accentTheme === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void handleSelectAccent(item.id)}
                  className={`min-h-[46px] px-3.5 rounded-2xl border flex items-center justify-between gap-2 text-xs font-medium transition-colors ${
                    selected
                      ? 'hub-bg-soft hub-border-accent'
                      : 'border-[#DADCE0] dark:border-[#444746] text-[#1F1F1F] dark:text-[#E3E3E3] hover:bg-[#F8F9FA] dark:hover:bg-[#282A2C]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-4 h-4 rounded-full shrink-0 border border-black/10 dark:border-white/15"
                      style={{ backgroundColor: item.lightSwatch }}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Density & Week Start */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]">
              Interface Density
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(['comfortable', 'compact'] as UiDensity[]).map((d) => {
                const active = (preferences.density ?? 'comfortable') === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => void handleSelectDensity(d)}
                    className={`min-h-[42px] rounded-full text-xs font-medium capitalize border transition-colors ${
                      active
                        ? 'hub-bg-soft border-transparent font-semibold'
                        : 'border-[#DADCE0] dark:border-[#444746] text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]'
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]">
              Calendar Week Starts On
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(['sunday', 'monday'] as const).map((day) => {
                const active = (preferences.weekStartsOn ?? 'sunday') === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => void handleSelectWeekStart(day)}
                    className={`min-h-[42px] rounded-full text-xs font-medium capitalize border transition-colors ${
                      active
                        ? 'hub-bg-soft border-transparent font-semibold'
                        : 'border-[#DADCE0] dark:border-[#444746] text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* OLED Pure Black & Privacy Blur */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() =>
              void updatePreferences({ oledDark: !preferences.oledDark })
            }
            className={`min-h-[42px] px-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between transition-colors ${
              preferences.oledDark
                ? 'hub-bg-soft border-transparent font-semibold'
                : 'border-[#DADCE0] dark:border-[#444746] text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]'
            }`}
          >
            <span>OLED Pure Black Dark</span>
            <span>{preferences.oledDark ? 'On' : 'Off'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              void updatePreferences({ privacyBlur: !preferences.privacyBlur })
            }
            className={`min-h-[42px] px-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between transition-colors ${
              preferences.privacyBlur
                ? 'hub-bg-soft border-transparent font-semibold'
                : 'border-[#DADCE0] dark:border-[#444746] text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]'
            }`}
          >
            <span>Privacy Blur Amounts</span>
            <span>{preferences.privacyBlur ? 'On' : 'Off'}</span>
          </button>
        </div>

        {/* Numeric Preferences */}
        <form
          onSubmit={handleSavePrefs}
          className="space-y-4 pt-3 border-t border-[#F0F4F9] dark:border-[#282A2C]"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="space-y-1.5">
              <label
                htmlFor="pref-currency"
                className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
              >
                Currency
              </label>
              <input
                id="pref-currency"
                type="text"
                maxLength={4}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="pref-budget"
                className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
              >
                Monthly Budget
              </label>
              <input
                id="pref-budget"
                type="number"
                min="0"
                step="10"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 font-mono tabular-nums text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="pref-savings"
                className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
              >
                Savings Goal / mo
              </label>
              <input
                id="pref-savings"
                type="number"
                min="0"
                step="10"
                value={savingsGoal}
                onChange={(e) => setSavingsGoal(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 font-mono tabular-nums text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="pref-autolock"
                className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
              >
                Auto-Lock
              </label>
              <select
                id="pref-autolock"
                value={autoLock}
                onChange={(e) => setAutoLock(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-white dark:bg-[#1E1F20] px-3 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
              >
                <option value="5">5 minutes</option>
                <option value="15">15 minutes</option>
                <option value="60">1 hour</option>
                <option value="0">Never while open</option>
              </select>
            </div>
          </div>

          {/* Optional Per-Category Monthly Budgets */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowCategoryBudgets((s) => !s)}
              className="text-xs font-medium hub-text-accent hover:underline"
            >
              {showCategoryBudgets
                ? 'Hide category budgets'
                : 'Configure per-category monthly budgets'}
            </button>

            {showCategoryBudgets && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                {PURCHASE_CATEGORIES.map((cat) => (
                  <div key={cat} className="space-y-1">
                    <label
                      htmlFor={`cat-budget-${cat}`}
                      className="block text-[11px] text-[#444746] dark:text-[#C4C7C5] truncate"
                    >
                      {cat}
                    </label>
                    <input
                      id={`cat-budget-${cat}`}
                      type="number"
                      min="0"
                      step="10"
                      placeholder="No cap"
                      value={categoryBudgets[cat] ?? ''}
                      onChange={(e) =>
                        setCategoryBudgets((prev) => ({
                          ...prev,
                          [cat]: e.target.value,
                        }))
                      }
                      className="w-full min-h-[38px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-2.5 font-mono tabular-nums text-xs text-[#1F1F1F] dark:text-[#E3E3E3]"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="min-h-[44px] px-5 rounded-full hub-bg-accent text-xs font-medium hover:opacity-95 transition-opacity"
          >
            Save Preferences
          </button>
        </form>
      </section>

      {/* Notification Reminders */}
      <section
        ref={notificationsSectionRef}
        id="settings-notifications"
        className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-5 sm:p-6 space-y-5 scroll-mt-20"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#1F1F1F] dark:text-[#E3E3E3]">
              <BellRing className="w-4 h-4 hub-text-accent" />
              <span>Notification Reminders</span>
            </div>
            <p className="text-xs text-[#444746] dark:text-[#C4C7C5]">
              Browser & PWA notifications for overdue tasks, renewals, habits, and events.
            </p>
          </div>
          <span className="text-xs font-mono text-[#444746] dark:text-[#C4C7C5] shrink-0">
            Permission:{' '}
            {notifPerm === 'granted'
              ? 'Granted'
              : notifPerm === 'denied'
                ? 'Blocked'
                : notifPerm === 'unsupported'
                  ? 'Unsupported'
                  : 'Prompt Needed'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#F0F4F9] dark:border-[#282A2C]">
          <div>
            <p className="text-sm font-medium text-[#1F1F1F] dark:text-[#E3E3E3]">
              Automatic Reminder Alerts
            </p>
            <p className="text-xs text-[#444746] dark:text-[#C4C7C5]">
              Checks due tasks, trial expirations, and scheduled habits every minute while open.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleToggleNotifications()}
            className={`min-h-[42px] px-5 rounded-full text-xs font-medium shrink-0 transition-colors ${
              preferences.notificationsEnabled && notifPerm === 'granted'
                ? 'hub-bg-soft font-semibold'
                : 'hub-bg-accent'
            }`}
          >
            {preferences.notificationsEnabled && notifPerm === 'granted'
              ? 'Reminders Active (Pause)'
              : 'Enable Notifications'}
          </button>
        </div>

        {/* Digest Time + Per-Module Switches */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <label
              htmlFor="digest-time"
              className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]"
            >
              Daily Digest Time (All-Day Items)
            </label>
            <input
              id="digest-time"
              type="time"
              value={preferences.dailyDigestTime ?? '09:00'}
              onChange={(e) =>
                void updatePreferences({ dailyDigestTime: e.target.value })
              }
              className="w-full min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 font-mono text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
            />
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5]">
              Reminder Categories
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  {
                    key: 'notifyTasks',
                    label: 'Tasks',
                    value: preferences.notifyTasks !== false,
                  },
                  {
                    key: 'notifyHabits',
                    label: 'Habits',
                    value: preferences.notifyHabits !== false,
                  },
                  {
                    key: 'notifySubscriptions',
                    label: 'Renewals',
                    value: preferences.notifySubscriptions !== false,
                  },
                  {
                    key: 'notifyEvents',
                    label: 'Events',
                    value: preferences.notifyEvents !== false,
                  },
                  {
                    key: 'notifyGoals',
                    label: 'Goals',
                    value: preferences.notifyGoals !== false,
                  },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    void updatePreferences({ [item.key]: !item.value })
                  }
                  className={`min-h-[38px] px-3 rounded-xl border text-xs font-medium flex items-center justify-between transition-colors ${
                    item.value
                      ? 'hub-bg-soft border-transparent'
                      : 'border-[#DADCE0] dark:border-[#444746] text-[#747775]'
                  }`}
                >
                  <span>{item.label}</span>
                  <span>{item.value ? 'On' : 'Off'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quiet Hours */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#F0F4F9] dark:border-[#282A2C] items-end">
          <button
            type="button"
            onClick={() =>
              void updatePreferences({
                quietHoursEnabled: !preferences.quietHoursEnabled,
              })
            }
            className={`min-h-[42px] px-3.5 rounded-xl border text-xs font-medium flex items-center justify-between transition-colors ${
              preferences.quietHoursEnabled
                ? 'hub-bg-soft border-transparent font-semibold'
                : 'border-[#DADCE0] dark:border-[#444746] text-[#444746] dark:text-[#C4C7C5]'
            }`}
          >
            <span>Quiet Hours</span>
            <span>{preferences.quietHoursEnabled ? 'On' : 'Off'}</span>
          </button>

          <div className="space-y-1">
            <label
              htmlFor="quiet-start"
              className="block text-[11px] text-[#444746] dark:text-[#C4C7C5]"
            >
              Quiet Start
            </label>
            <input
              id="quiet-start"
              type="time"
              value={preferences.quietStart ?? '22:00'}
              disabled={!preferences.quietHoursEnabled}
              onChange={(e) =>
                void updatePreferences({ quietStart: e.target.value })
              }
              className="w-full min-h-[42px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3 font-mono text-xs text-[#1F1F1F] dark:text-[#E3E3E3] disabled:opacity-45"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="quiet-end"
              className="block text-[11px] text-[#444746] dark:text-[#C4C7C5]"
            >
              Quiet End
            </label>
            <input
              id="quiet-end"
              type="time"
              value={preferences.quietEnd ?? '07:00'}
              disabled={!preferences.quietHoursEnabled}
              onChange={(e) =>
                void updatePreferences({ quietEnd: e.target.value })
              }
              className="w-full min-h-[42px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3 font-mono text-xs text-[#1F1F1F] dark:text-[#E3E3E3] disabled:opacity-45"
            />
          </div>
        </div>

        <NotificationCustomizer
          preferences={preferences}
          updatePreferences={updatePreferences}
        />

        {/* Manual Test & Dispatch Actions */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[#F0F4F9] dark:border-[#282A2C]">
          <button
            type="button"
            onClick={async () => {
              const perm = await requestNotificationPermission();
              setNotifPerm(perm);
              await sendTestNotification();
            }}
            className="min-h-[42px] px-4 rounded-full border border-[#DADCE0] dark:border-[#444746] text-xs font-medium inline-flex items-center gap-2 hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Send Test Notification</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              const perm = await requestNotificationPermission();
              setNotifPerm(perm);
              await runReminderSweepNow();
            }}
            className="min-h-[42px] px-4 rounded-full border border-[#DADCE0] dark:border-[#444746] text-xs font-medium inline-flex items-center gap-2 hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Due Reminders Now ({dueReminders.length})</span>
          </button>
        </div>

        {/* Due Reminders Queue Preview */}
        {dueReminders.length > 0 && (
          <div className="pt-2 space-y-2">
            <p className="text-xs font-medium text-[#444746] dark:text-[#C4C7C5]">
              Currently Due Alerts ({dueReminders.length})
            </p>
            <div className="divide-y divide-[#F0F4F9] dark:divide-[#282A2C] rounded-2xl border border-[#E1E3E1] dark:border-[#3C4043] overflow-hidden">
              {dueReminders.slice(0, 6).map((rem) => (
                <div
                  key={rem.id}
                  className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[#1F1F1F] dark:text-[#E3E3E3] truncate">
                      {rem.title}
                    </p>
                    <p className="text-[#5F6368] dark:text-[#9AA0A6] truncate">
                      {rem.body}
                    </p>
                  </div>
                  <span
                    className={`font-mono shrink-0 ${
                      rem.urgent
                        ? 'text-[#C5221F] dark:text-[#F28B82] font-semibold'
                        : 'text-[#5F6368] dark:text-[#9AA0A6]'
                    }`}
                  >
                    {rem.dueLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Home Widgets */}
      <section
        ref={widgetsSectionRef}
        id="settings-widgets"
        className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-5 sm:p-6 space-y-4 scroll-mt-20"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#1F1F1F] dark:text-[#E3E3E3]">
              <LayoutGrid className="w-4 h-4 hub-text-accent" />
              <span>Home Widgets</span>
            </div>
            <p className="text-xs text-[#444746] dark:text-[#C4C7C5]">
              Choose which cards appear on Home, their order, and their width.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setWidgetCustomizerOpen(true)}
            className="min-h-[42px] px-5 rounded-full hub-bg-accent text-xs font-medium shrink-0"
          >
            Customize Widgets
          </button>
        </div>
        <ol className="flex flex-wrap gap-2 pt-3 border-t border-[#F0F4F9] dark:border-[#282A2C]">
          {homeWidgets.map((w, i) => {
            const meta = getWidgetMeta(w.id);
            if (!meta) return null;
            return (
              <li
                key={w.id}
                className={`px-3 py-1.5 rounded-full text-[11px] font-medium border ${
                  w.visible
                    ? 'hub-bg-soft border-transparent'
                    : 'border-dashed border-[#DADCE0] dark:border-[#444746] text-[#747775] line-through'
                }`}
              >
                {w.visible ? `${i + 1}. ` : ''}
                {meta.label}
                {w.visible && meta.resizable ? ` · ${w.size}` : ''}
              </li>
            );
          })}
        </ol>
      </section>

      {/* Google Account & Cross-Platform Sync */}
      <section className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#1F1F1F] dark:text-[#E3E3E3]">
              <Cloud className="w-4 h-4 hub-text-accent" />
              <span>Google Account & Cloud Sync</span>
            </div>
            <p className="text-xs text-[#444746] dark:text-[#C4C7C5]">
              Encrypted records sync across desktop, Android, and iOS via Firestore.
            </p>
          </div>
          <span className="text-xs font-mono text-[#444746] dark:text-[#C4C7C5] shrink-0">
            {syncStatus.phase === 'synced'
              ? 'Synced'
              : syncStatus.phase === 'syncing'
                ? 'Syncing...'
                : syncStatus.phase === 'offline'
                  ? 'Offline'
                  : syncStatus.phase === 'error'
                    ? 'Sync Error'
                    : 'Local Only'}
          </span>
        </div>

        {!user ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#F0F4F9] dark:border-[#282A2C]">
            <p className="text-xs text-[#444746] dark:text-[#C4C7C5]">
              Sign in with Google to sync your encrypted vault across devices.
            </p>
            <button
              type="button"
              disabled={!isOnline}
              onClick={() => void signInWithGoogle()}
              className="min-h-[44px] px-5 rounded-full hub-bg-accent text-xs font-medium whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {isOnline ? 'Sign in with Google' : 'Connect Online to Sign In'}
            </button>
          </div>
        ) : (
          <div className="space-y-4 pt-3 border-t border-[#F0F4F9] dark:border-[#282A2C]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Account avatar'}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#E1E3E1] dark:border-[#444746]"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full hub-bg-soft flex items-center justify-center text-sm font-semibold shrink-0">
                    {(user.displayName || user.email || 'M')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1F1F1F] dark:text-[#E3E3E3] truncate">
                    {user.displayName || 'Personal Account'}
                  </p>
                  <p className="text-xs text-[#444746] dark:text-[#C4C7C5] truncate">
                    {user.email}
                  </p>
                </div>
              </div>
              <div className="text-xs text-[#444746] dark:text-[#C4C7C5] tabular-nums">
                {syncStatus.lastSyncedAt
                  ? `Synced at ${new Date(syncStatus.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Waiting for initial sync'}
                {syncStatus.pendingCount > 0
                  ? ` · ${syncStatus.pendingCount} pending`
                  : ''}
              </div>
            </div>

            {syncStatus.errorMessage && (
              <p className="text-xs text-[#B3261E] dark:text-[#F2B8B5]">
                {syncStatus.errorMessage}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!isOnline || syncStatus.phase === 'syncing'}
                onClick={() => void triggerSyncNow()}
                className="min-h-[42px] px-4 rounded-full border border-[#DADCE0] dark:border-[#444746] text-xs font-medium inline-flex items-center gap-2 hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync Now</span>
              </button>
              <button
                type="button"
                onClick={() => void signOutGoogle()}
                className="min-h-[42px] px-4 rounded-full border border-[#DADCE0] dark:border-[#444746] text-xs font-medium text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Encryption & Vault Security */}
      <section className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#1F1F1F] dark:text-[#E3E3E3]">
              <ShieldCheck className="w-4 h-4 text-[#146C2E] dark:text-[#6DD58C]" />
              <span>Encryption & Vault Security</span>
            </div>
            <p className="text-xs text-[#444746] dark:text-[#C4C7C5]">
              {vaultMeta?.mode === 'passphrase'
                ? 'Master Passphrase (PBKDF2-SHA256 150k + AES-256-GCM)'
                : 'Local Device Key (AES-256-GCM)'}
            </p>
          </div>
          {vaultMeta?.mode === 'passphrase' && (
            <button
              type="button"
              onClick={lockVault}
              className="min-h-[42px] px-4 rounded-full border border-[#DADCE0] dark:border-[#444746] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] shrink-0"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Vault</span>
            </button>
          )}
        </div>

        <form
          onSubmit={handlePassphraseUpdate}
          className="space-y-3 pt-3 border-t border-[#F0F4F9] dark:border-[#282A2C]"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#1F1F1F] dark:text-[#E3E3E3] flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              <span>
                {vaultMeta?.mode === 'device'
                  ? 'Set Master Passphrase for Cross-Device Sync'
                  : 'Change Vault Passphrase'}
              </span>
            </p>
            {passStrength && (
              <span className="text-xs font-medium hub-text-accent">
                Strength: {passStrength}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="New passphrase (min 6 chars)"
              autoComplete="new-password"
              className="min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
            />
            <input
              type="password"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              placeholder="Confirm passphrase"
              autoComplete="new-password"
              className="min-h-[44px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3]"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="min-h-[44px] px-5 rounded-full hub-bg-accent text-xs font-medium hover:opacity-95 disabled:opacity-50"
          >
            {busy ? 'Re-encrypting vault...' : 'Update Passphrase & Re-Encrypt'}
          </button>
        </form>
      </section>

      {/* Vault Summary, PWA & Portable Backups */}
      <section className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#1F1F1F] dark:text-[#E3E3E3]">
              <Database className="w-4 h-4 hub-text-accent" />
              <span>Encrypted Vault, PWA & Backups</span>
            </div>
            <p className="text-xs text-[#444746] dark:text-[#C4C7C5]">
              Offline-first IndexedDB storage · Install on home screen or export backups.
            </p>
          </div>
          <PWAInstallButton />
        </div>

        {/* Encrypted Vault Counts Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 py-3 border-y border-[#F0F4F9] dark:border-[#282A2C] text-xs">
          <div>
            <span className="text-[#5F6368] dark:text-[#9AA0A6]">Purchases</span>
            <p className="text-base font-mono font-semibold tabular-nums">
              {purchases.length}
            </p>
          </div>
          <div>
            <span className="text-[#5F6368] dark:text-[#9AA0A6]">
              Subscriptions
            </span>
            <p className="text-base font-mono font-semibold tabular-nums">
              {subscriptions.length}
            </p>
          </div>
          <div>
            <span className="text-[#5F6368] dark:text-[#9AA0A6]">Habits</span>
            <p className="text-base font-mono font-semibold tabular-nums">
              {habits.length}
            </p>
          </div>
          <div>
            <span className="text-[#5F6368] dark:text-[#9AA0A6]">Tasks</span>
            <p className="text-base font-mono font-semibold tabular-nums">
              {tasks.length}
            </p>
          </div>
          <div>
            <span className="text-[#5F6368] dark:text-[#9AA0A6]">Events</span>
            <p className="text-base font-mono font-semibold tabular-nums">
              {calendarEvents.length}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={async () => {
              const json = await exportEncryptedBackup();
              downloadFile(
                json,
                `mmv-hub-encrypted-${new Date().toISOString().slice(0, 10)}.json`
              );
            }}
            className="min-h-[42px] px-4 rounded-full border border-[#DADCE0] dark:border-[#444746] text-xs font-medium inline-flex items-center gap-2 hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Encrypted JSON</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const json = exportPlaintextBackup();
              downloadFile(
                json,
                `mmv-hub-backup-${new Date().toISOString().slice(0, 10)}.json`
              );
            }}
            className="min-h-[42px] px-4 rounded-full border border-[#DADCE0] dark:border-[#444746] text-xs font-medium inline-flex items-center gap-2 hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Readable JSON</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[42px] px-4 rounded-full border border-[#DADCE0] dark:border-[#444746] text-xs font-medium inline-flex items-center gap-2 hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import JSON</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>

        <div className="pt-3 border-t border-[#F0F4F9] dark:border-[#282A2C]">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="min-h-[40px] inline-flex items-center gap-1.5 text-xs font-medium text-[#B3261E] dark:text-[#F2B8B5] hover:underline"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Wipe Local Device Storage</span>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void wipeLocalVault();
                  setConfirmReset(false);
                }}
                className="min-h-[40px] px-4 rounded-full bg-[#B3261E] text-white text-xs font-medium"
              >
                Confirm Wipe Local Data
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="min-h-[40px] text-xs text-[#444746] dark:text-[#C4C7C5] hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>
      </div>

      {widgetCustomizerOpen && (
        <WidgetCustomizer
          widgets={homeWidgets}
          onSave={async (next) => {
            await updatePreferences({ homeWidgets: next });
            setStatusMessage('Home widget layout saved.');
          }}
          onClose={() => setWidgetCustomizerOpen(false)}
        />
      )}
    </div>
  );
};
