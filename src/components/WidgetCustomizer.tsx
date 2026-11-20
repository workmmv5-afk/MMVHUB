import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  LayoutGrid,
  RotateCcw,
  X,
} from 'lucide-react';
import type { HomeWidgetConfig } from '../types';
import { getDefaultHomeWidgets, getWidgetMeta } from '../lib/homeWidgets';

interface WidgetCustomizerProps {
  widgets: HomeWidgetConfig[];
  onSave: (next: HomeWidgetConfig[]) => Promise<void> | void;
  onClose: () => void;
}

export const WidgetCustomizer: React.FC<WidgetCustomizerProps> = ({
  widgets,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState<HomeWidgetConfig[]>(widgets);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= draft.length) return;
    setDraft((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const update = (index: number, patch: Partial<HomeWidgetConfig>) => {
    setDraft((prev) =>
      prev.map((w, i) => (i === index ? { ...w, ...patch } : w))
    );
  };

  const visibleCount = draft.filter((w) => w.visible).length;
  const dirty = JSON.stringify(draft) !== JSON.stringify(widgets);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="widget-customizer-title"
        className="w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-[#DADCE0] dark:border-[#3C4043] bg-white dark:bg-[#202124] shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[#E8EAED] dark:border-[#3C4043] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="widget-customizer-title"
              className="text-base font-semibold text-[#202124] dark:text-[#E8EAED] inline-flex items-center gap-2"
            >
              <LayoutGrid className="w-4 h-4 hub-text-accent" />
              Customize Home Widgets
            </h2>
            <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">
              Show, hide, reorder and resize the cards on your Home page.{' '}
              {visibleCount} of {draft.length} shown.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close widget customizer"
            className="min-h-[36px] min-w-[36px] rounded-full flex items-center justify-center text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto divide-y divide-[#F1F3F4] dark:divide-[#282A2C]">
          {draft.map((w, index) => {
            const meta = getWidgetMeta(w.id);
            if (!meta) return null;
            return (
              <li
                key={w.id}
                className={`px-4 sm:px-5 py-3 flex items-center gap-3 ${
                  w.visible ? '' : 'opacity-60'
                }`}
              >
                <div className="flex flex-col shrink-0">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${meta.label} up`}
                    className="min-h-[24px] min-w-[32px] rounded-md flex items-center justify-center text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C] disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === draft.length - 1}
                    aria-label={`Move ${meta.label} down`}
                    className="min-h-[24px] min-w-[32px] rounded-md flex items-center justify-center text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C] disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#202124] dark:text-[#E8EAED] truncate">
                    {meta.label}
                  </p>
                  <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] line-clamp-2">
                    {meta.description}
                  </p>
                </div>

                {meta.resizable && (
                  <div
                    role="group"
                    aria-label={`${meta.label} width`}
                    className="hidden sm:inline-flex items-center p-0.5 rounded-full bg-[#F1F3F4] dark:bg-[#282A2C] shrink-0"
                  >
                    {(['half', 'full'] as const).map((size) => (
                      <button
                        key={size}
                        type="button"
                        disabled={!w.visible}
                        onClick={() => update(index, { size })}
                        aria-pressed={w.size === size}
                        className={`min-h-[28px] px-2.5 rounded-full text-[11px] font-medium transition-colors ${
                          w.size === size
                            ? 'bg-white dark:bg-[#1E1F20] text-[#202124] dark:text-[#E8EAED] shadow-2xs'
                            : 'text-[#5F6368] dark:text-[#9AA0A6]'
                        }`}
                      >
                        {size === 'half' ? 'Half' : 'Full'}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => update(index, { visible: !w.visible })}
                  aria-pressed={w.visible}
                  aria-label={w.visible ? `Hide ${meta.label}` : `Show ${meta.label}`}
                  className={`min-h-[36px] min-w-[36px] rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    w.visible
                      ? 'hub-bg-soft'
                      : 'text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]'
                  }`}
                >
                  {w.visible ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="px-5 py-3.5 border-t border-[#E8EAED] dark:border-[#3C4043] flex items-center justify-between gap-2 pb-safe">
          <button
            type="button"
            onClick={() => setDraft(getDefaultHomeWidgets())}
            className="min-h-[40px] px-3 rounded-full text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C] inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to default
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-4 rounded-full text-xs font-medium text-[#202124] dark:text-[#E8EAED] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!dirty || saving}
              className="min-h-[40px] px-5 rounded-full hub-bg-accent text-xs font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save layout'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
