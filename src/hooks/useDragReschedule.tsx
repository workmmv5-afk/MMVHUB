import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface DragItem {
  kind: 'event' | 'task';
  id: string;
  label: string;
  fromDate: string;
}

const LONG_PRESS_MS = 350;
const MOUSE_SLOP_PX = 6;

/**
 * Drag a chip onto any element with `data-drop-date="YYYY-MM-DD"`.
 * Mouse: drag after a few pixels. Touch: long-press, then drag (normal
 * swipes still scroll). The click after a drop is swallowed.
 */
export function useDragReschedule(onDrop: (item: DragItem, dateISO: string) => void) {
  const [drag, setDrag] = useState<{ item: DragItem; x: number; y: number; over: string | null } | null>(null);
  const pending = useRef<{ item: DragItem; x: number; y: number; touch: boolean; timer: number } | null>(null);
  const active = useRef(false);
  const swallowClick = useRef(false);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const dropDateAt = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y)?.closest('[data-drop-date]') as HTMLElement | null;
    return el?.dataset.dropDate ?? null;
  };

  const activate = useCallback((x: number, y: number) => {
    const p = pending.current;
    if (!p) return;
    active.current = true;
    navigator.vibrate?.(12);
    setDrag({ item: p.item, x, y, over: dropDateAt(x, y) });
  }, []);

  const reset = useCallback(() => {
    if (pending.current) window.clearTimeout(pending.current.timer);
    pending.current = null;
    active.current = false;
    setDrag(null);
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = pending.current;
      if (!p) return;
      if (!active.current) {
        const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y);
        if (p.touch) {
          if (moved > 10) reset(); // user is scrolling
        } else if (moved > MOUSE_SLOP_PX) {
          activate(e.clientX, e.clientY);
        }
        return;
      }
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, over: dropDateAt(e.clientX, e.clientY) } : d));
    };
    const up = (e: PointerEvent) => {
      const p = pending.current;
      if (p && active.current) {
        const date = dropDateAt(e.clientX, e.clientY);
        swallowClick.current = true;
        window.setTimeout(() => (swallowClick.current = false), 50);
        if (date && date !== p.item.fromDate) onDropRef.current(p.item, date);
      }
      reset();
    };
    // Stop the page from scrolling while a touch drag is active
    const touchMove = (e: TouchEvent) => {
      if (active.current) e.preventDefault();
    };
    const click = (e: MouseEvent) => {
      if (swallowClick.current) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', reset);
    window.addEventListener('touchmove', touchMove, { passive: false });
    window.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', reset);
      window.removeEventListener('touchmove', touchMove);
      window.removeEventListener('click', click, true);
    };
  }, [activate, reset]);

  /** Spread onto a draggable chip. */
  const bind = (item: DragItem) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const touch = e.pointerType !== 'mouse';
      const { clientX: x, clientY: y } = e;
      const timer = touch ? window.setTimeout(() => activate(x, y), LONG_PRESS_MS) : 0;
      pending.current = { item, x, y, touch, timer };
    },
    onContextMenu: (e: React.MouseEvent) => {
      if (active.current) e.preventDefault(); // no long-press menu mid-drag
    },
    'aria-grabbed': drag?.item.id === item.id,
    style: drag?.item.id === item.id ? { opacity: 0.4 } : undefined,
  });

  /** Highlight class for a drop target. */
  const dropClass = (dateISO: string) =>
    drag && drag.over === dateISO && dateISO !== drag.item.fromDate
      ? 'ring-2 ring-[var(--hub-accent)] ring-offset-1'
      : '';

  const ghost = drag ? (
    <div
      className="fixed z-[60] pointer-events-none px-3 py-1.5 rounded-xl hub-bg-accent text-xs font-medium shadow-lg max-w-[200px] truncate"
      style={{ left: drag.x + 12, top: drag.y + 12 }}
    >
      {drag.item.label}
    </div>
  ) : null;

  return { bind, dropClass, ghost, dragging: Boolean(drag) };
}
