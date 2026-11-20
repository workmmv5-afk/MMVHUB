import { useEffect, useRef } from 'react';
import { isNative, loadApp, loadLocalNotifications } from '../lib/native';
import { scheduleSnooze } from '../lib/nativeReminders';
import { resolveNotificationConfig } from '../lib/notifications';
import type { HubPreferences } from '../types';

export type NativeIntent =
  | { type: 'link'; url: string }
  | {
      type: 'notification';
      actionId: string; // 'tap' | 'done' | 'snooze' | 'paid'
      kind: string;
      recordId: string;
    };

/**
 * Android-only glue: deep links (widgets), notification actions and the
 * hardware back button. Intents that need data are queued until unlocked.
 */
export function useNativeIntegration(opts: {
  unlocked: boolean;
  preferences: HubPreferences;
  onIntent: (intent: NativeIntent) => void;
  onBack: () => boolean; // return true if handled
}) {
  const queue = useRef<NativeIntent[]>([]);
  const latest = useRef(opts);
  latest.current = opts;

  const dispatch = (intent: NativeIntent) => {
    if (latest.current.unlocked) latest.current.onIntent(intent);
    else queue.current.push(intent);
  };

  useEffect(() => {
    if (!isNative()) return;
    const subs: { remove: () => Promise<void> }[] = [];
    let cancelled = false;

    void (async () => {
      const App = await loadApp();
      const LN = await loadLocalNotifications();
      if (cancelled) return;

      const launch = await App.getLaunchUrl();
      if (launch?.url?.startsWith('mmvhub://')) dispatch({ type: 'link', url: launch.url });

      subs.push(
        await App.addListener('appUrlOpen', ({ url }) => {
          if (url.startsWith('mmvhub://')) dispatch({ type: 'link', url });
        })
      );

      subs.push(
        await App.addListener('backButton', () => {
          if (latest.current.onBack()) return;
          void App.minimizeApp();
        })
      );

      subs.push(
        await LN.addListener('localNotificationActionPerformed', (ev) => {
          const extra = (ev.notification.extra ?? {}) as Record<string, string>;
          const kind = extra.kind ?? '';
          const recordId = extra.recordId ?? '';
          if (ev.actionId === 'snooze') {
            // No vault access needed — just reschedule the same alert
            const mins = resolveNotificationConfig(latest.current.preferences).snoozeMinutes;
            void scheduleSnooze(
              ev.notification.title ?? 'Reminder',
              ev.notification.body ?? '',
              mins,
              { kind, recordId, key: `snooze-${recordId}` }
            );
            return;
          }
          dispatch({ type: 'notification', actionId: ev.actionId, kind, recordId });
        })
      );
    })();

    return () => {
      cancelled = true;
      for (const s of subs) void s.remove();
    };
  }, []);

  // Flush queued intents after unlock
  useEffect(() => {
    if (!opts.unlocked || queue.current.length === 0) return;
    const pending = queue.current.splice(0);
    // Let views mount first
    const t = window.setTimeout(() => pending.forEach((i) => latest.current.onIntent(i)), 300);
    return () => window.clearTimeout(t);
  }, [opts.unlocked]);
}
