import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import type {
  AccentTheme,
  CalendarEventRecord,
  GoalMilestone,
  GoalRecord,
  GoalStatus,
  HabitRecord,
  HubPreferences,
  LocalVaultMeta,
  LocalVaultRecord,
  PurchaseRecord,
  SubscriptionRecord,
  SyncStatusState,
  TaskListRecord,
  TaskRecord,
  ThemeMode,
  VaultRecordKind,
} from '../types';
import {
  createKeyVerifier,
  decryptPayload,
  derivePassphraseKey,
  encryptPayload,
  generateDeviceKey,
  generateSaltBase64,
  importDeviceKey,
  verifyVaultKey,
} from '../lib/crypto';
import {
  clearAllLocalVaultData,
  getAllLocalRecords,
  getLocalRecord,
  getLocalVaultMeta,
  putLocalRecord,
  putLocalRecordsBatch,
  saveLocalVaultMeta,
} from '../lib/indexeddb';
import { auth, googleProvider } from '../lib/firebase';
import {
  createCloudVaultProfile,
  fetchCloudVaultProfile,
  pushPendingVaultRecords,
  rotateCloudVaultProfileKey,
  subscribeToCloudVault,
} from '../lib/syncEngine';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  advanceDateByCycle,
  createRecordId,
  getOffsetDateISO,
  getTodayISO,
} from '../lib/format';
import {
  clearNotificationSentLog,
  dispatchLocalNotification,
  firePendingReminderNotifications,
  getNotificationPermission,
  maybeFireEveningSummary,
  requestNotificationPermission,
  updateAppBadge,
} from '../lib/notifications';

export type VaultPhase =
  | 'loading'
  | 'needs-setup'
  | 'needs-unlock'
  | 'unlocked';

export const DEFAULT_TASK_LIST_ID = 'list_default';

export interface SnackbarNotice {
  id: number;
  message: string;
  undoLabel?: string;
  onUndo?: () => Promise<void> | void;
}

const DEFAULT_PREFERENCES: HubPreferences = {
  id: 'prefs_default',
  currency: '$',
  monthlyBudget: 2000,
  monthlySavingsGoal: 500,
  autoLockMinutes: 15,
  accentTheme: 'blue',
  density: 'comfortable',
  weekStartsOn: 'sunday',
  notificationsEnabled: false,
  dailyDigestTime: '09:00',
  notifyTasks: true,
  notifyHabits: true,
  notifySubscriptions: true,
  notifyEvents: true,
  notifyGoals: true,
  oledDark: false,
  privacyBlur: false,
  quietHoursEnabled: false,
  quietStart: '22:00',
  quietEnd: '07:00',
  categoryBudgets: {},
  scratchpad: '',
  updatedAt: 0,
};

interface VaultContextValue {
  phase: VaultPhase;
  vaultMeta: LocalVaultMeta | null;
  user: User | null;
  authReady: boolean;
  isOnline: boolean;
  syncStatus: SyncStatusState;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  accentTheme: AccentTheme;
  setAccentTheme: (accent: AccentTheme) => void;
  purchases: PurchaseRecord[];
  subscriptions: SubscriptionRecord[];
  habits: HabitRecord[];
  tasks: TaskRecord[];
  taskLists: TaskListRecord[];
  calendarEvents: CalendarEventRecord[];
  goals: GoalRecord[];
  preferences: HubPreferences;
  snackbar: SnackbarNotice | null;
  dismissSnackbar: () => void;
  setupPassphraseVault: (passphrase: string) => Promise<void>;
  setupDeviceKeyVault: () => Promise<void>;
  unlockWithPassphrase: (passphrase: string) => Promise<boolean>;
  lockVault: () => void;
  signInWithGoogle: () => Promise<void>;
  signOutGoogle: () => Promise<void>;
  triggerSyncNow: () => Promise<void>;
  changeVaultPassphrase: (newPassphrase: string) => Promise<void>;
  savePurchase: (
    data: Omit<PurchaseRecord, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    }
  ) => Promise<void>;
  duplicatePurchase: (purchase: PurchaseRecord) => Promise<void>;
  togglePurchaseReimbursed: (id: string) => Promise<void>;
  deletePurchase: (id: string) => Promise<void>;
  saveSubscription: (
    data: Omit<SubscriptionRecord, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    }
  ) => Promise<void>;
  toggleSubscriptionActive: (id: string) => Promise<void>;
  logSubscriptionPayment: (id: string) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  saveHabit: (
    data: Omit<HabitRecord, 'id' | 'createdAt' | 'updatedAt' | 'logs'> & {
      id?: string;
      logs?: Record<string, number>;
    }
  ) => Promise<void>;
  toggleHabitLog: (
    habitId: string,
    dateISO: string,
    mode?: 'toggle' | 'increment' | 'decrement' | 'complete'
  ) => Promise<void>;
  setHabitLogCount: (
    habitId: string,
    dateISO: string,
    count: number
  ) => Promise<void>;
  toggleHabitFreeze: (habitId: string, dateISO: string) => Promise<void>;
  toggleHabitArchived: (id: string, archived: boolean) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  createTaskList: (name: string) => Promise<TaskListRecord>;
  renameTaskList: (id: string, name: string) => Promise<void>;
  deleteTaskList: (id: string) => Promise<void>;
  saveTask: (
    data: Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<void>;
  toggleTaskCompleted: (id: string) => Promise<void>;
  toggleTaskStarred: (id: string) => Promise<void>;
  toggleTaskSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  addSubtaskToTask: (taskId: string, text: string) => Promise<void>;
  deleteSubtaskFromTask: (taskId: string, subtaskId: string) => Promise<void>;
  moveTaskToList: (taskId: string, listId: string) => Promise<void>;
  reorderTaskInList: (
    taskId: string,
    direction: 'up' | 'down',
    visibleOrderedIds: string[]
  ) => Promise<void>;
  logTaskFocusMinutes: (taskId: string, minutes: number) => Promise<void>;
  batchUpdateTasks: (
    ids: string[],
    action: 'complete' | 'tomorrow' | 'delete'
  ) => Promise<void>;
  rescheduleMissedToToday: () => Promise<number>;
  deleteTask: (id: string) => Promise<void>;
  snoozeTaskToTomorrow: (id: string) => Promise<void>;
  clearCompletedTasks: (listId?: string) => Promise<void>;
  saveCalendarEvent: (
    data: Omit<CalendarEventRecord, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    }
  ) => Promise<void>;
  deleteCalendarEvent: (id: string) => Promise<void>;
  saveGoal: (
    data: Omit<GoalRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  setGoalStatus: (id: string, status: GoalStatus) => Promise<void>;
  adjustGoalValue: (id: string, delta: number) => Promise<void>;
  toggleGoalMilestone: (goalId: string, milestoneId: string) => Promise<void>;
  updatePreferences: (
    patch:
      | Partial<HubPreferences>
      | ((prev: HubPreferences) => Partial<HubPreferences>)
  ) => Promise<void>;
  sendTestNotification: () => Promise<boolean>;
  runReminderSweepNow: () => Promise<number>;
  exportEncryptedBackup: () => Promise<string>;
  exportPlaintextBackup: () => string;
  importPlaintextBackup: (rawJson: string) => Promise<number>;
  wipeLocalVault: () => Promise<void>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used within VaultProvider');
  return ctx;
}

/** Copy only the listed keys that are actually set on `src`. */
function pickDefined<T extends object, K extends keyof T>(
  src: T,
  keys: K[]
): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const k of keys) {
    if (src[k] !== undefined) out[k] = src[k];
  }
  return out;
}

