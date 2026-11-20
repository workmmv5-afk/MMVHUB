export type NavTab =
  | 'home'
  | 'goals'
  | 'purchases'
  | 'habits'
  | 'tasks'
  | 'calendar'
  | 'settings';

export type VaultRecordKind =
  | 'purchase'
  | 'habit'
  | 'task'
  | 'tasklist'
  | 'subscription'
  | 'calendar'
  | 'goal'
  | 'prefs';

export type PurchaseCategory =
  | 'Groceries'
  | 'Food & Dining'
  | 'Transport'
  | 'Utilities'
  | 'Tech & Gear'
  | 'Health'
  | 'Home'
  | 'Other';

export type PaymentMethod =
  | 'Card'
  | 'Cash'
  | 'Bank Transfer'
  | 'Digital Wallet';

export type PurchaseEntryType = 'expense' | 'refund' | 'income';

export interface PurchaseRecord {
  id: string;
  title: string;
  amount: number;
  category: PurchaseCategory;
  paymentMethod: PaymentMethod;
  date: string; // YYYY-MM-DD
  notes?: string;
  recurring?: boolean;
  isRefund?: boolean;
  entryType?: PurchaseEntryType;
  returnByDate?: string; // YYYY-MM-DD
  reimbursable?: boolean;
  reimbursed?: boolean;
  tags?: string[];
  // Foreign currency (amount above is in your base currency)
  fxAmount?: number;
  fxCurrency?: string; // e.g. EUR
  fxRate?: number; // base per 1 foreign
  // Split / IOU
  splitWays?: number; // total people incl. you
  splitWith?: string; // names
  // Compressed receipt thumbnail (data:image/jpeg;base64, ≤ ~12 KB)
  receiptThumb?: string;
  createdAt: number;
  updatedAt: number;
}

export type SubscriptionBillingCycle =
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly';

export interface SubscriptionPriceChange {
  date: string; // YYYY-MM-DD
  amount: number;
}

