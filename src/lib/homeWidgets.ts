import type {
  HomeWidgetConfig,
  HomeWidgetId,
  HomeWidgetSize,
  HubPreferences,
} from '../types';

export interface HomeWidgetMeta {
  id: HomeWidgetId;
  label: string;
  description: string;
  defaultSize: HomeWidgetSize;
  defaultVisible: boolean;
  /** Widgets that only make sense full-width can't be resized. */
  resizable: boolean;
}

export const HOME_WIDGET_CATALOG: HomeWidgetMeta[] = [
  {
    id: 'reminders',
    label: 'Due Reminders',
    description: 'Alert strip shown when reminders are due right now.',
    defaultSize: 'full',
    defaultVisible: true,
    resizable: false,
  },
  {
    id: 'snapshot',
    label: 'Snapshot Stats',
    description: 'Month spend, today’s goals ring, open tasks, 30-day renewals.',
    defaultSize: 'full',
    defaultVisible: true,
    resizable: false,
  },
  {
    id: 'quickActions',
    label: 'Quick Actions',
    description: 'One-tap buttons to add a task, purchase, habit or event.',
    defaultSize: 'full',
    defaultVisible: false,
    resizable: true,
  },
  {
    id: 'focus',
    label: 'Today’s Focus',
    description: 'Tasks & habits for today with quick-add and the focus timer.',
    defaultSize: 'half',
    defaultVisible: true,
    resizable: true,
  },
  {
    id: 'goals',
    label: 'Goals Progress',
    description: 'Your nearest active goals with progress and pace.',
    defaultSize: 'half',
    defaultVisible: true,
    resizable: true,
  },
  {
    id: 'schedule',
    label: '7-Day Schedule',
    description: 'Upcoming events, due tasks and renewals by day.',
    defaultSize: 'half',
    defaultVisible: true,
    resizable: true,
  },
  {
    id: 'streaks',
    label: 'Habit Streaks',
    description: 'Your top running habit streaks.',
    defaultSize: 'half',
    defaultVisible: false,
    resizable: true,
  },
  {
    id: 'countdowns',
    label: 'Countdowns',
    description: 'Days left until events marked as milestones.',
    defaultSize: 'half',
    defaultVisible: false,
    resizable: true,
  },
  {
    id: 'wallet',
    label: 'Recent Wallet Activity',
    description: 'Your latest purchases, refunds and income.',
    defaultSize: 'half',
    defaultVisible: true,
    resizable: true,
  },
  {
    id: 'note',
    label: 'Encrypted Note',
    description: 'Auto-saving private scratchpad.',
    defaultSize: 'half',
    defaultVisible: true,
    resizable: true,
  },
];

const CATALOG_BY_ID = new Map(HOME_WIDGET_CATALOG.map((w) => [w.id, w]));

export function getWidgetMeta(id: HomeWidgetId): HomeWidgetMeta | undefined {
  return CATALOG_BY_ID.get(id);
}

export function getDefaultHomeWidgets(): HomeWidgetConfig[] {
  return HOME_WIDGET_CATALOG.map((w) => ({
    id: w.id,
    visible: w.defaultVisible,
    size: w.defaultSize,
  }));
}

/**
 * Normalize a saved layout: drops unknown ids & duplicates, fixes invalid
 * sizes, and appends widgets added in newer app versions (hidden unless
 * they are visible by default) so older saved layouts keep working.
 */
export function resolveHomeWidgets(
  preferences: Pick<HubPreferences, 'homeWidgets'>
): HomeWidgetConfig[] {
  const saved = preferences.homeWidgets;
  if (!Array.isArray(saved) || saved.length === 0) {
    return getDefaultHomeWidgets();
  }
  const seen = new Set<HomeWidgetId>();
  const result: HomeWidgetConfig[] = [];
  for (const item of saved) {
    const meta = item && CATALOG_BY_ID.get(item.id);
    if (!meta || seen.has(meta.id)) continue;
    seen.add(meta.id);
    result.push({
      id: meta.id,
      visible: Boolean(item.visible),
      size: meta.resizable
        ? item.size === 'full'
          ? 'full'
          : 'half'
        : meta.defaultSize,
    });
  }
  for (const meta of HOME_WIDGET_CATALOG) {
    if (!seen.has(meta.id)) {
      result.push({
        id: meta.id,
        visible: meta.defaultVisible,
        size: meta.defaultSize,
      });
    }
  }
  return result;
}
