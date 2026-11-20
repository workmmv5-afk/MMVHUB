import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { HubPreferences, NotificationConfig } from '../types';
import {
  DEFAULT_NOTIFICATION_CONFIG,
  resolveNotificationConfig,
} from '../lib/notifications';
import { isNative } from '../lib/native';
import { Dropdown, MultiDropdown } from './Dropdown';

interface NotificationCustomizerProps {
  preferences: HubPreferences;
  updatePreferences: (
    patch:
      | Partial<HubPreferences>
      | ((prev: HubPreferences) => Partial<HubPreferences>)
  ) => Promise<void>;
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function leadLabel(min: number): string {
  if (min === 0) return 'At time';
  if (min === 1440) return '1 day before';
  if (min >= 60) return `${min / 60}h before`;
  return `${min}m before`;
}
const days = (d: number, zero: string) => (d === 0 ? zero : `${d} day${d === 1 ? '' : 's'} before`);
const opts = <T extends number>(values: T[], label: (v: T) => string) =>
  values.map((value) => ({ value, label: label(value) }));

const labelClass = 'block text-[11px] font-medium text-[#444746] dark:text-[#C4C7C5]';

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
  const native = isNative();

  const patch = (next: Partial<NotificationConfig>) =>
    void updatePreferences((prev) => ({
      notificationConfig: { ...prev.notificationConfig, ...next },
    }));

