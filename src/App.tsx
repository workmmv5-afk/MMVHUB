import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
  Calendar,
  Check,
  CheckSquare,
  Clock,
  Cloud,
  CloudOff,
  CreditCard,
  Eye,
  EyeOff,
  Home,
  Lock,
  Monitor,
  Moon,
  Palette,
  Receipt,
  RefreshCw,
  Repeat,
  Search,
  Settings,
  Sun,
  Target,
  WifiOff,
  X,
} from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  DEFAULT_TASK_LIST_ID,
  VaultProvider,
  useVault,
} from './context/VaultContext';
import { VaultGate } from './components/VaultGate';
import { PWAInstallButton } from './components/PWAInstallButton';
import { LogoWordmark } from './components/Logo';
import { BiometricOffer } from './components/SecuritySettings';
import { isBackupDue } from './components/DataSettings';
import { ReviewSheet } from './components/ReviewSheet';
import { CarryoverSheet } from './components/CarryoverSheet';
import { ShortcutsSheet, useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import {
  useNativeIntegration,
  type NativeIntent,
} from './hooks/useNativeIntegration';
import {
  CalendarEventModal,
  GoalModal,
  HabitModal,
  PurchaseModal,
  SubscriptionModal,
  TaskModal,
} from './components/ItemModals';
import { HomeView } from './views/HomeView';
import { PurchasesView } from './views/PurchasesView';
import { HabitsView } from './views/HabitsView';
import { TasksView } from './views/TasksView';
import { CalendarView } from './views/CalendarView';
import { GoalsView } from './views/GoalsView';
import { SettingsView, type SettingsSection } from './views/SettingsView';
import {
  collectCategorizedReminders,
  resolveNotificationConfig,
  updateAppBadge,
  type CategorizedReminder,
} from './lib/notifications';
import { getTodayISO } from './lib/format';
import type {
  AccentTheme,
  CalendarEventRecord,
  GoalRecord,
  HabitRecord,
  NavTab,
  PurchaseRecord,
  SubscriptionRecord,
  TaskRecord,
} from './types';

const NAV_ITEMS: {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'purchases', label: 'Purchases', icon: Receipt },
  { id: 'habits', label: 'Habits', icon: Repeat },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const QUICK_ACCENT_SWATCHES: { id: AccentTheme; label: string; color: string }[] = [
  { id: 'blue', label: 'Blue', color: '#1A73E8' },
  { id: 'emerald', label: 'Emerald', color: '#146C2E' },
  { id: 'slate', label: 'Slate', color: '#3C4043' },
  { id: 'plum', label: 'Plum', color: '#6750A4' },
  { id: 'amber', label: 'Amber', color: '#B06000' },
  { id: 'crimson', label: 'Crimson', color: '#C5221F' },
];

const GoogleWordmark: React.FC = () => (
  <LogoWordmark size={28} className="text-lg shrink-0" />
);

const NineDotsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <circle cx="5" cy="5" r="1.9" />
    <circle cx="12" cy="5" r="1.9" />
    <circle cx="19" cy="5" r="1.9" />
    <circle cx="5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="19" cy="12" r="1.9" />
    <circle cx="5" cy="19" r="1.9" />
    <circle cx="12" cy="19" r="1.9" />
    <circle cx="19" cy="19" r="1.9" />
  </svg>
);