export interface SubscriptionRecord {
  id: string;
  name: string;
  amount: number;
  billingCycle: SubscriptionBillingCycle;
  nextBillingDate: string; // YYYY-MM-DD
  category: PurchaseCategory;
  paymentMethod: PaymentMethod;
  active: boolean;
  isTrial?: boolean;
  reminderDays?: number;
  manageUrl?: string;
  cardLast4?: string;
  cardExpiry?: string; // MM/YY
  usageStatus?: 'active' | 'underused';
  priceHistory?: SubscriptionPriceChange[];
  lastPaidDate?: string;
  totalPaidCount?: number;
  seats?: number; // people sharing the plan (incl. you)
  annualPrice?: number; // price if billed yearly (for savings hint)
  variableAmount?: boolean; // utility-style bill — amount varies
  cancelledOn?: string; // YYYY-MM-DD
  cancelRef?: string; // confirmation number / note
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type HabitCadence =
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'monthly'
  | 'custom';

export type HabitCustomMode = 'weekdays' | 'interval';

export type HabitTimeOfDay = 'anytime' | 'morning' | 'afternoon' | 'evening';

export type HabitMode = 'build' | 'quit';

export type HabitType = 'check' | 'progressive' | 'goal' | 'timed' | 'quit';

export interface HabitRecord {
  id: string;
  name: string;
  mode?: HabitMode;
  habitType?: HabitType;
  goalId?: string;
  goalContribution?: number;
  progressiveStart?: number;
  progressiveStep?: number;
  progressiveEveryDays?: number;
  progressiveCap?: number;
  cadence: HabitCadence;
  customWeekdays?: number[]; // 0=Sun..6=Sat
  customMode?: HabitCustomMode;
  intervalDays?: number; // Every N days
  startDate?: string; // YYYY-MM-DD anchor for interval schedules
  monthlyDays?: number[]; // 1..31, or -1 for last day of month
  weeklyQuota?: number; // Flexible X times per week (1..7)
  timeOfDay?: HabitTimeOfDay;
  preferredTime?: string; // HH:mm
  category?: string;
  color?: CalendarColor;
  notes?: string;
  targetPerDay: number;
  unit?: string;
  logs: Record<string, number>;
  freezeDates?: string[]; // Streak freeze/rest YYYY-MM-DD dates
  journal?: Record<string, string>; // YYYY-MM-DD -> short reflection
  routine?: string; // e.g. "Morning" — run step by step in the routine runner
  routineOrder?: number;
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type TaskPriority = 'low' | 'medium' | 'high';
export type RecurrenceCycle =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly';

export interface TaskSubItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  priority: TaskPriority;
  notes?: string;
  estimateMinutes?: number;
  subtasks?: string[];
  listId?: string;
}

export type SnoozePreset = 'later' | 'tomorrow' | 'weekend' | 'nextweek';

export interface TaskListRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export type TaskType =
  | 'standard'
  | 'goal'
  | 'progressive'
  | 'checklist'
  | 'milestone';

export interface TaskRecord {
  id: string;
  listId?: string;
  title: string;
  taskType?: TaskType;
  goalId?: string;
  progressCurrent?: number;
  progressTarget?: number;
  progressUnit?: string;
  completed: boolean;
  starred?: boolean;
  starredAt?: number;
  priority: TaskPriority;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  repeat?: RecurrenceCycle;
  estimateMinutes?: number;
  focusedMinutes?: number;
  snoozeCount?: number;
  blockedBy?: string; // id of a task that must be completed first
  order?: number;
  area?: string;
  notes?: string;
  subtasks?: TaskSubItem[];
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type GoalImageLayout =
  | 'cover'
  | 'wide'
  | 'split-left'
  | 'split-right'
  | 'backdrop'
  | 'badge';

export type GoalImageFit = 'cover' | 'contain';
export type GoalImageFrame = 'bleed' | 'inset';

export interface GoalImageConfig {
  layout: GoalImageLayout;
  fit: GoalImageFit;
  frame: GoalImageFrame;
  posX: number; // 0..100
  posY: number; // 0..100
  zoom: number; // 1..2.5
  rotation: 0 | 90 | 180 | 270;
  flipH?: boolean;
  flipV?: boolean;
}

export type GoalProgressMode = 'milestones' | 'numeric' | 'linked' | 'hybrid';
export type GoalStatus = 'active' | 'completed' | 'paused';

export interface GoalMilestone {
  id: string;
  title: string;
  done: boolean;
  targetDate?: string;
}

export interface GoalRecord {
  id: string;
  title: string;
  description?: string;
  category: string;
  color: CalendarColor;
  status: GoalStatus;
  progressMode: GoalProgressMode;
  currentValue?: number;
  targetValue?: number;
  unit?: string;
  targetDate?: string; // YYYY-MM-DD
  milestones?: GoalMilestone[];
  imageUrl?: string;
  imageConfig?: GoalImageConfig;
  createdAt: number;
  updatedAt: number;
}

export type CalendarColor = 'blue' | 'green' | 'amber' | 'red' | 'purple';

export interface CalendarEventRecord {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  allDay: boolean;
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  location?: string;
  notes?: string;
  color: CalendarColor;
  repeat?: RecurrenceCycle;
  reminderOffsetMinutes?: number; // e.g., 0, 10, 30, 60, 1440
  isMilestone?: boolean;
  endDate?: string; // YYYY-MM-DD, multi-day (non-repeating) events
  birthYear?: number; // yearly birthdays/anniversaries → "turns N"
  // Per-event time zone: original wall-clock values; date/startTime/endTime
  // above hold the equivalent device-local times used everywhere else.
  timeZone?: string; // IANA, e.g. "America/New_York"
  tzDate?: string;
  tzStart?: string;
  tzEnd?: string;
  createdAt: number;
  updatedAt: number;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export type AccentTheme =
  | 'blue'
  | 'emerald'
  | 'slate'
  | 'plum'
  | 'amber'
  | 'crimson'
  | 'custom';

export type UiDensity = 'comfortable' | 'compact';

export type TypographySans = 'poppins' | 'jakarta' | 'inter' | 'roboto' | 'system';
export type TypographyMono = 'google-sans-code' | 'jetbrains' | 'roboto-mono' | 'system';

export type NotificationDeliveryMode = 'individual' | 'digest';

/** User-tunable notification behaviour (all fields optional; see resolveNotificationConfig). */
export interface NotificationConfig {
  deliveryMode?: NotificationDeliveryMode;
  maxPerBatch?: number; // individual alerts before summarizing (1..10)
  sound?: boolean;
  taskLeadMinutes?: number; // alert N minutes before a timed task
  includeOverdueTasks?: boolean;
  highPriorityTasksOnly?: boolean;
  eventDefaultLeadMinutes?: number; // used when an event has no own offset
  renewalLeadDays?: number; // fallback when a subscription has no reminderDays
  notifyReturnWindows?: boolean;
  returnWindowDays?: number;
  urgentBypassQuietHours?: boolean;
  activeWeekdays?: number[]; // 0=Sun..6=Sat; empty/undefined = every day
  eveningSummaryEnabled?: boolean;
  eveningSummaryTime?: string; // HH:mm
  bellHorizonDays?: number; // Upcoming range in the bell popover
  showBadge?: boolean; // bell + app-icon badge count
  // Android app only
  headsUp?: boolean; // pop over other apps (high importance)
  vibrate?: boolean;
  actionButtons?: boolean; // Done / Snooze / Paid buttons on notifications
  snoozeMinutes?: number;
  nagCritical?: boolean; // repeat alerts for high-priority timed tasks
  ongoingSummary?: boolean; // persistent "today" notification (Android)
}

/** Android home-screen widget appearance & content. */
export interface PhoneWidgetConfig {
  theme?: 'system' | 'light' | 'dark';
  opacity?: number; // 0..100 background opacity
  accent?: 'app' | 'blue' | 'green' | 'purple' | 'amber' | 'red';
  hideAmounts?: boolean;
  hideWhenLocked?: boolean;
  rows?: number; // Today widget rows 1..5
  todayTitle?: string;
  todayTasks?: boolean;
  todayHabits?: boolean;
  todayEvents?: boolean;
  todayDoneItems?: boolean;
  quick?: { task?: boolean; purchase?: boolean; habit?: boolean; event?: boolean };
}

export type HomeWidgetId =
  | 'reminders'
  | 'briefing'
  | 'snapshot'
  | 'quickActions'
  | 'focus'
  | 'goals'
  | 'schedule'
  | 'streaks'
  | 'countdowns'
  | 'wallet'
  | 'note';

export type HomeWidgetSize = 'half' | 'full';

export interface HomeWidgetConfig {
  id: HomeWidgetId;
  visible: boolean;
  size: HomeWidgetSize;
}

export interface HubPreferences {
  id: 'prefs_default';
  currency: string;
  monthlyBudget: number;
  monthlySavingsGoal?: number;
  autoLockMinutes: number;
  accentTheme?: AccentTheme;
  oledDark?: boolean;
  privacyBlur?: boolean;
  density?: UiDensity;
  customAccent?: string; // #RRGGBB when accentTheme === 'custom'
  language?: 'system' | 'en' | 'uz' | 'ru';
  liteMode?: boolean; // simplified one-page interface
  uiModeChosen?: boolean; // first-run Lite/Full choice made
  clockFormat?: '12h' | '24h';
  dateStyle?: 'mdy' | 'dmy' | 'iso';
  haptics?: boolean;
  blurOnSwitch?: boolean;
  clipboardClearSeconds?: number; // 0 = never
  backupReminderDays?: number; // 0 = off
  lastBackupAt?: number;
  fontSans?: TypographySans;
  fontMono?: TypographyMono;
  fontScale?: number; // 0.9 .. 1.2
  weekStartsOn?: 'sunday' | 'monday';
  notificationsEnabled?: boolean;
  dailyDigestTime?: string; // HH:mm
  quietHoursEnabled?: boolean;
  quietStart?: string; // HH:mm
  quietEnd?: string; // HH:mm
  notifyTasks?: boolean;
  notifyHabits?: boolean;
  notifyGoals?: boolean;
  notifySubscriptions?: boolean;
  notifyEvents?: boolean;
  notificationConfig?: NotificationConfig;
  homeWidgets?: HomeWidgetConfig[];
  taskTemplates?: TaskTemplate[];
  phoneWidgets?: PhoneWidgetConfig;
  colorLabels?: Partial<Record<CalendarColor, string>>;
  rewardRates?: Partial<Record<PaymentMethod, number>>; // % back per method
  categoryBudgets?: Partial<Record<PurchaseCategory, number>>;
  scratchpad?: string;
  focusSessionsToday?: {
    date: string;
    count: number;
  };
  updatedAt: number;
}

export interface LocalVaultRecord {
  id: string;
  kind: VaultRecordKind;
  iv: string;
  ciphertext: string;
  version: number;
  deleted: boolean;
  clientUpdatedAt: number;
  syncState: 'synced' | 'pending';
  syncedToCloud: boolean;
}

export interface LocalVaultMeta {
  id: 'local';
  mode: 'passphrase' | 'device';
  salt: string;
  verifierIv: string;
  verifierCiphertext: string;
  deviceKeyJwk?: JsonWebKey;
  ownerUid?: string;
  lastSyncedAt?: number;
  /** Local-only PIN / fingerprint wrappers of the master key. */
  quickUnlock?: import('./lib/quickUnlock').QuickUnlockMeta;
}

export interface SyncStatusState {
  phase: 'local-only' | 'syncing' | 'synced' | 'offline' | 'error';
  pendingCount: number;
  lastSyncedAt: number | null;
  errorMessage?: string;
}