  return (
    <div className="space-y-4 pt-3 border-t border-[#F0F4F9] dark:border-[#282A2C]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-[#1F1F1F] dark:text-[#E3E3E3] inline-flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 hub-text-accent" />
          Customize Notifications
        </p>
        <button
          type="button"
          onClick={() => void updatePreferences({ notificationConfig: undefined })}
          className="min-h-[32px] px-3 rounded-full text-[11px] font-medium text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]"
        >
          Reset defaults
        </button>
      </div>

      {/* Delivery — 2 options: segmented */}
      <div className="space-y-1.5">
        <span className={labelClass}>Delivery style</span>
        <div role="radiogroup" aria-label="Delivery style" className="grid grid-cols-2 p-1 rounded-full bg-[#F1F3F4] dark:bg-[#282A2C]">
          {(
            [
              { id: 'individual', label: 'Individual alerts' },
              { id: 'digest', label: 'Single digest' },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={cfg.deliveryMode === o.id}
              onClick={() => patch({ deliveryMode: o.id })}
              className={`min-h-[34px] rounded-full text-xs font-medium transition-colors ${
                cfg.deliveryMode === o.id
                  ? 'bg-white dark:bg-[#1E1F20] text-[#202124] dark:text-[#E8EAED] shadow-2xs'
                  : 'text-[#5F6368] dark:text-[#9AA0A6]'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timing — dropdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cfg.deliveryMode === 'individual' && (
          <Dropdown
            label="Max alerts at once"
            value={cfg.maxPerBatch}
            options={opts([1, 2, 3, 4, 5, 6, 8, 10], (n) => `${n} then summarize`)}
            onChange={(maxPerBatch) => patch({ maxPerBatch })}
          />
        )}
        <Dropdown
          label="Timed task alert"
          value={cfg.taskLeadMinutes}
          options={opts([0, 5, 10, 15, 30, 60, 120], leadLabel)}
          onChange={(taskLeadMinutes) => patch({ taskLeadMinutes })}
        />
        <Dropdown
          label="Default event alert"
          value={cfg.eventDefaultLeadMinutes}
          options={opts([0, 5, 10, 15, 30, 60, 120, 1440], leadLabel)}
          onChange={(eventDefaultLeadMinutes) => patch({ eventDefaultLeadMinutes })}
        />
        <Dropdown
          label="Renewal warning"
          value={cfg.renewalLeadDays}
          options={opts([0, 1, 2, 3, 5, 7, 14], (d) => days(d, 'On billing day'))}
          onChange={(renewalLeadDays) => patch({ renewalLeadDays })}
        />
        <Dropdown
          label="Bell “Upcoming” range"
          value={cfg.bellHorizonDays}
          options={opts([1, 3, 7, 14, 30], (d) => `Next ${d} day${d === 1 ? '' : 's'}`)}
          onChange={(bellHorizonDays) => patch({ bellHorizonDays })}
        />
        <MultiDropdown
          label="Alert days"
          values={cfg.activeWeekdays}
          options={WEEKDAY_NAMES.map((label, value) => ({ value, label }))}
          presets={[
            { label: 'Every day', values: [0, 1, 2, 3, 4, 5, 6] },
            { label: 'Weekdays', values: [1, 2, 3, 4, 5] },
            { label: 'Weekends', values: [0, 6] },
          ]}
          emptyLabel="Every day"
          onChange={(v) => patch({ activeWeekdays: [...v].sort((a, b) => a - b) })}
        />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Toggle label="Overdue task alerts" checked={cfg.includeOverdueTasks} onChange={(includeOverdueTasks) => patch({ includeOverdueTasks })} />
        <Toggle label="High-priority tasks only" checked={cfg.highPriorityTasksOnly} onChange={(highPriorityTasksOnly) => patch({ highPriorityTasksOnly })} />
        <Toggle label="Return-window alerts" checked={cfg.notifyReturnWindows} onChange={(notifyReturnWindows) => patch({ notifyReturnWindows })} />
        {cfg.notifyReturnWindows && (
          <Dropdown
            label="Return-window warning"
            value={cfg.returnWindowDays}
            options={opts([0, 1, 2, 3, 5, 7], (d) => days(d, 'On last day'))}
            onChange={(returnWindowDays) => patch({ returnWindowDays })}
          />
        )}
        <Toggle label="Urgent alerts in quiet hours" checked={cfg.urgentBypassQuietHours} onChange={(urgentBypassQuietHours) => patch({ urgentBypassQuietHours })} />
        <Toggle label="Badge count" checked={cfg.showBadge} onChange={(showBadge) => patch({ showBadge })} />
        {!native && <Toggle label="Play chime" checked={cfg.sound} onChange={(sound) => patch({ sound })} />}
      </div>

      {/* Evening wrap-up */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
        <Toggle label="Evening wrap-up" checked={cfg.eveningSummaryEnabled} onChange={(eveningSummaryEnabled) => patch({ eveningSummaryEnabled })} />
        <div className="space-y-1">
          <label htmlFor="notif-evening" className={labelClass}>
            Wrap-up time
          </label>
          <input
            id="notif-evening"
            type="time"
            value={cfg.eveningSummaryTime}
            disabled={!cfg.eveningSummaryEnabled}
            onChange={(e) => e.target.value && patch({ eveningSummaryTime: e.target.value })}
            className="w-full min-h-[40px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-transparent px-3 font-mono text-xs disabled:opacity-45"
          />
        </div>
      </div>

      {native && (
        <div className="space-y-2 pt-3 border-t border-[#F0F4F9] dark:border-[#282A2C]">
          <span className={labelClass}>Phone</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Toggle label="Pop on screen" checked={cfg.headsUp} onChange={(headsUp) => patch({ headsUp })} />
            <Toggle label="Vibrate" checked={cfg.vibrate} onChange={(vibrate) => patch({ vibrate })} />
            <Toggle label="Sound" checked={preferences.notificationConfig?.sound ?? true} onChange={(sound) => patch({ sound })} />
            <Toggle label="Action buttons" hint="Done · Snooze · Paid" checked={cfg.actionButtons} onChange={(actionButtons) => patch({ actionButtons })} />
            <Toggle label="Today summary in shade" checked={cfg.ongoingSummary} onChange={(ongoingSummary) => patch({ ongoingSummary })} />
            <Toggle label="Nag for urgent tasks" hint="Repeat 3× every 10 min" checked={cfg.nagCritical} onChange={(nagCritical) => patch({ nagCritical })} />
            <Dropdown
              label="Snooze length"
              value={cfg.snoozeMinutes}
              options={opts([10, 15, 30, 60, 120, 240], (m) => (m >= 60 ? `${m / 60} h` : `${m} min`))}
              onChange={(snoozeMinutes) => patch({ snoozeMinutes })}
            />
          </div>
        </div>
      )}

      <p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
        {native
          ? 'Scheduled on your phone — arrives even when the app is closed.'
          : `Alerts fire while MMV-HUB is open. Defaults: ${leadLabel(DEFAULT_NOTIFICATION_CONFIG.taskLeadMinutes)} for tasks, ${leadLabel(DEFAULT_NOTIFICATION_CONFIG.eventDefaultLeadMinutes)} for events.`}
      </p>
    </div>
  );
};