function applyThemeToDOM(mode: ThemeMode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldBeDark = mode === 'dark' || (mode === 'system' && prefersDark);
  if (shouldBeDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const isOnline = useOnlineStatus();
  const [phase, setPhase] = useState<VaultPhase>('loading');
  const [vaultMeta, setVaultMeta] = useState<LocalVaultMeta | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [habits, setHabits] = useState<HabitRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [taskLists, setTaskLists] = useState<TaskListRecord[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventRecord[]>(
    []
  );
  const [goals, setGoals] = useState<GoalRecord[]>([]);
  const [preferences, setPreferences] =
    useState<HubPreferences>(DEFAULT_PREFERENCES);
  const [snackbar, setSnackbar] = useState<SnackbarNotice | null>(null);
  const snackbarTimerRef = useRef<number | null>(null);

  const [syncStatus, setSyncStatus] = useState<SyncStatusState>({
    phase: 'local-only',
    pendingCount: 0,
    lastSyncedAt: null,
  });

  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('mmv_hub_theme') as ThemeMode | null;
    return saved || 'system';
  });

  const [accentTheme, setAccentThemeState] = useState<AccentTheme>(() => {
    const saved = localStorage.getItem('mmv_hub_accent') as AccentTheme | null;
    return saved || 'blue';
  });

  const activeKeyRef = useRef<CryptoKey | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const showSnackbar = useCallback(
    (
      message: string,
      undoLabel?: string,
      onUndo?: () => Promise<void> | void
    ) => {
      if (snackbarTimerRef.current) {
        window.clearTimeout(snackbarTimerRef.current);
      }
      const id = Date.now();
      setSnackbar({ id, message, undoLabel, onUndo });
      snackbarTimerRef.current = window.setTimeout(() => {
        setSnackbar((curr) => (curr?.id === id ? null : curr));
      }, 5000);
    },
    []
  );

  const dismissSnackbar = useCallback(() => {
    if (snackbarTimerRef.current) {
      window.clearTimeout(snackbarTimerRef.current);
    }
    setSnackbar(null);
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    localStorage.setItem('mmv_hub_theme', next);
    applyThemeToDOM(next);
  }, []);

  const setAccentTheme = useCallback((next: AccentTheme) => {
    setAccentThemeState(next);
    localStorage.setItem('mmv_hub_accent', next);
    document.documentElement.dataset.accent = next;
  }, []);

  useEffect(() => {
    applyThemeToDOM(theme);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (theme === 'system') applyThemeToDOM('system');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.accent = accentTheme;
  }, [accentTheme]);

  useEffect(() => {
    document.documentElement.dataset.oled = preferences.oledDark
      ? 'true'
      : 'false';
  }, [preferences.oledDark]);

  const reloadAndDecryptRecords = useCallback(async (key: CryptoKey) => {
    const records = await getAllLocalRecords();
    const nextPurchases: PurchaseRecord[] = [];
    const nextSubscriptions: SubscriptionRecord[] = [];
    const nextHabits: HabitRecord[] = [];
    const nextTasks: TaskRecord[] = [];
    const nextTaskLists: TaskListRecord[] = [];
    const nextCalendarEvents: CalendarEventRecord[] = [];
    const nextGoals: GoalRecord[] = [];
    let nextPrefs: HubPreferences = DEFAULT_PREFERENCES;
    let pendingCount = 0;

    for (const rec of records) {
      if (rec.syncState === 'pending') pendingCount++;
      if (rec.deleted) continue;
      try {
        if (rec.kind === 'purchase') {
          nextPurchases.push(
            await decryptPayload<PurchaseRecord>(key, rec.iv, rec.ciphertext)
          );
        } else if (rec.kind === 'subscription') {
          nextSubscriptions.push(
            await decryptPayload<SubscriptionRecord>(
              key,
              rec.iv,
              rec.ciphertext
            )
          );
        } else if (rec.kind === 'habit') {
          nextHabits.push(
            await decryptPayload<HabitRecord>(key, rec.iv, rec.ciphertext)
          );
        } else if (rec.kind === 'task') {
          nextTasks.push(
            await decryptPayload<TaskRecord>(key, rec.iv, rec.ciphertext)
          );
        } else if (rec.kind === 'tasklist') {
          nextTaskLists.push(
            await decryptPayload<TaskListRecord>(key, rec.iv, rec.ciphertext)
          );
        } else if (rec.kind === 'calendar') {
          nextCalendarEvents.push(
            await decryptPayload<CalendarEventRecord>(
              key,
              rec.iv,
              rec.ciphertext
            )
          );
        } else if (rec.kind === 'goal') {
          nextGoals.push(
            await decryptPayload<GoalRecord>(key, rec.iv, rec.ciphertext)
          );
        } else if (rec.kind === 'prefs') {
          nextPrefs = await decryptPayload<HubPreferences>(
            key,
            rec.iv,
            rec.ciphertext
          );
        }
      } catch {
        // Ignore records encrypted with mismatched key
      }
    }

    nextPurchases.sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt
    );
    nextSubscriptions.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.nextBillingDate.localeCompare(b.nextBillingDate);
    });
    nextHabits.sort((a, b) => a.createdAt - b.createdAt);
    nextTaskLists.sort((a, b) => a.createdAt - b.createdAt);
    nextTasks.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const ao = a.order ?? -a.createdAt;
      const bo = b.order ?? -b.createdAt;
      return ao - bo;
    });
    nextCalendarEvents.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.startTime || '').localeCompare(b.startTime || '')
    );

    setPurchases(nextPurchases);
    setSubscriptions(nextSubscriptions);
    setHabits(nextHabits);
    setTasks(nextTasks);
    setTaskLists(nextTaskLists);
    setCalendarEvents(nextCalendarEvents);
    const statusRank: Record<GoalStatus, number> = {
      active: 0,
      paused: 1,
      completed: 2,
    };
    nextGoals.sort(
      (a, b) =>
        statusRank[a.status] - statusRank[b.status] ||
        (a.targetDate || '9999').localeCompare(b.targetDate || '9999') ||
        a.createdAt - b.createdAt
    );
    setGoals(nextGoals);
    setPreferences({ ...DEFAULT_PREFERENCES, ...nextPrefs });
    if (nextPrefs.accentTheme) {
      setAccentThemeState(nextPrefs.accentTheme);
      localStorage.setItem('mmv_hub_accent', nextPrefs.accentTheme);
      document.documentElement.dataset.accent = nextPrefs.accentTheme;
    }
    setSyncStatus((prev) => ({ ...prev, pendingCount }));
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const meta = await getLocalVaultMeta();
      if (!mounted) return;
      setVaultMeta(meta);
      if (!meta) {
        setPhase('needs-setup');
        return;
      }
      if (meta.mode === 'device' && meta.deviceKeyJwk) {
        try {
          const key = await importDeviceKey(meta.deviceKeyJwk);
          const ok = await verifyVaultKey(
            key,
            meta.verifierIv,
            meta.verifierCiphertext
          );
          if (ok && mounted) {
            activeKeyRef.current = key;
            await reloadAndDecryptRecords(key);
            setPhase('unlocked');
            return;
          }
        } catch {
          // Fall back to unlock
        }
      }
      setPhase('needs-unlock');
    })();
    return () => {
      mounted = false;
    };
  }, [reloadAndDecryptRecords]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser && isOnline) {
        try {
          const cloudProfile = await fetchCloudVaultProfile(nextUser.uid);
          const localMeta = await getLocalVaultMeta();
          if (cloudProfile && !localMeta) {
            const adoptedMeta: LocalVaultMeta = {
              id: 'local',
              mode: 'passphrase',
              salt: cloudProfile.vaultSalt,
              verifierIv: cloudProfile.verifierIv,
              verifierCiphertext: cloudProfile.verifierCiphertext,
              ownerUid: nextUser.uid,
            };
            await saveLocalVaultMeta(adoptedMeta);
            setVaultMeta(adoptedMeta);
            setPhase((curr) => (curr === 'unlocked' ? curr : 'needs-unlock'));
          }
        } catch {
          // Handled via sync status
        }
      }
    });
    return () => unsub();
  }, [isOnline]);

  const runPushSync = useCallback(async () => {
    if (!user || !isOnline || phase !== 'unlocked') {
      const all = await getAllLocalRecords();
      const pendingCount = all.filter((r) => r.syncState === 'pending').length;
      setSyncStatus((prev) => ({
        ...prev,
        phase: !user ? 'local-only' : !isOnline ? 'offline' : prev.phase,
        pendingCount,
      }));
      return;
    }

    setSyncStatus((prev) => ({
      ...prev,
      phase: 'syncing',
      errorMessage: undefined,
    }));
    try {
      const meta = await getLocalVaultMeta();
      if (meta) {
        const cloudProfile = await fetchCloudVaultProfile(user.uid);
        if (!cloudProfile) {
          await createCloudVaultProfile(
            user.uid,
            user.email || 'user@mmvhub.local',
            user.displayName || 'Personal Vault',
            meta
          );
        }
      }
      await pushPendingVaultRecords(user.uid);
      const now = Date.now();
      const currentMeta = await getLocalVaultMeta();
      if (currentMeta) {
        const updatedMeta: LocalVaultMeta = {
          ...currentMeta,
          ownerUid: user.uid,
          lastSyncedAt: now,
        };
        await saveLocalVaultMeta(updatedMeta);
        setVaultMeta(updatedMeta);
      }
      setSyncStatus({
        phase: 'synced',
        pendingCount: 0,
        lastSyncedAt: now,
      });
    } catch (err) {
      setSyncStatus((prev) => ({
        ...prev,
        phase: 'error',
        errorMessage: err instanceof Error ? err.message : 'Sync failed',
      }));
    }
  }, [user, isOnline, phase]);

  useEffect(() => {
    if (!authReady || phase !== 'unlocked') return;
    if (!user) {
      setSyncStatus((prev) => ({ ...prev, phase: 'local-only' }));
      return;
    }
    if (!isOnline) {
      setSyncStatus((prev) => ({ ...prev, phase: 'offline' }));
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      await runPushSync();
      if (cancelled) return;
      unsubscribe = subscribeToCloudVault(
        user.uid,
        async () => {
          if (activeKeyRef.current) {
            await reloadAndDecryptRecords(activeKeyRef.current);
          }
          setSyncStatus((prev) => ({
            ...prev,
            phase: 'synced',
            lastSyncedAt: Date.now(),
          }));
        },
        (err) => {
          setSyncStatus((prev) => ({
            ...prev,
            phase: 'error',
            errorMessage: err.message,
          }));
        }
      );
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [authReady, phase, user, isOnline, runPushSync, reloadAndDecryptRecords]);

  const lockVault = useCallback(() => {
    activeKeyRef.current = null;
    setPurchases([]);
    setSubscriptions([]);
    setHabits([]);
    setTasks([]);
    setTaskLists([]);
    setCalendarEvents([]);
    setGoals([]);
    setPreferences(DEFAULT_PREFERENCES);
    setPhase('needs-unlock');
  }, []);

  useEffect(() => {
    if (
      phase !== 'unlocked' ||
      vaultMeta?.mode !== 'passphrase' ||
      preferences.autoLockMinutes <= 0
    ) {
      return;
    }

    const touch = () => {
      lastActivityRef.current = Date.now();
    };
    window.addEventListener('pointerdown', touch, { passive: true });
    window.addEventListener('keydown', touch, { passive: true });

    const interval = window.setInterval(() => {
      const elapsedMin = (Date.now() - lastActivityRef.current) / 60000;
      if (elapsedMin >= preferences.autoLockMinutes) {
        lockVault();
      }
    }, 15000);

    return () => {
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('keydown', touch);
      window.clearInterval(interval);
    };
  }, [phase, vaultMeta?.mode, preferences.autoLockMinutes, lockVault]);

  const setupPassphraseVault = useCallback(
    async (passphrase: string) => {
      const salt = generateSaltBase64();
      const key = await derivePassphraseKey(passphrase, salt);
      const { verifierIv, verifierCiphertext } = await createKeyVerifier(key);
      const meta: LocalVaultMeta = {
        id: 'local',
        mode: 'passphrase',
        salt,
        verifierIv,
        verifierCiphertext,
        ownerUid: user?.uid,
      };
      await saveLocalVaultMeta(meta);
      activeKeyRef.current = key;
      setVaultMeta(meta);
      await reloadAndDecryptRecords(key);
      setPhase('unlocked');
    },
    [user?.uid, reloadAndDecryptRecords]
  );

  const setupDeviceKeyVault = useCallback(async () => {
    const salt = generateSaltBase64();
    const { key, jwk } = await generateDeviceKey();
    const { verifierIv, verifierCiphertext } = await createKeyVerifier(key);
    const meta: LocalVaultMeta = {
      id: 'local',
      mode: 'device',
      salt,
      verifierIv,
      verifierCiphertext,
      deviceKeyJwk: jwk,
      ownerUid: user?.uid,
    };
    await saveLocalVaultMeta(meta);
    activeKeyRef.current = key;
    setVaultMeta(meta);
    await reloadAndDecryptRecords(key);
    setPhase('unlocked');
  }, [user?.uid, reloadAndDecryptRecords]);

  const unlockWithPassphrase = useCallback(
    async (passphrase: string): Promise<boolean> => {
      const meta = await getLocalVaultMeta();
      if (!meta) return false;
      const key = await derivePassphraseKey(passphrase, meta.salt);
      const ok = await verifyVaultKey(
        key,
        meta.verifierIv,
        meta.verifierCiphertext
      );
      if (!ok) return false;
      activeKeyRef.current = key;
      lastActivityRef.current = Date.now();
      await reloadAndDecryptRecords(key);
      setPhase('unlocked');
      return true;
    },
    [reloadAndDecryptRecords]
  );

  const signInWithGoogle = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    const signedInUser = cred.user;
    if (isOnline) {
      const cloudProfile = await fetchCloudVaultProfile(signedInUser.uid);
      const localMeta = await getLocalVaultMeta();
      if (cloudProfile && !localMeta) {
        const adoptedMeta: LocalVaultMeta = {
          id: 'local',
          mode: 'passphrase',
          salt: cloudProfile.vaultSalt,
          verifierIv: cloudProfile.verifierIv,
          verifierCiphertext: cloudProfile.verifierCiphertext,
          ownerUid: signedInUser.uid,
        };
        await saveLocalVaultMeta(adoptedMeta);
        setVaultMeta(adoptedMeta);
        setPhase('needs-unlock');
      } else if (cloudProfile && localMeta && activeKeyRef.current) {
        const matches = await verifyVaultKey(
          activeKeyRef.current,
          cloudProfile.verifierIv,
          cloudProfile.verifierCiphertext
        );
        if (!matches) {
          const adoptedMeta: LocalVaultMeta = {
            id: 'local',
            mode: 'passphrase',
            salt: cloudProfile.vaultSalt,
            verifierIv: cloudProfile.verifierIv,
            verifierCiphertext: cloudProfile.verifierCiphertext,
            ownerUid: signedInUser.uid,
          };
          await saveLocalVaultMeta(adoptedMeta);
          setVaultMeta(adoptedMeta);
          activeKeyRef.current = null;
          setPhase('needs-unlock');
        }
      }
    }
  }, [isOnline]);

  const signOutGoogle = useCallback(async () => {
    await signOut(auth);
    setSyncStatus((prev) => ({ ...prev, phase: 'local-only' }));
  }, []);

  const persistEncryptedRecord = useCallback(
    async <T extends { id: string }>(
      kind: VaultRecordKind,
      payload: T,
      deleted = false,
      opts?: { deferRefresh?: boolean }
    ) => {
      const key = activeKeyRef.current;
      if (!key) throw new Error('Vault is locked');
      const existingRec = await getLocalRecord(payload.id);
      const { iv, ciphertext } = await encryptPayload(key, payload);
      const now = Date.now();
      const record: LocalVaultRecord = {
        id: payload.id,
        kind,
        iv,
        ciphertext,
        version: (existingRec?.version ?? 0) + 1,
        deleted,
        clientUpdatedAt: now,
        syncState: 'pending',
        syncedToCloud: existingRec?.syncedToCloud ?? false,
      };
      await putLocalRecord(record);
      // Bulk operations defer the (full-vault) decrypt + cloud push and call
      // refreshAfterBatch() once at the end instead of once per record.
      if (opts?.deferRefresh) return;
      await reloadAndDecryptRecords(key);
      if (user && isOnline) {
        void runPushSync();
      }
    },
    [user, isOnline, reloadAndDecryptRecords, runPushSync]
  );

  const refreshAfterBatch = useCallback(async () => {
    const key = activeKeyRef.current;
    if (!key) return;
    await reloadAndDecryptRecords(key);
    if (user && isOnline) {
      void runPushSync();
    }
  }, [user, isOnline, reloadAndDecryptRecords, runPushSync]);

  // Purchases
  const savePurchase = useCallback(
    async (
      data: Omit<PurchaseRecord, 'id' | 'createdAt' | 'updatedAt'> & {
        id?: string;
      }
    ) => {
      const now = Date.now();
      const existingItem = data.id
        ? purchases.find((p) => p.id === data.id)
        : undefined;
      const cleanTags =
        data.tags && data.tags.length > 0
          ? [...new Set(data.tags.map((t) => t.trim()).filter(Boolean))].slice(
              0,
              8
            )
          : undefined;
      const resolvedEntryType =
        data.entryType ?? (data.isRefund ? 'refund' : 'expense');
      const record: PurchaseRecord = {
        id: data.id || createRecordId('pur'),
        title: data.title.trim(),
        amount: Number(data.amount),
        category: data.category,
        paymentMethod: data.paymentMethod,
        date: data.date,
        notes: data.notes?.trim() || undefined,
        recurring: Boolean(data.recurring),
        entryType: resolvedEntryType,
        isRefund: resolvedEntryType === 'refund',
        returnByDate:
          resolvedEntryType === 'expense'
            ? data.returnByDate || undefined
            : undefined,
        reimbursable:
          resolvedEntryType === 'expense' ? Boolean(data.reimbursable) : false,
        reimbursed:
          resolvedEntryType === 'expense' && data.reimbursable
            ? Boolean(data.reimbursed)
            : false,
        tags: cleanTags,
        createdAt: existingItem?.createdAt ?? now,
        updatedAt: now,
      };
      await persistEncryptedRecord('purchase', record, false);
      showSnackbar(
        existingItem
          ? 'Entry updated'
          : resolvedEntryType === 'income'
            ? 'Income logged'
            : resolvedEntryType === 'refund'
              ? 'Refund logged'
              : 'Purchase logged'
      );
    },
    [purchases, persistEncryptedRecord, showSnackbar]
  );

  const duplicatePurchase = useCallback(
    async (purchase: PurchaseRecord) => {
      const now = Date.now();
      const record: PurchaseRecord = {
        ...purchase,
        id: createRecordId('pur'),
        date: getTodayISO(),
        reimbursed: false,
        createdAt: now,
        updatedAt: now,
      };
      await persistEncryptedRecord('purchase', record, false);
      showSnackbar(`Logged copy of "${purchase.title}"`);
    },
    [persistEncryptedRecord, showSnackbar]
  );

  const togglePurchaseReimbursed = useCallback(
    async (id: string) => {
      const target = purchases.find((p) => p.id === id);
      if (!target) return;
      const next = !target.reimbursed;
      await persistEncryptedRecord(
        'purchase',
        { ...target, reimbursed: next, updatedAt: Date.now() },
        false
      );
      showSnackbar(
        next
          ? `Marked "${target.title}" reimbursed`
          : `Marked "${target.title}" awaiting reimbursement`
      );
    },
    [purchases, persistEncryptedRecord, showSnackbar]
  );

  const deletePurchase = useCallback(
    async (id: string) => {
      const target = purchases.find((p) => p.id === id);
      if (!target) return;
      await persistEncryptedRecord(
        'purchase',
        { ...target, updatedAt: Date.now() },
        true
      );
      showSnackbar(`Deleted "${target.title}"`, 'Undo', async () => {
        const now = Date.now();
        await persistEncryptedRecord(
          'purchase',
          {
            ...target,
            id: createRecordId('pur'),
            createdAt: now,
            updatedAt: now,
          },
          false
        );
      });
    },
    [purchases, persistEncryptedRecord, showSnackbar]
  );

  // Subscriptions
  const saveSubscription = useCallback(
    async (
      data: Omit<SubscriptionRecord, 'id' | 'createdAt' | 'updatedAt'> & {
        id?: string;
      }
    ) => {
      const now = Date.now();
      const existingItem = data.id
        ? subscriptions.find((s) => s.id === data.id)
        : undefined;
      const cleanUrl = data.manageUrl?.trim();
      const safeUrl =
        cleanUrl &&
        (cleanUrl.startsWith('https://') || cleanUrl.startsWith('http://'))
          ? cleanUrl
          : undefined;

      const nextAmount = Number(data.amount);
      const existingHistory = data.priceHistory ?? existingItem?.priceHistory ?? [];
      let nextPriceHistory = [...existingHistory];
      if (existingItem && existingItem.amount !== nextAmount) {
        if (nextPriceHistory.length === 0) {
          nextPriceHistory.push({
            date: existingItem.lastPaidDate || getTodayISO(),
            amount: existingItem.amount,
          });
        }
        nextPriceHistory.push({
          date: getTodayISO(),
          amount: nextAmount,
        });
        nextPriceHistory = nextPriceHistory.slice(-10);
      }

      const cleanLast4 = data.cardLast4?.replace(/\D/g, '').slice(0, 4);
      const cleanExpiry = data.cardExpiry?.trim().slice(0, 7);

      const record: SubscriptionRecord = {
        id: data.id || createRecordId('sub'),
        name: data.name.trim(),
        amount: nextAmount,
        billingCycle: data.billingCycle,
        nextBillingDate: data.nextBillingDate,
        category: data.category,
        paymentMethod: data.paymentMethod,
        active: Boolean(data.active),
        isTrial: Boolean(data.isTrial),
        reminderDays:
          data.reminderDays !== undefined
            ? Math.max(0, Math.min(30, Math.round(data.reminderDays)))
            : existingItem?.reminderDays ?? 3,
        manageUrl: safeUrl,
        cardLast4: cleanLast4 || undefined,
        cardExpiry: cleanExpiry || undefined,
        usageStatus: data.usageStatus ?? existingItem?.usageStatus ?? 'active',
        priceHistory: nextPriceHistory.length > 0 ? nextPriceHistory : undefined,
        lastPaidDate: data.lastPaidDate ?? existingItem?.lastPaidDate,
        totalPaidCount: data.totalPaidCount ?? existingItem?.totalPaidCount ?? 0,
        notes: data.notes?.trim() || undefined,
        createdAt: existingItem?.createdAt ?? now,
        updatedAt: now,
      };
      await persistEncryptedRecord('subscription', record, false);
      showSnackbar(
        existingItem ? 'Subscription updated' : 'Subscription added'
      );
    },
    [subscriptions, persistEncryptedRecord, showSnackbar]
  );

  const toggleSubscriptionActive = useCallback(
    async (id: string) => {
      const target = subscriptions.find((s) => s.id === id);
      if (!target) return;
      await persistEncryptedRecord(
        'subscription',
        { ...target, active: !target.active, updatedAt: Date.now() },
        false
      );
      showSnackbar(
        target.active
          ? `Paused "${target.name}"`
          : `Resumed "${target.name}"`
      );
    },
    [subscriptions, persistEncryptedRecord, showSnackbar]
  );

  const logSubscriptionPayment = useCallback(
    async (id: string) => {
      const sub = subscriptions.find((s) => s.id === id);
      if (!sub) return;
      const now = Date.now();
      const todayISO = getTodayISO();
      const purchase: PurchaseRecord = {
        id: createRecordId('pur'),
        title: `${sub.name} (${sub.billingCycle})`,
        amount: sub.amount,
        category: sub.category,
        paymentMethod: sub.paymentMethod,
        date: todayISO,
        notes: sub.notes || 'Subscription renewal payment',
        recurring: true,
        tags: ['Subscription'],
        createdAt: now,
        updatedAt: now,
      };
      await persistEncryptedRecord('purchase', purchase, false);
      const nextDate = advanceDateByCycle(
        sub.nextBillingDate,
        sub.billingCycle
      );
      await persistEncryptedRecord(
        'subscription',
        {
          ...sub,
          nextBillingDate: nextDate,
          isTrial: false,
          lastPaidDate: todayISO,
          totalPaidCount: (sub.totalPaidCount ?? 0) + 1,
          updatedAt: Date.now(),
        },
        false
      );
      showSnackbar(`Logged "${sub.name}" payment & advanced renewal to ${nextDate}`);
    },
    [subscriptions, persistEncryptedRecord, showSnackbar]
  );

  const deleteSubscription = useCallback(
    async (id: string) => {
      const target = subscriptions.find((s) => s.id === id);
      if (!target) return;
      await persistEncryptedRecord(
        'subscription',
        { ...target, updatedAt: Date.now() },
        true
      );
      showSnackbar(`Removed "${target.name}"`, 'Undo', async () => {
        const now = Date.now();
        await persistEncryptedRecord(
          'subscription',
          {
            ...target,
            id: createRecordId('sub'),
            createdAt: now,
            updatedAt: now,
          },
          false
        );
      });
    },
    [subscriptions, persistEncryptedRecord, showSnackbar]
  );

  // Habits
  const saveHabit = useCallback(
    async (
      data: Omit<HabitRecord, 'id' | 'createdAt' | 'updatedAt' | 'logs'> & {
        id?: string;
        logs?: Record<string, number>;
      }
    ) => {
      const now = Date.now();
      const existingItem = data.id
        ? habits.find((h) => h.id === data.id)
        : undefined;
      const cleanQuota =
        data.weeklyQuota !== undefined && data.weeklyQuota > 0
          ? Math.min(7, Math.max(1, Math.round(data.weeklyQuota)))
          : undefined;
      const record: HabitRecord = {
        // Keep fields this form doesn't manage (habitType, progressive, …)
        ...existingItem,
        ...pickDefined(data, [
          'habitType',
          'goalContribution',
          'progressiveStart',
          'progressiveStep',
          'progressiveEveryDays',
          'progressiveCap',
        ]),
        goalId:
          'goalId' in data ? data.goalId || undefined : existingItem?.goalId,
        id: data.id || createRecordId('hab'),
        name: data.name.trim(),
        mode: data.mode ?? existingItem?.mode ?? 'build',
        cadence: data.cadence,
        weeklyQuota: cleanQuota,
        customWeekdays:
          data.customWeekdays && data.customWeekdays.length > 0
            ? [...new Set(data.customWeekdays)].sort((a, b) => a - b)
            : undefined,
        customMode: data.customMode,
        intervalDays:
          data.intervalDays !== undefined
            ? Math.max(1, Math.round(data.intervalDays))
            : undefined,
        startDate: data.startDate || existingItem?.startDate || getTodayISO(),
        monthlyDays:
          data.monthlyDays && data.monthlyDays.length > 0
            ? [...new Set(data.monthlyDays)]
            : undefined,
        timeOfDay: data.timeOfDay || 'anytime',
        preferredTime: data.preferredTime?.trim() || undefined,
        category: data.category?.trim() || undefined,
        color: data.color || 'green',
        notes: data.notes?.trim() || undefined,
        targetPerDay: Math.max(1, Math.round(data.targetPerDay)),
        unit: data.unit?.trim() || undefined,
        logs: data.logs ?? existingItem?.logs ?? {},
        freezeDates: data.freezeDates ?? existingItem?.freezeDates,
        archived: data.archived ?? existingItem?.archived ?? false,
        createdAt: existingItem?.createdAt ?? now,
        updatedAt: now,
      };
      await persistEncryptedRecord('habit', record, false);
      showSnackbar(existingItem ? 'Habit updated' : 'Habit created');
    },
    [habits, persistEncryptedRecord, showSnackbar]
  );

  const toggleHabitLog = useCallback(
    async (
      habitId: string,
      dateISO: string,
      mode: 'toggle' | 'increment' | 'decrement' | 'complete' = 'toggle'
    ) => {
      const target = habits.find((h) => h.id === habitId);
      if (!target) return;
      const curr = target.logs[dateISO] ?? 0;
      let nextVal = 0;
      if (mode === 'complete') {
        nextVal = curr >= target.targetPerDay ? 0 : target.targetPerDay;
      } else if (mode === 'decrement') {
        nextVal = Math.max(0, curr - 1);
      } else if (mode === 'increment' && target.targetPerDay > 1) {
        nextVal = curr >= target.targetPerDay ? 0 : curr + 1;
      } else {
        nextVal = curr >= target.targetPerDay ? 0 : target.targetPerDay;
      }
      const nextLogs = { ...target.logs };
      if (nextVal <= 0) {
        delete nextLogs[dateISO];
      } else {
        nextLogs[dateISO] = nextVal;
      }
      await persistEncryptedRecord(
        'habit',
        { ...target, logs: nextLogs, updatedAt: Date.now() },
        false
      );
    },
    [habits, persistEncryptedRecord]
  );

  const setHabitLogCount = useCallback(
    async (habitId: string, dateISO: string, count: number) => {
      const target = habits.find((h) => h.id === habitId);
      if (!target) return;
      const clean = Math.max(0, Math.round(count));
      const nextLogs = { ...target.logs };
      if (clean <= 0) {
        delete nextLogs[dateISO];
      } else {
        nextLogs[dateISO] = clean;
      }
      await persistEncryptedRecord(
        'habit',
        { ...target, logs: nextLogs, updatedAt: Date.now() },
        false
      );
    },
    [habits, persistEncryptedRecord]
  );

  const toggleHabitFreeze = useCallback(
    async (habitId: string, dateISO: string) => {
      const target = habits.find((h) => h.id === habitId);
      if (!target) return;
      const existing = target.freezeDates ?? [];
      const hasFreeze = existing.includes(dateISO);
      const nextFreezes = hasFreeze
        ? existing.filter((d) => d !== dateISO)
        : [...existing, dateISO].sort().slice(-60);
      await persistEncryptedRecord(
        'habit',
        {
          ...target,
          freezeDates: nextFreezes.length > 0 ? nextFreezes : undefined,
          updatedAt: Date.now(),
        },
        false
      );
      showSnackbar(
        hasFreeze
          ? `Removed streak freeze on ${dateISO}`
          : `Streak protected on ${dateISO}`
      );
    },
    [habits, persistEncryptedRecord, showSnackbar]
  );

  const toggleHabitArchived = useCallback(
    async (id: string, archived: boolean) => {
      const target = habits.find((h) => h.id === id);
      if (!target) return;
      await persistEncryptedRecord(
        'habit',
        { ...target, archived, updatedAt: Date.now() },
        false
      );
      showSnackbar(
        archived ? `Archived "${target.name}"` : `Restored "${target.name}"`
      );
    },
    [habits, persistEncryptedRecord, showSnackbar]
  );

  const deleteHabit = useCallback(
    async (id: string) => {
      const target = habits.find((h) => h.id === id);
      if (!target) return;
      await persistEncryptedRecord(
        'habit',
        { ...target, updatedAt: Date.now() },
        true
      );
      showSnackbar(`Deleted "${target.name}"`, 'Undo', async () => {
        const now = Date.now();
        await persistEncryptedRecord(
          'habit',
          {
            ...target,
            id: createRecordId('hab'),
            createdAt: now,
            updatedAt: now,
          },
          false
        );
      });
    },
    [habits, persistEncryptedRecord, showSnackbar]
  );

  // Google Tasks Lists & Tasks
  const createTaskList = useCallback(
    async (name: string): Promise<TaskListRecord> => {
      const now = Date.now();
      const list: TaskListRecord = {
        id: createRecordId('lst'),
        name: name.trim(),
        createdAt: now,
        updatedAt: now,
      };
      await persistEncryptedRecord('tasklist', list, false);
      showSnackbar(`List "${list.name}" created`);
      return list;
    },
    [persistEncryptedRecord, showSnackbar]
  );

  const renameTaskList = useCallback(
    async (id: string, name: string) => {
      const target = taskLists.find((l) => l.id === id);
      if (!target || !name.trim()) return;
      await persistEncryptedRecord(
        'tasklist',
        { ...target, name: name.trim(), updatedAt: Date.now() },
        false
      );
      showSnackbar('List renamed');
    },
    [taskLists, persistEncryptedRecord, showSnackbar]
  );

  const deleteTaskList = useCallback(
    async (id: string) => {
      const target = taskLists.find((l) => l.id === id);
      if (!target) return;
      const tasksInList = tasks.filter((t) => t.listId === id);
      for (const t of tasksInList) {
        await persistEncryptedRecord(
          'task',
          {
            ...t,
            listId: DEFAULT_TASK_LIST_ID,
            area: 'My Tasks',
            updatedAt: Date.now(),
          },
          false,
          { deferRefresh: true }
        );
      }
      await persistEncryptedRecord(
        'tasklist',
        { ...target, updatedAt: Date.now() },
        true,
        { deferRefresh: true }
      );
      await refreshAfterBatch();
      showSnackbar(`Deleted list "${target.name}" (tasks moved to My Tasks)`);
    },
    [taskLists, tasks, persistEncryptedRecord, refreshAfterBatch, showSnackbar]
  );

  const saveTask = useCallback(
    async (
      data: Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ) => {
      const now = Date.now();
      const existingItem = data.id
        ? tasks.find((t) => t.id === data.id)
        : undefined;
      const listId =
        data.listId ?? existingItem?.listId ?? DEFAULT_TASK_LIST_ID;
      const listObj = taskLists.find((l) => l.id === listId);
      const areaName =
        listId === DEFAULT_TASK_LIST_ID
          ? 'My Tasks'
          : listObj?.name ?? data.area?.trim() ?? 'My Tasks';

      const record: TaskRecord = {
        // Keep fields this form doesn't manage (taskType, progress, …)
        ...existingItem,
        ...pickDefined(data, [
          'taskType',
          'progressCurrent',
          'progressTarget',
          'progressUnit',
        ]),
        goalId:
          'goalId' in data ? data.goalId || undefined : existingItem?.goalId,
        id: data.id || createRecordId('tsk'),
        listId,
        title: data.title.trim(),
        completed: Boolean(data.completed),
        starred: Boolean(data.starred),
        starredAt: data.starred
          ? existingItem?.starredAt ?? now
          : undefined,
        priority: data.priority,
        dueDate: data.dueDate || undefined,
        dueTime: data.dueTime || undefined,
        repeat: data.repeat ?? 'none',
        order: data.order ?? existingItem?.order ?? -now,
        area: areaName,
        notes: data.notes?.trim() || undefined,
        subtasks: data.subtasks,
        estimateMinutes:
          data.estimateMinutes && data.estimateMinutes > 0
            ? Math.round(data.estimateMinutes)
            : undefined,
        focusedMinutes: data.focusedMinutes ?? existingItem?.focusedMinutes,
        completedAt: data.completed
          ? existingItem?.completedAt ?? now
          : undefined,
        createdAt: existingItem?.createdAt ?? now,
        updatedAt: now,
      };
      await persistEncryptedRecord('task', record, false);
    },
    [tasks, taskLists, persistEncryptedRecord]
  );

  const toggleTaskCompleted = useCallback(
    async (id: string) => {
      const target = tasks.find((t) => t.id === id);
      if (!target) return;
      const nextCompleted = !target.completed;
      const now = Date.now();
      await persistEncryptedRecord(
        'task',
        {
          ...target,
          completed: nextCompleted,
          completedAt: nextCompleted ? now : undefined,
          updatedAt: now,
        },
        false
      );

      // Google Tasks repeating task scheduling: create next occurrence upon completion
      if (nextCompleted && target.repeat && target.repeat !== 'none') {
        const baseDate = target.dueDate || getTodayISO();
        const nextDue = advanceDateByCycle(baseDate, target.repeat);
        const nextTask: TaskRecord = {
          ...target,
          id: createRecordId('tsk'),
          completed: false,
          completedAt: undefined,
          dueDate: nextDue,
          subtasks: target.subtasks?.map((s) => ({ ...s, done: false })),
          order: -(now + 1),
          createdAt: now,
          updatedAt: now,
        };
        await persistEncryptedRecord('task', nextTask, false);
        showSnackbar(
          `Completed · Next scheduled for ${nextDue}`,
          'Undo',
          async () => {
            await persistEncryptedRecord(
              'task',
              { ...nextTask, updatedAt: Date.now() },
              true
            );
            await persistEncryptedRecord(
              'task',
              {
                ...target,
                completed: false,
                completedAt: undefined,
                updatedAt: Date.now(),
              },
              false
            );
          }
        );
        return;
      }

      if (nextCompleted) {
        showSnackbar('Task completed', 'Undo', async () => {
          await persistEncryptedRecord(
            'task',
            {
              ...target,
              completed: false,
              completedAt: undefined,
              updatedAt: Date.now(),
            },
            false
          );
        });
      }
    },
    [tasks, persistEncryptedRecord, showSnackbar]
  );

  const toggleTaskStarred = useCallback(
    async (id: string) => {
      const target = tasks.find((t) => t.id === id);
      if (!target) return;
      const nextStar = !target.starred;
      await persistEncryptedRecord(
        'task',
        {
          ...target,
          starred: nextStar,
          starredAt: nextStar ? Date.now() : undefined,
          updatedAt: Date.now(),
        },
        false
      );
    },
    [tasks, persistEncryptedRecord]
  );

  const toggleTaskSubtask = useCallback(
    async (taskId: string, subtaskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target || !target.subtasks) return;
      const nextSubs = target.subtasks.map((s) =>
        s.id === subtaskId ? { ...s, done: !s.done } : s
      );
      await persistEncryptedRecord(
        'task',
        { ...target, subtasks: nextSubs, updatedAt: Date.now() },
        false
      );
    },
    [tasks, persistEncryptedRecord]
  );

  const addSubtaskToTask = useCallback(
    async (taskId: string, text: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target || !text.trim()) return;
      const nextSubs = [
        ...(target.subtasks || []),
        {
          id: `sub_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
          text: text.trim(),
          done: false,
        },
      ];
      await persistEncryptedRecord(
        'task',
        { ...target, subtasks: nextSubs, updatedAt: Date.now() },
        false
      );
    },
    [tasks, persistEncryptedRecord]
  );

  const deleteSubtaskFromTask = useCallback(
    async (taskId: string, subtaskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target || !target.subtasks) return;
      const nextSubs = target.subtasks.filter((s) => s.id !== subtaskId);
      await persistEncryptedRecord(
        'task',
        {
          ...target,
          subtasks: nextSubs.length > 0 ? nextSubs : undefined,
          updatedAt: Date.now(),
        },
        false
      );
    },
    [tasks, persistEncryptedRecord]
  );

  const moveTaskToList = useCallback(
    async (taskId: string, listId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;
      const listObj = taskLists.find((l) => l.id === listId);
      const areaName =
        listId === DEFAULT_TASK_LIST_ID ? 'My Tasks' : listObj?.name ?? 'My Tasks';
      await persistEncryptedRecord(
        'task',
        { ...target, listId, area: areaName, updatedAt: Date.now() },
        false
      );
      showSnackbar(`Moved to "${areaName}"`);
    },
    [tasks, taskLists, persistEncryptedRecord, showSnackbar]
  );

  const reorderTaskInList = useCallback(
    async (
      taskId: string,
      direction: 'up' | 'down',
      visibleOrderedIds: string[]
    ) => {
      const idx = visibleOrderedIds.indexOf(taskId);
      if (idx === -1) return;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= visibleOrderedIds.length) return;

      const reordered = [...visibleOrderedIds];
      const [moved] = reordered.splice(idx, 1);
      reordered.splice(swapIdx, 0, moved);

      const now = Date.now();
      for (let i = 0; i < reordered.length; i++) {
        const t = tasks.find((x) => x.id === reordered[i]);
        // Only rewrite tasks whose order actually changes
        if (t && t.order !== (i + 1) * 100) {
          await persistEncryptedRecord(
            'task',
            { ...t, order: (i + 1) * 100, updatedAt: now },
            false,
            { deferRefresh: true }
          );
        }
      }
      await refreshAfterBatch();
    },
    [tasks, persistEncryptedRecord, refreshAfterBatch]
  );

  const snoozeTaskToTomorrow = useCallback(
    async (id: string) => {
      const target = tasks.find((t) => t.id === id);
      if (!target) return;
      const tomorrowISO = getOffsetDateISO(1, getTodayISO());
      await persistEncryptedRecord(
        'task',
        { ...target, dueDate: tomorrowISO, updatedAt: Date.now() },
        false
      );
      showSnackbar(`Moved "${target.title}" to tomorrow`);
    },
    [tasks, persistEncryptedRecord, showSnackbar]
  );

  const logTaskFocusMinutes = useCallback(
    async (taskId: string, minutes: number) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target || minutes <= 0) return;
      const nextMinutes = (target.focusedMinutes ?? 0) + Math.round(minutes);
      await persistEncryptedRecord(
        'task',
        { ...target, focusedMinutes: nextMinutes, updatedAt: Date.now() },
        false
      );
      showSnackbar(`Logged ${Math.round(minutes)}m focus on "${target.title}"`);
    },
    [tasks, persistEncryptedRecord, showSnackbar]
  );

  const batchUpdateTasks = useCallback(
    async (ids: string[], action: 'complete' | 'tomorrow' | 'delete') => {
      if (ids.length === 0) return;
      const tomorrowISO = getOffsetDateISO(1, getTodayISO());
      const now = Date.now();
      let count = 0;
      for (const id of ids) {
        const target = tasks.find((t) => t.id === id);
        if (!target) continue;
        if (action === 'complete') {
          if (!target.completed) {
            await persistEncryptedRecord(
              'task',
              { ...target, completed: true, completedAt: now, updatedAt: now },
              false,
              { deferRefresh: true }
            );
            count++;
          }
        } else if (action === 'tomorrow') {
          await persistEncryptedRecord(
            'task',
            { ...target, dueDate: tomorrowISO, updatedAt: now },
            false,
            { deferRefresh: true }
          );
          count++;
        } else if (action === 'delete') {
          await persistEncryptedRecord(
            'task',
            { ...target, updatedAt: now },
            true,
            { deferRefresh: true }
          );
          count++;
        }
      }
      await refreshAfterBatch();
      if (count > 0) {
        showSnackbar(
          action === 'complete'
            ? `Completed ${count} task${count === 1 ? '' : 's'}`
            : action === 'tomorrow'
              ? `Moved ${count} task${count === 1 ? '' : 's'} to tomorrow`
              : `Deleted ${count} task${count === 1 ? '' : 's'}`
        );
      }
    },
    [tasks, persistEncryptedRecord, refreshAfterBatch, showSnackbar]
  );

  const rescheduleMissedToToday = useCallback(async (): Promise<number> => {
    const todayISO = getTodayISO();
    const overdue = tasks.filter(
      (t) => !t.completed && t.dueDate && t.dueDate < todayISO
    );
    if (overdue.length === 0) return 0;
    const now = Date.now();
    for (const t of overdue) {
      await persistEncryptedRecord(
        'task',
        { ...t, dueDate: todayISO, updatedAt: now },
        false,
        { deferRefresh: true }
      );
    }
    await refreshAfterBatch();
    showSnackbar(
      `Rescheduled ${overdue.length} missed task${overdue.length === 1 ? '' : 's'} to Today`
    );
    return overdue.length;
  }, [tasks, persistEncryptedRecord, refreshAfterBatch, showSnackbar]);

  const deleteTask = useCallback(
    async (id: string) => {
      const target = tasks.find((t) => t.id === id);
      if (!target) return;
      await persistEncryptedRecord(
        'task',
        { ...target, updatedAt: Date.now() },
        true
      );
      showSnackbar(`Deleted "${target.title}"`, 'Undo', async () => {
        const now = Date.now();
        await persistEncryptedRecord(
          'task',
          {
            ...target,
            id: createRecordId('tsk'),
            createdAt: now,
            updatedAt: now,
          },
          false
        );
      });
    },
    [tasks, persistEncryptedRecord, showSnackbar]
  );

  const clearCompletedTasks = useCallback(
    async (listId?: string) => {
      const done = tasks.filter(
        (t) =>
          t.completed &&
          (!listId || (t.listId ?? DEFAULT_TASK_LIST_ID) === listId)
      );
      for (const item of done) {
        await persistEncryptedRecord(
          'task',
          { ...item, updatedAt: Date.now() },
          true,
          { deferRefresh: true }
        );
      }
      if (done.length > 0) {
        await refreshAfterBatch();
        showSnackbar(`Deleted ${done.length} completed tasks`);
      }
    },
    [tasks, persistEncryptedRecord, refreshAfterBatch, showSnackbar]
  );

  // Calendar Events
  const saveCalendarEvent = useCallback(
    async (
      data: Omit<CalendarEventRecord, 'id' | 'createdAt' | 'updatedAt'> & {
        id?: string;
      }
    ) => {
      const now = Date.now();
      const existingItem = data.id
        ? calendarEvents.find((e) => e.id === data.id)
        : undefined;
      const record: CalendarEventRecord = {
        id: data.id || createRecordId('cal'),
        title: data.title.trim(),
        date: data.date,
        allDay: Boolean(data.allDay),
        startTime: data.allDay ? undefined : data.startTime || '09:00',
        endTime: data.allDay ? undefined : data.endTime || '10:00',
        location: data.location?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
        color: data.color || 'blue',
        repeat: data.repeat ?? 'none',
        // undefined = follow the global default lead time in Notification settings
        reminderOffsetMinutes:
          data.reminderOffsetMinutes !== undefined &&
          data.reminderOffsetMinutes >= 0
            ? data.reminderOffsetMinutes
            : undefined,
        isMilestone: Boolean(data.isMilestone),
        createdAt: existingItem?.createdAt ?? now,
        updatedAt: now,
      };
      await persistEncryptedRecord('calendar', record, false);
      showSnackbar(existingItem ? 'Event updated' : 'Event saved');
    },
    [calendarEvents, persistEncryptedRecord, showSnackbar]
  );

  const deleteCalendarEvent = useCallback(
    async (id: string) => {
      const target = calendarEvents.find((e) => e.id === id);
      if (!target) return;
      await persistEncryptedRecord(
        'calendar',
        { ...target, updatedAt: Date.now() },
        true
      );
      showSnackbar(`Deleted "${target.title}"`, 'Undo', async () => {
        const now = Date.now();
        await persistEncryptedRecord(
          'calendar',
          {
            ...target,
            id: createRecordId('cal'),
            createdAt: now,
            updatedAt: now,
          },
          false
        );
      });
    },
    [calendarEvents, persistEncryptedRecord, showSnackbar]
  );

  // Goals
  const saveGoal = useCallback(
    async (
      data: Omit<GoalRecord, 'id' | 'createdAt' | 'updatedAt'> & {
        id?: string;
      }
    ) => {
      const now = Date.now();
      const existingItem = data.id
        ? goals.find((g) => g.id === data.id)
        : undefined;
      const cleanUrl = data.imageUrl?.trim();
      const target =
        typeof data.targetValue === 'number' && data.targetValue > 0
          ? data.targetValue
          : undefined;
      const milestones: GoalMilestone[] | undefined =
        data.milestones && data.milestones.length > 0
          ? data.milestones
              .filter((m) => m.title.trim())
              .slice(0, 50)
              .map((m) => ({
                id: m.id,
                title: m.title.trim().slice(0, 140),
                done: Boolean(m.done),
                targetDate: m.targetDate || undefined,
              }))
          : undefined;
      const record: GoalRecord = {
        ...existingItem,
        id: data.id || createRecordId('gol'),
        title: data.title.trim().slice(0, 140),
        description: data.description?.trim().slice(0, 2000) || undefined,
        category: data.category?.trim().slice(0, 40) || 'Personal',
        color: data.color || 'blue',
        status: data.status ?? 'active',
        progressMode: data.progressMode ?? 'hybrid',
        currentValue:
          target !== undefined ? Math.max(0, Number(data.currentValue) || 0) : undefined,
        targetValue: target,
        unit: target !== undefined ? data.unit?.trim().slice(0, 20) || undefined : undefined,
        targetDate: data.targetDate || undefined,
        milestones: milestones && milestones.length > 0 ? milestones : undefined,
        // Only remote http(s) images: data URLs would exceed the 32 KB
        // per-record Firestore limit.
        imageUrl:
          cleanUrl && /^https?:\/\//i.test(cleanUrl) ? cleanUrl.slice(0, 2000) : undefined,
        imageConfig: data.imageConfig ?? existingItem?.imageConfig,
        createdAt: existingItem?.createdAt ?? now,
        updatedAt: now,
      };
      await persistEncryptedRecord('goal', record, false);
      showSnackbar(existingItem ? 'Goal updated' : 'Goal created');
    },
    [goals, persistEncryptedRecord, showSnackbar]
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      const target = goals.find((g) => g.id === id);
      if (!target) return;
      const now = Date.now();
      // Unlink tasks & habits so they don't point at a deleted goal
      const linkedTasks = tasks.filter((t) => t.goalId === id);
      const linkedHabits = habits.filter((h) => h.goalId === id);
      for (const t of linkedTasks) {
        await persistEncryptedRecord(
          'task',
          { ...t, goalId: undefined, updatedAt: now },
          false,
          { deferRefresh: true }
        );
      }
      for (const h of linkedHabits) {
        await persistEncryptedRecord(
          'habit',
          { ...h, goalId: undefined, updatedAt: now },
          false,
          { deferRefresh: true }
        );
      }
      await persistEncryptedRecord('goal', { ...target, updatedAt: now }, true, {
        deferRefresh: true,
      });
      await refreshAfterBatch();
      showSnackbar(`Deleted "${target.title}"`, 'Undo', async () => {
        const restoredAt = Date.now();
        const newId = createRecordId('gol');
        await persistEncryptedRecord(
          'goal',
          { ...target, id: newId, createdAt: restoredAt, updatedAt: restoredAt },
          false,
          { deferRefresh: true }
        );
        for (const t of linkedTasks) {
          await persistEncryptedRecord(
            'task',
            { ...t, goalId: newId, updatedAt: restoredAt },
            false,
            { deferRefresh: true }
          );
        }
        for (const h of linkedHabits) {
          await persistEncryptedRecord(
            'habit',
            { ...h, goalId: newId, updatedAt: restoredAt },
            false,
            { deferRefresh: true }
          );
        }
        await refreshAfterBatch();
      });
    },
    [goals, tasks, habits, persistEncryptedRecord, refreshAfterBatch, showSnackbar]
  );

  const setGoalStatus = useCallback(
    async (id: string, status: GoalStatus) => {
      const target = goals.find((g) => g.id === id);
      if (!target || target.status === status) return;
      await persistEncryptedRecord(
        'goal',
        { ...target, status, updatedAt: Date.now() },
        false
      );
      showSnackbar(
        status === 'completed'
          ? `🎉 Completed "${target.title}"`
          : status === 'paused'
            ? `Paused "${target.title}"`
            : `Reopened "${target.title}"`,
        'Undo',
        async () => {
          await persistEncryptedRecord(
            'goal',
            { ...target, updatedAt: Date.now() },
            false
          );
        }
      );
    },
    [goals, persistEncryptedRecord, showSnackbar]
  );

  const adjustGoalValue = useCallback(
    async (id: string, delta: number) => {
      const target = goals.find((g) => g.id === id);
      if (!target || !target.targetValue) return;
      const next = Math.max(
        0,
        Math.round(((target.currentValue ?? 0) + delta) * 100) / 100
      );
      await persistEncryptedRecord(
        'goal',
        { ...target, currentValue: next, updatedAt: Date.now() },
        false
      );
      if (
        target.status === 'active' &&
        next >= target.targetValue &&
        (target.currentValue ?? 0) < target.targetValue
      ) {
        showSnackbar(`Target reached for "${target.title}"! Mark it complete?`, 'Complete', async () => {
          await persistEncryptedRecord(
            'goal',
            { ...target, currentValue: next, status: 'completed', updatedAt: Date.now() },
            false
          );
        });
      }
    },
    [goals, persistEncryptedRecord, showSnackbar]
  );

  const toggleGoalMilestone = useCallback(
    async (goalId: string, milestoneId: string) => {
      const target = goals.find((g) => g.id === goalId);
      if (!target?.milestones) return;
      const milestones = target.milestones.map((m) =>
        m.id === milestoneId ? { ...m, done: !m.done } : m
      );
      await persistEncryptedRecord(
        'goal',
        { ...target, milestones, updatedAt: Date.now() },
        false
      );
      const allDone = milestones.every((m) => m.done);
      if (allDone && target.status === 'active') {
        showSnackbar('All milestones done! Mark goal complete?', 'Complete', async () => {
          await persistEncryptedRecord(
            'goal',
            { ...target, milestones, status: 'completed', updatedAt: Date.now() },
            false
          );
        });
      }
    },
    [goals, persistEncryptedRecord, showSnackbar]
  );

  // Track the newest preferences synchronously so back-to-back updates
  // (fast toggles, time pickers) merge instead of overwriting each other.
  const latestPrefsRef = useRef<HubPreferences>(preferences);
  useEffect(() => {
    latestPrefsRef.current = preferences;
  }, [preferences]);

  const updatePreferences = useCallback(
    async (
      patchOrFn:
        | Partial<HubPreferences>
        | ((prev: HubPreferences) => Partial<HubPreferences>)
    ) => {
      const patch =
        typeof patchOrFn === 'function'
          ? patchOrFn(latestPrefsRef.current)
          : patchOrFn;
      const next: HubPreferences = {
        ...latestPrefsRef.current,
        ...patch,
        id: 'prefs_default',
        updatedAt: Date.now(),
      };
      latestPrefsRef.current = next;
      if (patch.accentTheme) {
        setAccentTheme(patch.accentTheme);
      }
      await persistEncryptedRecord('prefs', next, false);
    },
    [persistEncryptedRecord, setAccentTheme]
  );

  const sendTestNotification = useCallback(async (): Promise<boolean> => {
    const perm =
      getNotificationPermission() === 'granted'
        ? 'granted'
        : await requestNotificationPermission();
    if (perm !== 'granted') {
      showSnackbar('Browser notification permission was not granted.');
      return false;
    }
    const ok = await dispatchLocalNotification(
      'MMV-HUB Reminders Active',
      'Encrypted reminders for tasks, habits, events, and renewals are working.',
      'mmv-test-notification'
    );
    showSnackbar(
      ok
        ? 'Test notification sent!'
        : 'Unable to dispatch notification on this browser.'
    );
    return ok;
  }, [showSnackbar]);

  const runReminderSweepNow = useCallback(async (): Promise<number> => {
    const perm =
      getNotificationPermission() === 'granted'
        ? 'granted'
        : await requestNotificationPermission();
    if (perm !== 'granted') {
      showSnackbar('Allow browser notifications to send reminder alerts.');
      return 0;
    }
    const sent = await firePendingReminderNotifications(
      {
        tasks,
        habits,
        subscriptions,
        purchases,
        calendarEvents,
        goals,
        preferences,
      },
      { forceAll: true }
    );
    showSnackbar(
      sent > 0
        ? `Sent ${sent} reminder notification${sent === 1 ? '' : 's'}`
        : 'No due reminders right now.'
    );
    return sent;
  }, [
    tasks,
    habits,
    subscriptions,
    purchases,
    calendarEvents,
    goals,
    preferences,
    showSnackbar,
  ]);

  // Automatic background reminder loop when vault is unlocked & notifications enabled
  useEffect(() => {
    if (
      phase !== 'unlocked' ||
      !preferences.notificationsEnabled ||
      getNotificationPermission() !== 'granted'
    ) {
      return;
    }
    const check = () => {
      void firePendingReminderNotifications({
        tasks,
        habits,
        subscriptions,
        purchases,
        calendarEvents,
        goals,
        preferences,
      });
      void maybeFireEveningSummary({
        tasks,
        habits,
        calendarEvents,
        preferences,
      });
    };
    check();
    const timer = window.setInterval(check, 60_000);
    return () => window.clearInterval(timer);
  }, [
    phase,
    tasks,
    habits,
    subscriptions,
    purchases,
    calendarEvents,
    goals,
    preferences,
  ]);

  const changeVaultPassphrase = useCallback(
    async (newPassphrase: string) => {
      const currentKey = activeKeyRef.current;
      if (!currentKey) throw new Error('Vault must be unlocked');

      const newSalt = generateSaltBase64();
      const newKey = await derivePassphraseKey(newPassphrase, newSalt);
      const { verifierIv, verifierCiphertext } =
        await createKeyVerifier(newKey);

      const allLocal = await getAllLocalRecords();
      const reencrypted: LocalVaultRecord[] = [];
      const now = Date.now();

      for (const rec of allLocal) {
        if (rec.deleted) {
          reencrypted.push(rec);
          continue;
        }
        const payload = await decryptPayload<Record<string, unknown>>(
          currentKey,
          rec.iv,
          rec.ciphertext
        );
        const { iv, ciphertext } = await encryptPayload(newKey, payload);
        reencrypted.push({
          ...rec,
          iv,
          ciphertext,
          version: rec.version + 1,
          clientUpdatedAt: now,
          syncState: 'pending',
        });
      }

      await putLocalRecordsBatch(reencrypted);
      const nextMeta: LocalVaultMeta = {
        id: 'local',
        mode: 'passphrase',
        salt: newSalt,
        verifierIv,
        verifierCiphertext,
        ownerUid: user?.uid,
        lastSyncedAt: vaultMeta?.lastSyncedAt,
      };
      await saveLocalVaultMeta(nextMeta);
      activeKeyRef.current = newKey;
      setVaultMeta(nextMeta);

      if (user && isOnline) {
        const cloudProfile = await fetchCloudVaultProfile(user.uid);
        if (cloudProfile) {
          await rotateCloudVaultProfileKey(
            user.uid,
            newSalt,
            verifierIv,
            verifierCiphertext
          );
        } else {
          await createCloudVaultProfile(
            user.uid,
            user.email || 'user@mmvhub.local',
            user.displayName || 'Personal Vault',
            nextMeta
          );
        }
        await runPushSync();
      }
      await reloadAndDecryptRecords(newKey);
    },
    [
      user,
      isOnline,
      vaultMeta?.lastSyncedAt,
      runPushSync,
      reloadAndDecryptRecords,
    ]
  );

  const exportEncryptedBackup = useCallback(async (): Promise<string> => {
    const meta = await getLocalVaultMeta();
    const records = await getAllLocalRecords();
    return JSON.stringify(
      {
        app: 'MMV-HUB',
        format: 'encrypted-vault-v1',
        exportedAt: new Date().toISOString(),
        meta: meta
          ? {
              mode: meta.mode,
              salt: meta.salt,
              verifierIv: meta.verifierIv,
              verifierCiphertext: meta.verifierCiphertext,
            }
          : null,
        records: records.filter((r) => !r.deleted),
      },
      null,
      2
    );
  }, []);

  const exportPlaintextBackup = useCallback((): string => {
    return JSON.stringify(
      {
        app: 'MMV-HUB',
        format: 'plaintext-backup-v2',
        exportedAt: new Date().toISOString(),
        preferences,
        purchases,
        subscriptions,
        habits,
        taskLists,
        tasks,
        calendarEvents,
        goals,
      },
      null,
      2
    );
  }, [
    preferences,
    purchases,
    subscriptions,
    habits,
    taskLists,
    tasks,
    calendarEvents,
    goals,
  ]);

  const importPlaintextBackup = useCallback(
    async (rawJson: string): Promise<number> => {
      let parsed: {
        format?: string;
        purchases?: unknown[];
        subscriptions?: unknown[];
        habits?: unknown[];
        taskLists?: unknown[];
        tasks?: unknown[];
        calendarEvents?: unknown[];
        goals?: unknown[];
        preferences?: unknown;
      };
      try {
        parsed = JSON.parse(rawJson);
      } catch {
        throw new Error('This file is not valid JSON.');
      }
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Unrecognized backup file.');
      }
      if (parsed.format === 'encrypted-vault-v1') {
        throw new Error(
          'This is an encrypted vault snapshot. Import the "Readable JSON" export instead.'
        );
      }

      const ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;
      const isRecord = (v: unknown, requiredKey: string): v is { id: string } =>
        !!v &&
        typeof v === 'object' &&
        typeof (v as { id?: unknown }).id === 'string' &&
        ID_RE.test((v as { id: string }).id) &&
        requiredKey in (v as object);

      const groups: [VaultRecordKind, unknown[] | undefined, string][] = [
        ['purchase', parsed.purchases, 'title'],
        ['subscription', parsed.subscriptions, 'name'],
        ['habit', parsed.habits, 'name'],
        ['tasklist', parsed.taskLists, 'name'],
        ['task', parsed.tasks, 'title'],
        ['calendar', parsed.calendarEvents, 'title'],
        ['goal', parsed.goals, 'title'],
      ];

      let imported = 0;
      let skipped = 0;
      for (const [kind, items, requiredKey] of groups) {
        if (!Array.isArray(items)) continue;
        for (const item of items) {
          if (!isRecord(item, requiredKey)) {
            skipped++;
            continue;
          }
          // Habits must always have a logs map to render safely
          const payload =
            kind === 'habit'
              ? { logs: {}, targetPerDay: 1, ...(item as object), id: item.id }
              : item;
          await persistEncryptedRecord(kind, payload, false, {
            deferRefresh: true,
          });
          imported++;
        }
      }
      if (parsed.preferences && typeof parsed.preferences === 'object') {
        await persistEncryptedRecord(
          'prefs',
          {
            ...DEFAULT_PREFERENCES,
            ...(parsed.preferences as Partial<HubPreferences>),
            id: 'prefs_default' as const,
            updatedAt: Date.now(),
          },
          false,
          { deferRefresh: true }
        );
      }
      await refreshAfterBatch();
      if (imported === 0 && skipped === 0 && !parsed.preferences) {
        throw new Error('No MMV-HUB records found in this file.');
      }
      if (skipped > 0) {
        showSnackbar(`Skipped ${skipped} invalid record${skipped === 1 ? '' : 's'}`);
      }
      return imported;
    },
    [persistEncryptedRecord, refreshAfterBatch, showSnackbar]
  );

  const wipeLocalVault = useCallback(async () => {
    activeKeyRef.current = null;
    await clearAllLocalVaultData();
    clearNotificationSentLog();
    updateAppBadge(0);
    setPurchases([]);
    setSubscriptions([]);
    setHabits([]);
    setTasks([]);
    setTaskLists([]);
    setCalendarEvents([]);
    setGoals([]);
    setPreferences(DEFAULT_PREFERENCES);
    setVaultMeta(null);
    setPhase('needs-setup');
  }, []);

  const value = useMemo<VaultContextValue>(
    () => ({
      phase,
      vaultMeta,
      user,
      authReady,
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
      preferences,
      snackbar,
      dismissSnackbar,
      setupPassphraseVault,
      setupDeviceKeyVault,
      unlockWithPassphrase,
      lockVault,
      signInWithGoogle,
      signOutGoogle,
      triggerSyncNow: runPushSync,
      changeVaultPassphrase,
      savePurchase,
      duplicatePurchase,
      togglePurchaseReimbursed,
      deletePurchase,
      saveSubscription,
      toggleSubscriptionActive,
      logSubscriptionPayment,
      deleteSubscription,
      saveHabit,
      toggleHabitLog,
      setHabitLogCount,
      toggleHabitFreeze,
      toggleHabitArchived,
      deleteHabit,
      createTaskList,
      renameTaskList,
      deleteTaskList,
      saveTask,
      toggleTaskCompleted,
      toggleTaskStarred,
      toggleTaskSubtask,
      addSubtaskToTask,
      deleteSubtaskFromTask,
      moveTaskToList,
      reorderTaskInList,
      logTaskFocusMinutes,
      batchUpdateTasks,
      rescheduleMissedToToday,
      deleteTask,
      snoozeTaskToTomorrow,
      clearCompletedTasks,
      saveCalendarEvent,
      deleteCalendarEvent,
      saveGoal,
      deleteGoal,
      setGoalStatus,
      adjustGoalValue,
      toggleGoalMilestone,
      updatePreferences,
      sendTestNotification,
      runReminderSweepNow,
      exportEncryptedBackup,
      exportPlaintextBackup,
      importPlaintextBackup,
      wipeLocalVault,
    }),
    [
      phase,
      vaultMeta,
      user,
      authReady,
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
      preferences,
      snackbar,
      dismissSnackbar,
      setupPassphraseVault,
      setupDeviceKeyVault,
      unlockWithPassphrase,
      lockVault,
      signInWithGoogle,
      signOutGoogle,
      runPushSync,
      changeVaultPassphrase,
      savePurchase,
      duplicatePurchase,
      togglePurchaseReimbursed,
      deletePurchase,
      saveSubscription,
      toggleSubscriptionActive,
      logSubscriptionPayment,
      deleteSubscription,
      saveHabit,
      toggleHabitLog,
      setHabitLogCount,
      toggleHabitFreeze,
      toggleHabitArchived,
      deleteHabit,
      createTaskList,
      renameTaskList,
      deleteTaskList,
      saveTask,
      toggleTaskCompleted,
      toggleTaskStarred,
      toggleTaskSubtask,
      addSubtaskToTask,
      deleteSubtaskFromTask,
      moveTaskToList,
      reorderTaskInList,
      logTaskFocusMinutes,
      batchUpdateTasks,
      rescheduleMissedToToday,
      deleteTask,
      snoozeTaskToTomorrow,
      clearCompletedTasks,
      saveCalendarEvent,
      deleteCalendarEvent,
      saveGoal,
      deleteGoal,
      setGoalStatus,
      adjustGoalValue,
      toggleGoalMilestone,
      updatePreferences,
      sendTestNotification,
      runReminderSweepNow,
      exportEncryptedBackup,
      exportPlaintextBackup,
      importPlaintextBackup,
      wipeLocalVault,
    ]
  );

  return (
    <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
  );
};
