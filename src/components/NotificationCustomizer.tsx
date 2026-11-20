import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { HubPreferences, NotificationConfig } from '../types';
import {
  DEFAULT_NOTIFICATION_CONFIG,
  resolveNotificationConfig,
} from '../lib/notifications';
import { isNative } from '../lib/native';

interface NotificationCustomizerProps {
  preferences: HubPreferences;
  updatePreferences: (
    patch:
      | Partial<HubPreferences>
      | ((prev: HubPreferences) => Partial<HubPreferences>)
  ) => Promise<void>;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const TASK_LEAD_OPTIONS = [0, 5, 10, 15, 30, 60, 120];
const EVENT_LEAD_OPTIONS = [0, 5, 10, 15, 30, 60, 120, 1440];
const RENEWAL_DAY_OPTIONS = [0, 1, 2, 3, 5, 7, 14];
const RETURN_DAY_OPTIONS = [0, 1, 2, 3, 5, 7];
const HORIZON_OPTIONS = [1, 3, 7, 14, 30];

function leadLabel(min: number): string {
  if (min === 0) return 'At time';
  if (min === 1440) return '1 day before';
  if (min >= 60) return `${min / 60}h before`;
  return `${min}m before`;
}

const selectClass =
  'w-full min-h-[40px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-white dark:bg-[#1E1F20] px-3 text-xs text-[#1F1F1F] dark:text-[#E3E3E3]';

const labelClass =
  'block text-[11px] font-medium text-[#444746] dark:text-[#C4C7C5]';

const Toggle: React.FC<{
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}> = ({ label, hint, checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`w-full min-h-[44px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors ${
      checked
        ? 'hub-bg-soft border-transparent'
        : 'border-[#DADCE0] dark:border-[#444746] text-[#444746] dark:text-[#C4C7C5]'
    }`}
  >
    <span className="min-w-0">
      <span className="block text-xs font-medium">{label}</span>
      {hint && <span className="block text-[11px] opacity-80">{hint}</span>}
    </span>
    <span
      aria-hidden="true"
      className={`relative w-8 h-[18px] rounded-full shrink-0 transition-colors ${
        checked ? 'bg-[var(--hub-accent)]' : 'bg-[#C4C7C5] dark:bg-[#5F6368]'
      }`}
    >
      <span
        className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all ${
          checked ? 'left-[16px]' : 'left-[2px]'
        }`}
      />
    </span>
  </button>
);

export const NotificationCustomizer: React.FC<NotificationCustomizerProps> = ({
  preferences,
  updatePreferences,
}) => {
  const cfg = resolveNotificationConfig(preferences);

  const patch = (next: Partial<NotificationConfig>) =>
    void updatePreferences((prev) => ({
      notificationConfig: { ...prev.notificationConfig, ...next },
    }));

  const toggleWeekday = (day: number) =>
    void updatePreferences((prev) => {
      const set = new Set(resolveNotificationConfig(prev).activeWeekdays);
      if (set.has(day)) set.delete(day);
      else set.add(day);
      return {
        notificationConfig: {
          ...prev.notificationConfig,
          activeWeekdays: [...set].sort((a, b) => a - b),
        },
      };
    });

  return (
    <div className="space-y-4 pt-3 border-t border-[#F0F4F9] dark:border-[#282A2C]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-[#1F1F1F] dark:text-[#E3E3E3] inline-flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 hub-text-accent" />
          Customize Notifications
        </p>
        <button
          type="button"
          onClick={() =>
            void updatePreferences({ notificationConfig: undefined })
          }
          className="min-h-[32px] px-3 rounded-full text-[11px] font-medium text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]"
        >
          Reset defaults
        </button>
      </div>

      {/* Delivery */}
      <div className="space-y-2">
        <span className={labelClass}>Delivery style</span>
        <div
          role="radiogroup"
          aria-label="Delivery style"
          className="grid grid-cols-2 p-1 rounded-full bg-[#F1F3F4] dark:bg-[#282A2C]"
        >
          {(
            [
              { id: 'individual', label: 'Individual alerts' },
              { id: 'digest', label: 'Single digest' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={cfg.deliveryMode === opt.id}
              onClick={() => patch({ deliveryMode: opt.id })}
              className={`min-h-[34px] rounded-full text-xs font-medium transition-colors ${
                cfg.deliveryMode === opt.id
                  ? 'bg-white dark:bg-[#1E1F20] text-[#202124] dark:text-[#E8EAED] shadow-2xs'
                  : 'text-[#5F6368] dark:text-[#9AA0A6]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cfg.deliveryMode === 'individual' && (
            <div className="space-y-1">
              <label htmlFor="notif-max" className={labelClass}>
                Max alerts at once (then summarize)
              </label>
              <select
                id="notif-max"
                value={cfg.maxPerBatch}
                onChange={(e) => patch({ maxPerBatch: Number(e.target.value) })}
                className={selectClass}
              >
                {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!isNative() && (
            <Toggle
              label="Play chime"
              hint="Sound when alerts are delivered"
              checked={cfg.sound}
              onChange={(sound) => patch({ sound })}
            />
          )}
        </div>
      </div>

      {/* Timing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="notif-task-lead" className={labelClass}>
            Timed task alert
          </label>
          <select
            id="notif-task-lead"
            value={cfg.taskLeadMinutes}
            onChange={(e) => patch({ taskLeadMinutes: Number(e.target.value) })}
            className={selectClass}
          >
            {TASK_LEAD_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {leadLabel(m)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="notif-event-lead" className={labelClass}>
            Default event alert
          </label>
          <select
            id="notif-event-lead"
            value={cfg.eventDefaultLeadMinutes}
            onChange={(e) =>
              patch({ eventDefaultLeadMinutes: Number(e.target.value) })
            }
            className={selectClass}
          >
            {EVENT_LEAD_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {leadLabel(m)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="notif-renewal" className={labelClass}>
            Default renewal warning
          </label>
          <select
            id="notif-renewal"
            value={cfg.renewalLeadDays}
            onChange={(e) => patch({ renewalLeadDays: Number(e.target.value) })}
            className={selectClass}
          >
            {RENEWAL_DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d === 0 ? 'On billing day' : `${d} day${d === 1 ? '' : 's'} before`}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="notif-horizon" className={labelClass}>
            Bell “Upcoming” range
          </label>
          <select
            id="notif-horizon"
            value={cfg.bellHorizonDays}
            onChange={(e) => patch({ bellHorizonDays: Number(e.target.value) })}
            className={selectClass}
          >
            {HORIZON_OPTIONS.map((d) => (
              <option key={d} value={d}>
                Next {d} day{d === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Task filters + extras */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Toggle
          label="Overdue task alerts"
          hint="Remind about tasks past their due date"
          checked={cfg.includeOverdueTasks}
          onChange={(includeOverdueTasks) => patch({ includeOverdueTasks })}
        />
        <Toggle
          label="High-priority tasks only"
          hint="Skip low & medium priority tasks"
          checked={cfg.highPriorityTasksOnly}
          onChange={(highPriorityTasksOnly) => patch({ highPriorityTasksOnly })}
        />
        <Toggle
          label="Return-window alerts"
          hint="Purchases nearing their return deadline"
          checked={cfg.notifyReturnWindows}
          onChange={(notifyReturnWindows) => patch({ notifyReturnWindows })}
        />
        {cfg.notifyReturnWindows ? (
          <div className="space-y-1">
            <label htmlFor="notif-return" className={labelClass}>
              Return-window warning
            </label>
            <select
              id="notif-return"
              value={cfg.returnWindowDays}
              onChange={(e) =>
                patch({ returnWindowDays: Number(e.target.value) })
              }
              className={selectClass}
            >
              {RETURN_DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d === 0 ? 'On last day' : `${d} day${d === 1 ? '' : 's'} before`}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="hidden sm:block" />
        )}
        <Toggle
          label="Urgent alerts during quiet hours"
          hint="Overdue & high-priority still come through"
          checked={cfg.urgentBypassQuietHours}
          onChange={(urgentBypassQuietHours) =>
            patch({ urgentBypassQuietHours })
          }
        />
        <Toggle
          label="Badge count"
          hint="Missed count on bell & app icon"
          checked={cfg.showBadge}
          onChange={(showBadge) => patch({ showBadge })}
        />
      </div>

      {/* Active days */}
      <div className="space-y-1.5">
        <span className={labelClass}>Alert days</span>
        <div className="flex items-center gap-1.5" role="group" aria-label="Alert days">
          {WEEKDAYS.map((label, day) => {
            const on = cfg.activeWeekdays.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                aria-label={WEEKDAY_NAMES[day]}
                title={WEEKDAY_NAMES[day]}
                onClick={() => toggleWeekday(day)}
                className={`w-9 h-9 rounded-full text-xs font-semibold transition-colors ${
                  on
                    ? 'hub-bg-accent'
                    : 'border border-[#DADCE0] dark:border-[#444746] text-[#5F6368] dark:text-[#9AA0A6]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {cfg.activeWeekdays.length === 0 && (
          <p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
            No days selected — alerts will be sent every day.
          </p>
        )}
      </div>

      {/* Evening wrap-up */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
        <Toggle
          label="Evening wrap-up"
          hint="Daily summary of what's left + tomorrow"
          checked={cfg.eveningSummaryEnabled}
          onChange={(eveningSummaryEnabled) => patch({ eveningSummaryEnabled })}
        />
        <div className="space-y-1">
          <label htmlFor="notif-evening" className={labelClass}>
            Wrap-up time
          </label>
          <input
            id="notif-evening"
            type="time"
            value={cfg.eveningSummaryTime}
            disabled={!cfg.eveningSummaryEnabled}
            onChange={(e) =>
              e.target.value && patch({ eveningSummaryTime: e.target.value })
            }
            className="w-full min-h-[40px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3 font-mono text-xs text-[#1F1F1F] dark:text-[#E3E3E3] disabled:opacity-45"
          />
        </div>
      </div>

      {isNative() && (
        <div className="space-y-2 pt-3 border-t border-[#F0F4F9] dark:border-[#282A2C]">
          <span className={labelClass}>Phone</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Toggle
              label="Pop on screen"
              checked={cfg.headsUp}
              onChange={(headsUp) => patch({ headsUp })}
            />
            <Toggle
              label="Vibrate"
              checked={cfg.vibrate}
              onChange={(vibrate) => patch({ vibrate })}
            />
            <Toggle
              label="Sound"
              checked={preferences.notificationConfig?.sound ?? true}
              onChange={(sound) => patch({ sound })}
            />
            <Toggle
              label="Action buttons"
              hint="Done · Snooze · Paid"
              checked={cfg.actionButtons}
              onChange={(actionButtons) => patch({ actionButtons })}
            />
            <div className="space-y-1">
              <label htmlFor="notif-snooze" className={labelClass}>
                Snooze length
              </label>
              <select
                id="notif-snooze"
                value={cfg.snoozeMinutes}
                onChange={(e) => patch({ snoozeMinutes: Number(e.target.value) })}
                className={selectClass}
              >
                {[10, 15, 30, 60, 120, 240].map((m) => (
                  <option key={m} value={m}>
                    {m >= 60 ? `${m / 60} h` : `${m} min`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
        {isNative()
          ? 'Reminders are scheduled on your phone and arrive even when the app is closed.'
          : `Alerts fire while MMV-HUB is open. Defaults: ${leadLabel(DEFAULT_NOTIFICATION_CONFIG.taskLeadMinutes)} for tasks, ${leadLabel(DEFAULT_NOTIFICATION_CONFIG.eventDefaultLeadMinutes)} for events.`}
      </p>
    </div>
  );
};
