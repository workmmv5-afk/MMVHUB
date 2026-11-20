// Minimal browser globals so library code can run under Node's test runner.
const store = new Map<string, string>();
const g = globalThis as unknown as Record<string, unknown>;
g.localStorage ??= {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};
g.document ??= { documentElement: { lang: 'en', classList: { contains: () => false } } };
g.getComputedStyle ??= () => ({ getPropertyValue: () => '#1A73E8' });

/** A local date at hh:mm on the device's "today". */
export function todayAt(h: number, m = 0): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
}
