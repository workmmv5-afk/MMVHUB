import React, { useEffect, useRef } from 'react';
import { Keyboard, X } from 'lucide-react';
import type { NavTab } from '../types';

type CreateKind = 'task' | 'purchase' | 'habit' | 'event' | 'goal';

const GO: Record<string, NavTab> = {
  h: 'home',
  p: 'purchases',
  b: 'habits',
  o: 'goals',
  t: 'tasks',
  c: 'calendar',
  s: 'settings',
};
const NEW: Record<string, CreateKind> = { t: 'task', p: 'purchase', h: 'habit', e: 'event', g: 'goal' };

const isTyping = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  if (!t) return false;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
};

/** Desktop shortcuts: g+key go, n+key new, / search, r review, ? help. */
export function useKeyboardShortcuts(opts: {
  enabled: boolean;
  go: (tab: NavTab) => void;
  create: (kind: CreateKind) => void;
  search: () => void;
  review: () => void;
  help: () => void;
}) {
  const latest = useRef(opts);
  latest.current = opts;
  useEffect(() => {
    let prefix: 'g' | 'n' | null = null;
    let timer = 0;
    const onKey = (e: KeyboardEvent) => {
      const o = latest.current;
      if (!o.enabled || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (prefix) {
        const p = prefix;
        prefix = null;
        window.clearTimeout(timer);
        if (p === 'g' && GO[k]) {
          e.preventDefault();
          o.go(GO[k]);
        } else if (p === 'n' && NEW[k]) {
          e.preventDefault();
          o.create(NEW[k]);
        }
        return;
      }
      if (k === 'g' || k === 'n') {
        prefix = k;
        timer = window.setTimeout(() => (prefix = null), 1200);
      } else if (k === '/') {
        e.preventDefault();
        o.search();
      } else if (k === 'r') {
        o.review();
      } else if (e.key === '?') {
        o.help();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

const ROWS: [string, string][] = [
  ['g h · g t · g b', 'Home · Tasks · Habits'],
  ['g p · g o · g c', 'Purchases · Goals · Calendar'],
  ['g s', 'Settings'],
  ['n t · n p · n h', 'New task · purchase · habit'],
  ['n e · n g', 'New event · goal'],
  ['/  or  Ctrl K', 'Search & jump'],
  ['r', 'Review'],
  ['Esc', 'Close'],
];

export const ShortcutsSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1E1F20] p-5 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold inline-flex items-center gap-2">
            <Keyboard className="w-4 h-4 hub-text-accent" />
            Shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[36px] min-w-[36px] rounded-full flex items-center justify-center hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <dl className="space-y-1.5 text-sm">
          {ROWS.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3">
              <dt className="font-mono text-xs px-2 py-0.5 rounded-md bg-[#F1F3F4] dark:bg-[#282A2C]">{k}</dt>
              <dd className="text-xs text-[#444746] dark:text-[#C4C7C5] text-right">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
};
