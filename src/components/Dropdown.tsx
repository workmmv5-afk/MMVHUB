import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface DropdownOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
  swatch?: string; // CSS colour shown as a dot
  style?: React.CSSProperties; // e.g. font preview
}

const triggerCls =
  'w-full min-h-[40px] rounded-xl border border-[#747775] dark:border-[#8E918F] bg-white dark:bg-[#1E1F20] px-3 text-sm flex items-center justify-between gap-2 text-left';
const panelCls =
  'absolute z-40 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-[#DADCE0] dark:border-[#3C4043] bg-white dark:bg-[#202124] shadow-lg py-1';

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, close]);
  return ref;
}

const Dot: React.FC<{ color?: string }> = ({ color }) =>
  color ? <span className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0" style={{ background: color }} /> : null;

/** Single-choice dropdown (used whenever a setting has more than 3 options). */
export function Dropdown<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  const id = useId();
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <div className="space-y-1" ref={ref}>
      <span id={`${id}-l`} className="block text-[11px] font-medium text-[#444746] dark:text-[#C4C7C5]">
        {label}
      </span>
      <div className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${id}-l`}
          onClick={() => setOpen((o) => !o)}
          className={triggerCls}
        >
          <span className="flex items-center gap-2 min-w-0">
            <Dot color={current?.swatch} />
            <span className="truncate" style={current?.style}>
              {current?.label}
            </span>
          </span>
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <ul role="listbox" aria-labelledby={`${id}-l`} className={panelCls}>
            {options.map((o) => {
              const sel = o.value === value;
              return (
                <li key={String(o.value)} role="option" aria-selected={sel}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={`w-full min-h-[40px] px-3 flex items-center gap-2 text-left text-sm hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C] ${
                      sel ? 'hub-text-accent font-medium' : ''
                    }`}
                  >
                    <Dot color={o.swatch} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate" style={o.style}>
                        {o.label}
                      </span>
                      {o.hint && <span className="block text-[11px] text-[#5F6368] dark:text-[#9AA0A6] truncate">{o.hint}</span>}
                    </span>
                    {sel && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Multi-choice dropdown with checkboxes and optional quick presets. */
export function MultiDropdown<T extends string | number>({
  label,
  values,
  options,
  onChange,
  presets = [],
  emptyLabel = 'None',
}: {
  label: string;
  values: T[];
  options: DropdownOption<T>[];
  onChange: (v: T[]) => void;
  presets?: { label: string; values: T[] }[];
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  const id = useId();
  const same = (a: T[], b: T[]) => a.length === b.length && a.every((x) => b.includes(x));
  const preset = presets.find((p) => same(p.values, values));
  const summary =
    preset?.label ??
    (values.length === 0
      ? emptyLabel
      : values.length === options.length
        ? 'All'
        : options.filter((o) => values.includes(o.value)).map((o) => o.label).join(', '));
  const toggle = (v: T) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <div className="space-y-1" ref={ref}>
      <span id={`${id}-l`} className="block text-[11px] font-medium text-[#444746] dark:text-[#C4C7C5]">
        {label}
      </span>
      <div className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${id}-l`}
          onClick={() => setOpen((o) => !o)}
          className={triggerCls}
        >
          <span className="truncate">{summary}</span>
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className={panelCls}>
            {presets.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-2.5 py-2 border-b border-[#F1F3F4] dark:border-[#282A2C]">
                {presets.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => onChange(p.values)}
                    className={`min-h-[28px] px-2.5 rounded-full text-[11px] font-medium ${
                      same(p.values, values) ? 'hub-bg-soft' : 'border border-[#DADCE0] dark:border-[#444746]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
            <ul role="listbox" aria-multiselectable="true" aria-labelledby={`${id}-l`}>
              {options.map((o) => {
                const on = values.includes(o.value);
                return (
                  <li key={String(o.value)} role="option" aria-selected={on}>
                    <button
                      type="button"
                      onClick={() => toggle(o.value)}
                      className="w-full min-h-[40px] px-3 flex items-center gap-2.5 text-left text-sm hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]"
                    >
                      <span
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                          on ? 'bg-[var(--hub-accent)] border-[var(--hub-accent)] text-white' : 'border-[#747775]'
                        }`}
                      >
                        {on && <Check className="w-3 h-3" />}
                      </span>
                      {o.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
