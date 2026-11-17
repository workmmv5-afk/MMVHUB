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
  | 'crimson';

export type UiDensity = 'comfortable' | 'compact';

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
}

export interface SyncStatusState {
  phase: 'local-only' | 'syncing' | 'synced' | 'offline' | 'error';
  pendingCount: number;
  lastSyncedAt: number | null;
  errorMessage?: string;
}