const HubShell: React.FC = () => {
  const {
    phase,
    canLock,
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
    taskLists,
    calendarEvents,
    goals,
    saveGoal,
    deleteGoal,
    preferences,
    snackbar,
    dismissSnackbar,
    lockVault,
    triggerSyncNow,
    updatePreferences,
    savePurchase,
    duplicatePurchase,
    deletePurchase,
    saveSubscription,
    logSubscriptionPayment,
    deleteSubscription,
    saveHabit,
    toggleHabitLog,
    setHabitJournal,
    setHabitLogCount,
    deleteHabit,
    saveTask,
    toggleTaskCompleted,
    snoozeTaskToTomorrow,
    snoozeTask,
    saveTaskTemplate,
    deleteTaskTemplate,
    createTaskFromTemplate,
    blockTaskOnCalendar,
    rescheduleMissedToToday,
    deleteTask,
    saveCalendarEvent,
    deleteCalendarEvent,
    runReminderSweepNow,
  } = useVault();

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [purchasesSubTab, setPurchasesSubTab] = useState<
    'purchases' | 'subscriptions'
  >('purchases');
  const [purchasesSubSignal, setPurchasesSubSignal] = useState(0);

  const [settingsSection, setSettingsSection] =
    useState<SettingsSection | null>(null);
  const [settingsSignal, setSettingsSignal] = useState(0);

  const [remindersMenuOpen, setRemindersMenuOpen] = useState(false);
  const [remindersTab, setRemindersTab] = useState<'upcoming' | 'missed'>(
    'upcoming'
  );
  const [appsMenuOpen, setAppsMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [carryoverOpen, setCarryoverOpen] = useState(false);
  const [snoozeMenuFor, setSnoozeMenuFor] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const topRightMenusRef = useRef<HTMLDivElement>(null);

  const [purchaseModal, setPurchaseModal] = useState<{
    open: boolean;
    item?: PurchaseRecord | null;
  }>({ open: false });

  const [subscriptionModal, setSubscriptionModal] = useState<{
    open: boolean;
    item?: SubscriptionRecord | null;
  }>({ open: false });

  const [habitModal, setHabitModal] = useState<{
    open: boolean;
    item?: HabitRecord | null;
  }>({ open: false });

  const [taskModal, setTaskModal] = useState<{
    open: boolean;
    item?: TaskRecord | null;
    defaultListId?: string;
    defaultGoalId?: string;
  }>({ open: false });

  const [goalModal, setGoalModal] = useState<{
    open: boolean;
    item?: GoalRecord | null;
  }>({ open: false });

  const [calendarModal, setCalendarModal] = useState<{
    open: boolean;
    item?: CalendarEventRecord | null;
    defaultDate?: string;
    defaultStartTime?: string;
  }>({ open: false });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setRemindersMenuOpen(false);
        setAppsMenuOpen(false);
        setAccountMenuOpen(false);
        setCommandQuery('');
        setCommandOpen((o) => !o);
        return;
      }
      if (e.key === 'Escape') {
        setRemindersMenuOpen(false);
        setAppsMenuOpen(false);
        setAccountMenuOpen(false);
        setCommandOpen(false);
      }
    };
    const onPointerDown = (e: MouseEvent) => {
      if (
        (remindersMenuOpen || appsMenuOpen || accountMenuOpen) &&
        topRightMenusRef.current &&
        !topRightMenusRef.current.contains(e.target as Node)
      ) {
        setRemindersMenuOpen(false);
        setAppsMenuOpen(false);
        setAccountMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [remindersMenuOpen, appsMenuOpen, accountMenuOpen]);

  const { missed: missedReminders, upcoming: upcomingReminders } =
    collectCategorizedReminders({
      tasks,
      habits,
      subscriptions,
      purchases,
      calendarEvents,
      goals,
      preferences,
    });

  const notifConfig = resolveNotificationConfig(preferences);
  const badgeCount = missedReminders.length;

  // Mirror the missed count onto the installed-PWA app icon badge
  useEffect(() => {
    updateAppBadge(
      phase === 'unlocked' && notifConfig.showBadge ? badgeCount : 0
    );
  }, [phase, badgeCount, notifConfig.showBadge]);

  // Android: widget deep links, notification actions, back button
  const handleNativeIntent = (intent: NativeIntent) => {
    const openTab = (tab: NavTab) => {
      setRemindersMenuOpen(false);
      setAppsMenuOpen(false);
      setAccountMenuOpen(false);
      setActiveTab(tab);
    };
    const openRecord = (kind: string, id: string) => {
      if (kind === 'task') {
        const t = tasks.find((x) => x.id === id);
        if (t) setTaskModal({ open: true, item: t });
        else openTab('tasks');
      } else if (kind === 'habit') {
        const h = habits.find((x) => x.id === id);
        if (h) setHabitModal({ open: true, item: h });
        else openTab('habits');
      } else if (kind === 'event') {
        const ev = calendarEvents.find((x) => x.id === id);
        if (ev) setCalendarModal({ open: true, item: ev });
        else openTab('calendar');
      } else if (kind === 'subscription') {
        const s = subscriptions.find((x) => x.id === id);
        if (s) setSubscriptionModal({ open: true, item: s });
        else openTab('purchases');
      } else if (kind === 'goal') {
        const g = goals.find((x) => x.id === id);
        if (g) setGoalModal({ open: true, item: g });
        openTab('goals');
      } else {
        openTab('home');
      }
    };

    if (intent.type === 'notification') {
      const { actionId, kind, recordId } = intent;
      if (actionId === 'done' && kind === 'task') {
        if (tasks.find((t) => t.id === recordId && !t.completed)) void toggleTaskCompleted(recordId);
      } else if (actionId === 'done' && kind === 'habit') {
        void toggleHabitLog(recordId, getTodayISO(), 'complete');
      } else if (actionId === 'paid' && kind === 'subscription') {
        void logSubscriptionPayment(recordId);
      } else {
        openRecord(kind, recordId);
      }
      return;
    }

    // mmvhub://<verb>/<kind>/<id?>
    const [verb, kind, id] = intent.url.replace(/^mmvhub:\/\//, '').split('/');
    if (verb === 'new') {
      if (kind === 'task') setTaskModal({ open: true, item: null, defaultListId: DEFAULT_TASK_LIST_ID });
      else if (kind === 'purchase') setPurchaseModal({ open: true, item: null });
      else if (kind === 'habit') setHabitModal({ open: true, item: null });
      else if (kind === 'event') setCalendarModal({ open: true, item: null, defaultDate: getTodayISO() });
      else if (kind === 'goal') setGoalModal({ open: true, item: null });
    } else if (verb === 'toggle' && id) {
      if (kind === 'task') void toggleTaskCompleted(id);
      else if (kind === 'habit') {
        const h = habits.find((x) => x.id === id);
        void toggleHabitLog(id, getTodayISO(), h && h.targetPerDay > 1 ? 'increment' : 'toggle');
      }
    } else if (verb === 'open') {
      const tabs: NavTab[] = ['home', 'purchases', 'habits', 'goals', 'tasks', 'calendar', 'settings'];
      if (!id && tabs.includes(kind as NavTab)) openTab(kind as NavTab);
      else if (id) openRecord(kind, id);
    }
  };

  useNativeIntegration({
    unlocked: phase === 'unlocked',
    preferences,
    onIntent: handleNativeIntent,
    onBack: () => {
      // 1) any open sheet/dialog/menu handles Escape itself
      if (
        document.querySelector('[role="dialog"]') ||
        remindersMenuOpen ||
        appsMenuOpen ||
        accountMenuOpen ||
        commandOpen
      ) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        setRemindersMenuOpen(false);
        setAppsMenuOpen(false);
        setAccountMenuOpen(false);
        setCommandOpen(false);
        return true;
      }
      // 2) otherwise go Home before leaving the app
      if (phase === 'unlocked' && activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }
      return false;
    },
  });

  useKeyboardShortcuts({
    enabled: phase === 'unlocked',
    go: (tab) => {
      setRemindersMenuOpen(false);
      setAppsMenuOpen(false);
      setAccountMenuOpen(false);
      setActiveTab(tab);
    },
    create: (kind) => {
      if (kind === 'task') setTaskModal({ open: true, item: null, defaultListId: DEFAULT_TASK_LIST_ID });
      else if (kind === 'purchase') setPurchaseModal({ open: true, item: null });
      else if (kind === 'habit') setHabitModal({ open: true, item: null });
      else if (kind === 'event') setCalendarModal({ open: true, item: null, defaultDate: getTodayISO() });
      else if (kind === 'goal') setGoalModal({ open: true, item: null });
    },
    search: () => {
      setCommandQuery('');
      setCommandOpen(true);
    },
    review: () => setReviewOpen(true),
    help: () => setShortcutsOpen(true),
  });

  if (phase !== 'unlocked') {
    return <VaultGate />;
  }

  const closeTopMenus = () => {
    setRemindersMenuOpen(false);
    setAppsMenuOpen(false);
    setAccountMenuOpen(false);
  };

  const navigateTab = (tab: NavTab) => {
    closeTopMenus();
    if (tab === 'purchases') {
      setPurchasesSubTab('purchases');
      setPurchasesSubSignal((s) => s + 1);
    } else if (tab === 'settings') {
      setSettingsSection(null);
    }
    setActiveTab(tab);
  };

  const navigateSubscriptions = () => {
    closeTopMenus();
    setPurchasesSubTab('subscriptions');
    setPurchasesSubSignal((s) => s + 1);
    setActiveTab('purchases');
  };

  const navigateSettingsSection = (section: SettingsSection) => {
    closeTopMenus();
    setSettingsSection(section);
    setSettingsSignal((s) => s + 1);
    setActiveTab('settings');
  };

  const handleOpenReminderItem = (item: CategorizedReminder) => {
    closeTopMenus();
    if (item.kind === 'task') {
      const target = tasks.find((t) => t.id === item.recordId);
      if (target) setTaskModal({ open: true, item: target });
    } else if (item.kind === 'habit') {
      const target = habits.find((h) => h.id === item.recordId);
      if (target) setHabitModal({ open: true, item: target });
    } else if (item.kind === 'subscription') {
      const target = subscriptions.find((s) => s.id === item.recordId);
      if (target) setSubscriptionModal({ open: true, item: target });
    } else if (item.kind === 'purchase') {
      const target = purchases.find((p) => p.id === item.recordId);
      if (target) setPurchaseModal({ open: true, item: target });
    } else if (item.kind === 'event') {
      const target = calendarEvents.find((ev) => ev.id === item.recordId);
      if (target) setCalendarModal({ open: true, item: target });
    } else if (item.kind === 'goal') {
      const target = goals.find((g) => g.id === item.recordId);
      if (target) setGoalModal({ open: true, item: target });
    }
  };

  const visibleReminders =
    remindersTab === 'upcoming' ? upcomingReminders : missedReminders;

  const renderAvatar = (sizeClass: string) =>
    user?.photoURL ? (
      <img
        src={user.photoURL}
        alt={user.displayName || 'Profile'}
        referrerPolicy="no-referrer"
        className={`${sizeClass} rounded-full object-cover border border-[#DADCE0] dark:border-[#3C4043]`}
      />
    ) : (
      <div
        className={`${sizeClass} rounded-full hub-bg-accent flex items-center justify-center text-xs font-semibold`}
      >
        {(user?.displayName || user?.email || 'M')[0].toUpperCase()}
      </div>
    );

  const isCompact = preferences.density === 'compact';

  const launcherItems: {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    tintClass: string;
    active: boolean;
    onClick: () => void;
  }[] = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      tintClass: 'text-[#1A73E8] dark:text-[#8AB4F8]',
      active: activeTab === 'home',
      onClick: () => navigateTab('home'),
    },
    {
      id: 'purchases',
      label: 'Purchases',
      icon: Receipt,
      tintClass: 'text-[#146C2E] dark:text-[#81C995]',
      active: activeTab === 'purchases' && purchasesSubTab === 'purchases',
      onClick: () => navigateTab('purchases'),
    },
    {
      id: 'subscriptions',
      label: 'Subscriptions',
      icon: CreditCard,
      tintClass: 'text-[#6750A4] dark:text-[#D0BCFF]',
      active: activeTab === 'purchases' && purchasesSubTab === 'subscriptions',
      onClick: navigateSubscriptions,
    },
    {
      id: 'habits',
      label: 'Habits',
      icon: Repeat,
      tintClass: 'text-[#B06000] dark:text-[#FDD663]',
      active: activeTab === 'habits',
      onClick: () => navigateTab('habits'),
    },
    {
      id: 'goals',
      label: 'Goals',
      icon: Target,
      tintClass: 'text-[#146C2E] dark:text-[#81C995]',
      active: activeTab === 'goals',
      onClick: () => navigateTab('goals'),
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: CheckSquare,
      tintClass: 'text-[#1A73E8] dark:text-[#8AB4F8]',
      active: activeTab === 'tasks',
      onClick: () => navigateTab('tasks'),
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: Calendar,
      tintClass: 'text-[#C5221F] dark:text-[#F28B82]',
      active: activeTab === 'calendar',
      onClick: () => navigateTab('calendar'),
    },
    {
      id: 'themes',
      label: 'Themes',
      icon: Palette,
      tintClass: 'text-[#6750A4] dark:text-[#D0BCFF]',
      active: activeTab === 'settings' && settingsSection === 'themes',
      onClick: () => navigateSettingsSection('themes'),
    },
    {
      id: 'reminders',
      label: 'Reminders',
      icon: BellRing,
      tintClass: 'text-[#C5221F] dark:text-[#F28B82]',
      active: activeTab === 'settings' && settingsSection === 'notifications',
      onClick: () => navigateSettingsSection('notifications'),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      tintClass: 'text-[#5F6368] dark:text-[#9AA0A6]',
      active: activeTab === 'settings' && !settingsSection,
      onClick: () => navigateTab('settings'),
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#131314] text-[#202124] dark:text-[#E8EAED] flex flex-col">
      {/* Clean 3-Zone Google Top App Bar */}
      <header className="sticky top-0 z-30 h-14 md:h-16 px-4 md:px-6 lg:px-8 bg-white/95 dark:bg-[#131314]/95 backdrop-blur-md border-b border-[#E8EAED] dark:border-[#282A2C] flex items-center justify-between gap-4 lg:gap-6">
        {/* Zone 1: Wordmark */}
        <button
          type="button"
          onClick={() => navigateTab('home')}
          className="min-h-[40px] flex items-center whitespace-nowrap shrink-0 focus:outline-none"
          aria-label="MMV-HUB Home"
        >
          <GoogleWordmark />
        </button>

        {/* Zone 2: Clean Single-Line Navigation Links (Tablet & Laptop) */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-5 lg:gap-7 h-full"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTab(item.id)}
                className={`h-full inline-flex items-center text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'hub-border-accent hub-text-accent'
                    : 'border-transparent text-[#5F6368] dark:text-[#9AA0A6] hover:text-[#202124] dark:hover:text-[#E8EAED]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Reminders Bell + Google 9-Dot App Launcher + Account Avatar */}
        <div
          ref={topRightMenusRef}
          className="relative flex items-center gap-1.5 shrink-0"
        >
          <button
            type="button"
            onClick={() => {
              setAppsMenuOpen(false);
              setAccountMenuOpen(false);
              setRemindersMenuOpen((o) => !o);
            }}
            aria-label={
              notifConfig.showBadge && badgeCount > 0
                ? `Reminders, ${badgeCount} missed`
                : 'Reminders'
            }
            aria-expanded={remindersMenuOpen}
            title="Reminders"
            className={`relative min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C] transition-colors ${
              remindersMenuOpen ? 'bg-[#F1F3F4] dark:bg-[#282A2C]' : ''
            }`}
          >
            <Bell className="w-5 h-5" />
            {notifConfig.showBadge && badgeCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#C5221F] dark:bg-[#F28B82] text-white dark:text-[#601410] text-[10px] font-semibold leading-4 text-center tabular-nums"
              >
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setRemindersMenuOpen(false);
              setAccountMenuOpen(false);
              setAppsMenuOpen((o) => !o);
            }}
            aria-label="MMV-HUB apps"
            aria-expanded={appsMenuOpen}
            title="MMV-HUB apps"
            className={`relative min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C] transition-colors ${
              appsMenuOpen ? 'bg-[#F1F3F4] dark:bg-[#282A2C]' : ''
            }`}
          >
            <NineDotsIcon className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setRemindersMenuOpen(false);
              setAppsMenuOpen(false);
              setAccountMenuOpen((o) => !o);
            }}
            aria-label="Account and quick controls"
            aria-expanded={accountMenuOpen}
            className="min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C] transition-colors"
          >
            {renderAvatar('w-8 h-8')}
          </button>

          {/* Reminders Popover (Upcoming & Missed) */}
          {remindersMenuOpen && (
            <div
              role="dialog"
              aria-label="Reminders"
              className="absolute right-0 top-12 w-[320px] sm:w-[360px] max-w-[calc(100vw-2rem)] rounded-3xl border border-[#DADCE0] dark:border-[#3C4043] bg-white dark:bg-[#202124] shadow-xl p-4 space-y-3 z-50"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[#202124] dark:text-[#E8EAED]">
                  Reminders
                </h2>
                <button
                  type="button"
                  onClick={() => setRemindersMenuOpen(false)}
                  aria-label="Close reminders"
                  className="min-h-[32px] min-w-[32px] rounded-full flex items-center justify-center text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 2 Navigations: Upcoming & Missed */}
              <div
                role="tablist"
                aria-label="Reminder views"
                className="grid grid-cols-2 p-1 rounded-full bg-[#F1F3F4] dark:bg-[#282A2C]"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={remindersTab === 'upcoming'}
                  onClick={() => setRemindersTab('upcoming')}
                  className={`min-h-[36px] px-3 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    remindersTab === 'upcoming'
                      ? 'bg-white dark:bg-[#1E1F20] text-[#202124] dark:text-[#E8EAED] shadow-2xs'
                      : 'text-[#5F6368] dark:text-[#9AA0A6] hover:text-[#202124] dark:hover:text-[#E8EAED]'
                  }`}
                >
                  Upcoming ({upcomingReminders.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={remindersTab === 'missed'}
                  onClick={() => setRemindersTab('missed')}
                  className={`min-h-[36px] px-3 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    remindersTab === 'missed'
                      ? 'bg-white dark:bg-[#1E1F20] text-[#C5221F] dark:text-[#F28B82] shadow-2xs'
                      : 'text-[#5F6368] dark:text-[#9AA0A6] hover:text-[#202124] dark:hover:text-[#E8EAED]'
                  }`}
                >
                  Missed ({missedReminders.length})
                </button>
              </div>

              {/* Reminder List */}
              {visibleReminders.length === 0 ? (
                <div className="py-8 px-3 text-center">
                  <p className="text-sm font-medium text-[#202124] dark:text-[#E8EAED]">
                    {remindersTab === 'upcoming'
                      ? 'No upcoming reminders'
                      : 'No missed reminders'}
                  </p>
                  <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mt-1">
                    {remindersTab === 'upcoming'
                      ? `Scheduled tasks, habits, events, and renewals for the next ${notifConfig.bellHorizonDays} day${notifConfig.bellHorizonDays === 1 ? '' : 's'} appear here.`
                      : 'You are caught up on overdue tasks, habits, events, and renewals.'}
                  </p>
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto divide-y divide-[#F1F3F4] dark:divide-[#282A2C] -mx-1 px-1">
                  {visibleReminders.map((item) => (
                    <div
                      key={item.id}
                      className="py-2.5 flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenReminderItem(item)}
                        className="min-w-0 flex-1 text-left py-1 rounded-lg hover:bg-[#F8F9FA] dark:hover:bg-[#282A2C] px-2 -mx-2 transition-colors"
                      >
                        <p className="text-sm font-medium text-[#202124] dark:text-[#E8EAED] truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] truncate tabular-nums mt-0.5">
                          <span>{item.detail}</span>
                          <span aria-hidden="true"> · </span>
                          <span
                            className={
                              remindersTab === 'missed' || item.urgent
                                ? 'text-[#C5221F] dark:text-[#F28B82] font-medium'
                                : ''
                            }
                          >
                            {item.whenLabel}
                          </span>
                        </p>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        {item.kind === 'task' && (
                          <>
                            {snoozeMenuFor === item.id && (
                              <span className="flex items-center gap-0.5">
                                {(
                                  [
                                    ['later', '+3h'],
                                    ['tomorrow', 'Tmrw'],
                                    ['nextweek', 'Mon'],
                                  ] as const
                                ).map(([preset, label]) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => {
                                      setSnoozeMenuFor(null);
                                      void snoozeTask(item.recordId, preset);
                                    }}
                                    className="min-h-[30px] px-2 rounded-full text-[11px] font-medium hub-bg-soft"
                                  >
                                    {label}
                                  </button>
                                ))}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setSnoozeMenuFor((cur) => (cur === item.id ? null : item.id))
                              }
                              title="Snooze"
                              aria-label={`Snooze ${item.title}`}
                              className="min-h-[36px] min-w-[36px] rounded-full flex items-center justify-center text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#303134]"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void toggleTaskCompleted(item.recordId)
                              }
                              title="Mark completed"
                              aria-label={`Complete ${item.title}`}
                              className="min-h-[36px] min-w-[36px] rounded-full flex items-center justify-center hub-text-accent hover:bg-[#F1F3F4] dark:hover:bg-[#303134]"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {item.kind === 'habit' && (
                          <button
                            type="button"
                            onClick={() =>
                              void toggleHabitLog(
                                item.recordId,
                                getTodayISO(),
                                'complete'
                              )
                            }
                            title="Mark habit done"
                            aria-label={`Complete ${item.title}`}
                            className="min-h-[36px] min-w-[36px] rounded-full flex items-center justify-center hub-text-accent hover:bg-[#F1F3F4] dark:hover:bg-[#303134]"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        {item.kind === 'subscription' && (
                          <button
                            type="button"
                            onClick={() =>
                              void logSubscriptionPayment(item.recordId)
                            }
                            title="Log payment"
                            aria-label={`Log payment for ${item.title}`}
                            className="min-h-[36px] px-2.5 rounded-full text-xs font-medium hub-text-accent hover:bg-[#F1F3F4] dark:hover:bg-[#303134] whitespace-nowrap"
                          >
                            Paid
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-2.5 border-t border-[#E8EAED] dark:border-[#3C4043] flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => navigateSettingsSection('notifications')}
                  className="min-h-[36px] px-2.5 rounded-full text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#303134] whitespace-nowrap"
                >
                  Settings
                </button>
                <div className="flex items-center gap-1.5">
                  {remindersTab === 'missed' &&
                    missedReminders.some((r) => r.kind === 'task') && (
                      <button
                        type="button"
                        onClick={() => {
                          closeTopMenus();
                          setCarryoverOpen(true);
                        }}
                        className="min-h-[36px] px-3 rounded-full text-xs font-medium border border-[#DADCE0] dark:border-[#3C4043] text-[#202124] dark:text-[#E8EAED] hover:bg-[#F1F3F4] dark:hover:bg-[#303134] whitespace-nowrap"
                      >
                        Plan missed tasks
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => void runReminderSweepNow()}
                    className="min-h-[36px] px-3 rounded-full text-xs font-medium hub-bg-soft whitespace-nowrap"
                  >
                    Send Alerts
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Google 9-Dot App Launcher Popover */}
          {appsMenuOpen && (
            <div
              role="menu"
              aria-label="MMV-HUB Apps"
              className="absolute right-0 top-12 w-[296px] rounded-3xl border border-[#DADCE0] dark:border-[#3C4043] bg-white dark:bg-[#202124] shadow-xl p-3 z-50"
            >
              <div className="grid grid-cols-3 gap-1.5">
                {launcherItems.map((app) => {
                  const Icon = app.icon;
                  return (
                    <button
                      key={app.id}
                      type="button"
                      role="menuitem"
                      onClick={app.onClick}
                      className={`min-h-[76px] rounded-2xl p-2 flex flex-col items-center justify-center gap-2 transition-colors ${
                        app.active
                          ? 'hub-bg-soft'
                          : 'hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${app.tintClass}`} />
                      <span className="text-[11px] font-medium text-[#202124] dark:text-[#E8EAED] whitespace-nowrap truncate max-w-full">
                        {app.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Google Account Popover */}
          {accountMenuOpen && (
            <div className="absolute right-0 top-12 w-72 rounded-3xl border border-[#DADCE0] dark:border-[#3C4043] bg-white dark:bg-[#202124] shadow-xl p-4 space-y-3.5 z-50">
              <div className="flex items-center gap-3 pb-3 border-b border-[#E8EAED] dark:border-[#3C4043]">
                {renderAvatar('w-10 h-10 shrink-0')}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#202124] dark:text-[#E8EAED] truncate">
                    {user?.displayName || 'Personal Vault'}
                  </p>
                  <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] truncate">
                    {user?.email || 'Local device storage'}
                  </p>
                </div>
              </div>

              {/* Cloud Sync Row */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-2 text-[#5F6368] dark:text-[#9AA0A6]">
                  {isOnline ? (
                    <Cloud className="w-4 h-4 hub-text-accent" />
                  ) : (
                    <CloudOff className="w-4 h-4 text-[#C5221F] dark:text-[#F28B82]" />
                  )}
                  <span>
                    {!isOnline
                      ? 'Offline mode'
                      : syncStatus.phase === 'synced'
                        ? 'Cloud synced'
                        : syncStatus.phase === 'syncing'
                          ? 'Syncing...'
                          : 'Local encrypted'}
                  </span>
                </span>
                {user && isOnline && (
                  <button
                    type="button"
                    onClick={() => void triggerSyncNow()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium hub-text-accent hover:bg-[#F1F3F4] dark:hover:bg-[#303134]"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Sync</span>
                  </button>
                )}
              </div>

              {/* Theme Mode Switcher */}
              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-[#5F6368] dark:text-[#9AA0A6]">
                  Appearance
                </span>
                <div className="grid grid-cols-3 p-1 rounded-full bg-[#F1F3F4] dark:bg-[#282A2C]">
                  {(
                    [
                      { id: 'light', label: 'Light', icon: Sun },
                      { id: 'dark', label: 'Dark', icon: Moon },
                      { id: 'system', label: 'Auto', icon: Monitor },
                    ] as const
                  ).map((opt) => {
                    const Icon = opt.icon;
                    const active = theme === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTheme(opt.id)}
                        className={`min-h-[32px] rounded-full text-xs font-medium inline-flex items-center justify-center gap-1 transition-colors ${
                          active
                            ? 'bg-white dark:bg-[#1E1F20] text-[#202124] dark:text-[#E8EAED] shadow-2xs'
                            : 'text-[#5F6368] dark:text-[#9AA0A6]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Accent Color Dots */}
              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-[#5F6368] dark:text-[#9AA0A6]">
                  Theme Color
                </span>
                <div className="flex items-center justify-between gap-1.5">
                  {QUICK_ACCENT_SWATCHES.map((sw) => {
                    const selected = accentTheme === sw.id;
                    return (
                      <button
                        key={sw.id}
                        type="button"
                        aria-label={`Select ${sw.label} theme`}
                        title={sw.label}
                        onClick={() => {
                          setAccentTheme(sw.id);
                          void updatePreferences({ accentTheme: sw.id });
                        }}
                        className={`w-7 h-7 rounded-full flex items-center justify-center border transition-transform ${
                          selected
                            ? 'scale-110 ring-2 ring-offset-2 ring-[#202124] dark:ring-[#E8EAED] dark:ring-offset-[#202124] border-transparent'
                            : 'border-black/10 dark:border-white/20 hover:scale-105'
                        }`}
                        style={{ backgroundColor: sw.color }}
                      >
                        {selected && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-1 space-y-1 border-t border-[#E8EAED] dark:border-[#3C4043]">
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setCommandQuery('');
                    setCommandOpen(true);
                  }}
                  className="w-full min-h-[40px] px-3 rounded-xl text-left text-xs font-medium text-[#202124] dark:text-[#E8EAED] hover:bg-[#F1F3F4] dark:hover:bg-[#303134] flex items-center justify-between"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <Search className="w-4 h-4 text-[#5F6368] dark:text-[#9AA0A6]" />
                    <span>Quick Jump</span>
                  </span>
                  <kbd className="text-[10px] font-mono text-[#5F6368] dark:text-[#9AA0A6] border border-[#DADCE0] dark:border-[#3C4043] rounded px-1.5 py-0.5">
                    ⌘K
                  </kbd>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void updatePreferences({
                      privacyBlur: !preferences.privacyBlur,
                    });
                  }}
                  className="w-full min-h-[40px] px-3 rounded-xl text-left text-xs font-medium text-[#202124] dark:text-[#E8EAED] hover:bg-[#F1F3F4] dark:hover:bg-[#303134] flex items-center justify-between"
                >
                  <span className="inline-flex items-center gap-2.5">
                    {preferences.privacyBlur ? (
                      <Eye className="w-4 h-4 hub-text-accent" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-[#5F6368] dark:text-[#9AA0A6]" />
                    )}
                    <span>
                      {preferences.privacyBlur
                        ? 'Show Amounts'
                        : 'Privacy Blur'}
                    </span>
                  </span>
                  {preferences.privacyBlur && (
                    <Check className="w-3.5 h-3.5 hub-text-accent" />
                  )}
                </button>

                <PWAInstallButton />

                {canLock && (
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      lockVault();
                    }}
                    className="w-full min-h-[40px] px-3 rounded-xl text-left text-xs font-medium text-[#202124] dark:text-[#E8EAED] hover:bg-[#F1F3F4] dark:hover:bg-[#303134] flex items-center gap-2.5"
                  >
                    <Lock className="w-4 h-4 text-[#5F6368] dark:text-[#9AA0A6]" />
                    <span>Lock Vault</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => navigateTab('settings')}
                  className="w-full min-h-[40px] px-3 rounded-xl text-left text-xs font-medium text-[#202124] dark:text-[#E8EAED] hover:bg-[#F1F3F4] dark:hover:bg-[#303134] flex items-center justify-between"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <Settings className="w-4 h-4 text-[#5F6368] dark:text-[#9AA0A6]" />
                    <span>Vault Settings</span>
                  </span>
                  {activeTab === 'settings' && (
                    <Check className="w-3.5 h-3.5 hub-text-accent" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-[#FEF7E0] dark:bg-[#413000] border-b border-[#F5E0A3] dark:border-[#6A4E00] px-4 py-1.5 text-xs text-[#6B4E00] dark:text-[#FCD663] flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>
            Offline Mode — Changes stay encrypted locally and sync when connected.
          </span>
        </div>
      )}

      {isBackupDue(preferences) && activeTab !== 'settings' && (
        <div className="hub-bg-soft px-4 py-1.5 text-xs flex items-center justify-center gap-3">
          <span>Backup due</span>
          <button
            type="button"
            onClick={() => navigateSettingsSection('data')}
            className="font-semibold underline underline-offset-2"
          >
            Export now
          </button>
          <button
            type="button"
            onClick={() => void updatePreferences({ lastBackupAt: Date.now() })}
            className="opacity-70 hover:opacity-100"
          >
            Later
          </button>
        </div>
      )}

      {/* Main Content Canvas */}
      <main className="flex-1 min-w-0">
        <div
          className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 lg:pb-12 ${
            isCompact ? 'py-3 lg:py-5' : 'py-5 lg:py-8'
          }`}
        >
          {activeTab === 'home' && (
            <HomeView
              onNavigate={navigateTab}
              onOpenSubscriptions={navigateSubscriptions}
              onOpenRemindersSettings={() =>
                navigateSettingsSection('notifications')
              }
              onOpenNewPurchase={() =>
                setPurchaseModal({ open: true, item: null })
              }
              onOpenNewEvent={(dateISO) =>
                setCalendarModal({
                  open: true,
                  item: null,
                  defaultDate: dateISO,
                })
              }
              onOpenNewTask={() =>
                setTaskModal({
                  open: true,
                  item: null,
                  defaultListId: DEFAULT_TASK_LIST_ID,
                })
              }
              onOpenNewHabit={() => setHabitModal({ open: true, item: null })}
              onOpenReview={() => setReviewOpen(true)}
              onEditPurchase={(item) =>
                setPurchaseModal({ open: true, item })
              }
              onEditSubscription={(item) =>
                setSubscriptionModal({ open: true, item })
              }
              onEditHabit={(item) => setHabitModal({ open: true, item })}
              onEditTask={(item) => setTaskModal({ open: true, item })}
              onEditEvent={(item) => setCalendarModal({ open: true, item })}
            />
          )}
          {activeTab === 'purchases' && (
            <PurchasesView
              initialSubTab={purchasesSubTab}
              subTabSignal={purchasesSubSignal}
              onNewPurchase={() =>
                setPurchaseModal({ open: true, item: null })
              }
              onEditPurchase={(item) =>
                setPurchaseModal({ open: true, item })
              }
              onNewSubscription={() =>
                setSubscriptionModal({ open: true, item: null })
              }
              onEditSubscription={(item) =>
                setSubscriptionModal({ open: true, item })
              }
              onOpenCalendar={() => navigateTab('calendar')}
            />
          )}
          {activeTab === 'habits' && (
            <HabitsView
              onNewHabit={() => setHabitModal({ open: true, item: null })}
              onEditHabit={(item) => setHabitModal({ open: true, item })}
            />
          )}
          {activeTab === 'goals' && (
            <GoalsView
              onNewGoal={() => setGoalModal({ open: true, item: null })}
              onEditGoal={(item) => setGoalModal({ open: true, item })}
              onNewTaskForGoal={(goalId) =>
                setTaskModal({
                  open: true,
                  item: null,
                  defaultListId: DEFAULT_TASK_LIST_ID,
                  defaultGoalId: goalId,
                })
              }
              onEditTask={(item) => setTaskModal({ open: true, item })}
              onEditHabit={(item) => setHabitModal({ open: true, item })}
            />
          )}
          {activeTab === 'tasks' && (
            <TasksView
              onNewTask={(listId) =>
                setTaskModal({
                  open: true,
                  item: null,
                  defaultListId: listId ?? DEFAULT_TASK_LIST_ID,
                })
              }
              onEditTask={(item) => setTaskModal({ open: true, item })}
            />
          )}
          {activeTab === 'calendar' && (
            <CalendarView
              onNewEvent={(dateISO, startTime) =>
                setCalendarModal({
                  open: true,
                  item: null,
                  defaultDate: dateISO,
                  defaultStartTime: startTime,
                })
              }
              onEditEvent={(ev) => setCalendarModal({ open: true, item: ev })}
              onEditTask={(task) => setTaskModal({ open: true, item: task })}
              onEditSubscription={(sub) =>
                setSubscriptionModal({ open: true, item: sub })
              }
            />
          )}
          {activeTab === 'settings' && (
            <SettingsView
              focusSection={settingsSection}
              focusSignal={settingsSignal}
            />
          )}
        </div>
      </main>

      <BiometricOffer />
      {reviewOpen && <ReviewSheet onClose={() => setReviewOpen(false)} />}
      {carryoverOpen && <CarryoverSheet onClose={() => setCarryoverOpen(false)} />}
      {shortcutsOpen && <ShortcutsSheet onClose={() => setShortcutsOpen(false)} />}

      {/* Google Material 3 Undo Snackbar */}
      {snackbar && (
        <div className="fixed bottom-5 lg:bottom-6 left-4 right-4 sm:left-6 sm:right-auto sm:min-w-[300px] sm:max-w-md z-50 rounded-xl bg-[#303030] dark:bg-[#E3E3E3] text-[#F2F2F2] dark:text-[#1F1F1F] px-4 py-3 shadow-lg flex items-center justify-between gap-4">
          <span className="text-sm">{snackbar.message}</span>
          <div className="flex items-center gap-2 shrink-0">
            {snackbar.undoLabel && snackbar.onUndo && (
              <button
                type="button"
                onClick={async () => {
                  const fn = snackbar.onUndo;
                  dismissSnackbar();
                  if (fn) await fn();
                }}
                className="text-xs font-semibold uppercase tracking-wide text-[#A8C7FA] dark:text-[#0B57D0] px-2 py-1"
              >
                {snackbar.undoLabel}
              </button>
            )}
            <button
              type="button"
              onClick={dismissSnackbar}
              aria-label="Dismiss notification"
              className="p-1 opacity-75 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modals / Bottom Sheets */}
      {purchaseModal.open && (
        <PurchaseModal
          initial={purchaseModal.item}
          recentPurchases={purchases}
          currency={preferences.currency}
          onSave={savePurchase}
          onDuplicate={duplicatePurchase}
          onDelete={deletePurchase}
          onClose={() => setPurchaseModal({ open: false })}
        />
      )}
      {subscriptionModal.open && (
        <SubscriptionModal
          initial={subscriptionModal.item}
          recentPayments={
            subscriptionModal.item
              ? purchases
                  .filter((p) => p.title.startsWith(`${subscriptionModal.item!.name} (`))
                  .map((p) => p.amount)
              : []
          }
          currency={preferences.currency}
          onSave={saveSubscription}
          onDelete={deleteSubscription}
          onClose={() => setSubscriptionModal({ open: false })}
        />
      )}
      {habitModal.open && (
        <HabitModal
          initial={habitModal.item}
          goals={goals}
          allHabits={habits}
          onJournal={setHabitJournal}
          onLog={setHabitLogCount}
          onSave={saveHabit}
          onDelete={deleteHabit}
          onClose={() => setHabitModal({ open: false })}
        />
      )}
      {taskModal.open && (
        <TaskModal
          initial={taskModal.item}
          defaultListId={taskModal.defaultListId}
          defaultGoalId={taskModal.defaultGoalId}
          goals={goals}
          allTasks={tasks}
          templates={preferences.taskTemplates ?? []}
          onSaveTemplate={saveTaskTemplate}
          onDeleteTemplate={deleteTaskTemplate}
          onBlockTime={blockTaskOnCalendar}
          taskLists={taskLists}
          onSave={saveTask}
          onDelete={deleteTask}
          onClose={() => setTaskModal({ open: false })}
        />
      )}
      {goalModal.open && (
        <GoalModal
          initial={goalModal.item}
          onSave={saveGoal}
          onDelete={deleteGoal}
          onClose={() => setGoalModal({ open: false })}
        />
      )}
      {calendarModal.open && (
        <CalendarEventModal
          initial={calendarModal.item}
          defaultDate={calendarModal.defaultDate}
          defaultStartTime={calendarModal.defaultStartTime}
          onSave={saveCalendarEvent}
          onDelete={deleteCalendarEvent}
          onClose={() => setCalendarModal({ open: false })}
        />
      )}

      {/* Global Quick-Jump Command Palette (Ctrl/Cmd + K) */}
      {commandOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-xs pt-16 sm:pt-24 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCommandOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Quick Jump Palette"
            className="w-full max-w-xl rounded-3xl border border-[#DADCE0] dark:border-[#3C4043] bg-white dark:bg-[#202124] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E8EAED] dark:border-[#3C4043]">
              <Search className="w-4 h-4 text-[#5F6368] dark:text-[#9AA0A6] shrink-0" />
              <input
                type="text"
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Jump to tasks, habits, purchases, subscriptions, events..."
                autoFocus
                className="flex-1 bg-transparent text-sm text-[#202124] dark:text-[#E8EAED] placeholder:text-[#5F6368] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCommandOpen(false)}
                aria-label="Close quick jump"
                className="min-h-[32px] min-w-[32px] rounded-full flex items-center justify-center text-[#5F6368] hover:bg-[#F1F3F4] dark:hover:bg-[#303134]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[360px] overflow-y-auto divide-y divide-[#F1F3F4] dark:divide-[#282A2C] p-2">
              {(() => {
                const q = commandQuery.trim().toLowerCase();
                const actions: {
                  id: string;
                  label: string;
                  meta: string;
                  onSelect: () => void;
                }[] = [];

                if (!q || 'new task'.includes(q) || 'create task'.includes(q)) {
                  actions.push({
                    id: 'act-task',
                    label: 'New Task',
                    meta: 'Quick create',
                    onSelect: () =>
                      setTaskModal({
                        open: true,
                        item: null,
                        defaultListId: DEFAULT_TASK_LIST_ID,
                      }),
                  });
                }
                if (
                  !q ||
                  'log purchase'.includes(q) ||
                  'expense'.includes(q) ||
                  'income'.includes(q)
                ) {
                  actions.push({
                    id: 'act-pur',
                    label: 'Log Purchase / Income',
                    meta: 'Quick create',
                    onSelect: () =>
                      setPurchaseModal({ open: true, item: null }),
                  });
                }
                if (!q || 'new habit'.includes(q)) {
                  actions.push({
                    id: 'act-hab',
                    label: 'New Habit Goal',
                    meta: 'Quick create',
                    onSelect: () => setHabitModal({ open: true, item: null }),
                  });
                }
                if (!q || 'new goal'.includes(q) || 'goals'.includes(q)) {
                  actions.push({
                    id: 'act-goal',
                    label: 'New Goal',
                    meta: 'Quick create',
                    onSelect: () => setGoalModal({ open: true, item: null }),
                  });
                }
                if (!q || 'new event'.includes(q) || 'calendar'.includes(q)) {
                  actions.push({
                    id: 'act-cal',
                    label: 'New Calendar Event',
                    meta: 'Quick create',
                    onSelect: () =>
                      setCalendarModal({
                        open: true,
                        item: null,
                        defaultDate: getTodayISO(),
                      }),
                  });
                }

                if (!q || 'review'.includes(q) || 'insights'.includes(q) || 'year in review'.includes(q)) {
                  actions.push({
                    id: 'act-review',
                    label: 'Review & Insights',
                    meta: 'Week · Month · Year',
                    onSelect: () => setReviewOpen(true),
                  });
                }
                if (!q || 'plan overdue'.includes(q) || 'carry over'.includes(q)) {
                  actions.push({
                    id: 'act-carry',
                    label: 'Plan overdue tasks',
                    meta: 'Carry over',
                    onSelect: () => setCarryoverOpen(true),
                  });
                }
                for (const tpl of preferences.taskTemplates ?? []) {
                  if (!q || tpl.name.toLowerCase().includes(q) || 'template'.includes(q)) {
                    actions.push({
                      id: `tpl-${tpl.id}`,
                      label: `From template: ${tpl.name}`,
                      meta: 'Adds to today',
                      onSelect: () => void createTaskFromTemplate(tpl.id),
                    });
                  }
                }
                if (!q || 'keyboard shortcuts'.includes(q)) {
                  actions.push({
                    id: 'act-keys',
                    label: 'Keyboard Shortcuts',
                    meta: '?',
                    onSelect: () => setShortcutsOpen(true),
                  });
                }
                if (
                  !q ||
                  'customize widgets'.includes(q) ||
                  'home layout'.includes(q)
                ) {
                  actions.push({
                    id: 'act-widgets',
                    label: 'Customize Home Widgets',
                    meta: 'Settings',
                    onSelect: () => navigateSettingsSection('widgets'),
                  });
                }
                if (
                  !q ||
                  'notification settings'.includes(q) ||
                  'reminders'.includes(q)
                ) {
                  actions.push({
                    id: 'act-notif',
                    label: 'Notification Settings',
                    meta: 'Settings',
                    onSelect: () => navigateSettingsSection('notifications'),
                  });
                }

                for (const nav of NAV_ITEMS) {
                  if (!q || nav.label.toLowerCase().includes(q)) {
                    actions.push({
                      id: `nav-${nav.id}`,
                      label: `Go to ${nav.label}`,
                      meta: 'Navigation',
                      onSelect: () => navigateTab(nav.id),
                    });
                  }
                }

                if (q) {
                  for (const t of tasks) {
                    if (
                      t.title.toLowerCase().includes(q) ||
                      (t.area && t.area.toLowerCase().includes(q))
                    ) {
                      actions.push({
                        id: `t-${t.id}`,
                        label: t.title,
                        meta: `Task · ${t.area || 'My Tasks'}${t.dueDate ? ` · ${t.dueDate}` : ''}`,
                        onSelect: () => setTaskModal({ open: true, item: t }),
                      });
                    }
                  }
                  for (const h of habits) {
                    if (h.name.toLowerCase().includes(q)) {
                      actions.push({
                        id: `h-${h.id}`,
                        label: h.name,
                        meta: `Habit · ${h.category || 'Daily'}`,
                        onSelect: () => setHabitModal({ open: true, item: h }),
                      });
                    }
                  }
                  for (const p of purchases) {
                    if (
                      p.title.toLowerCase().includes(q) ||
                      p.category.toLowerCase().includes(q)
                    ) {
                      actions.push({
                        id: `p-${p.id}`,
                        label: p.title,
                        meta: `Purchase · ${p.category} · ${p.date}`,
                        onSelect: () =>
                          setPurchaseModal({ open: true, item: p }),
                      });
                    }
                  }
                  for (const s of subscriptions) {
                    if (s.name.toLowerCase().includes(q)) {
                      actions.push({
                        id: `s-${s.id}`,
                        label: s.name,
                        meta: `Subscription · ${s.billingCycle} · ${s.nextBillingDate}`,
                        onSelect: () =>
                          setSubscriptionModal({ open: true, item: s }),
                      });
                    }
                  }
                  for (const g of goals) {
                    if (
                      g.title.toLowerCase().includes(q) ||
                      g.category.toLowerCase().includes(q)
                    ) {
                      actions.push({
                        id: `g-${g.id}`,
                        label: g.title,
                        meta: `Goal · ${g.category}${g.targetDate ? ` · ${g.targetDate}` : ''}`,
                        onSelect: () => setGoalModal({ open: true, item: g }),
                      });
                    }
                  }
                  for (const ev of calendarEvents) {
                    if (ev.title.toLowerCase().includes(q)) {
                      actions.push({
                        id: `e-${ev.id}`,
                        label: ev.title,
                        meta: `Event · ${ev.date}`,
                        onSelect: () =>
                          setCalendarModal({ open: true, item: ev }),
                      });
                    }
                  }
                }

                const slice = actions.slice(0, 14);
                if (slice.length === 0) {
                  return (
                    <p className="py-8 text-center text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                      No matching items found.
                    </p>
                  );
                }

                return slice.map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => {
                      setCommandOpen(false);
                      act.onSelect();
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between gap-3 hover:bg-[#F8F9FA] dark:hover:bg-[#282A2C] transition-colors"
                  >
                    <span className="text-sm font-medium text-[#202124] dark:text-[#E8EAED] truncate">
                      {act.label}
                    </span>
                    <span className="text-xs text-[#5F6368] dark:text-[#9AA0A6] shrink-0">
                      {act.meta}
                    </span>
                  </button>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <VaultProvider>
        <HubShell />
      </VaultProvider>
    </ErrorBoundary>
  );
}
