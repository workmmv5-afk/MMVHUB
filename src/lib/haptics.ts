/** Subtle haptic ticks (Android app & supporting browsers). */
let enabled = true;

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

export function haptic(kind: 'tick' | 'success' | 'warning' = 'tick'): void {
  if (!enabled || typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(kind === 'success' ? [12, 40, 18] : kind === 'warning' ? [40, 60, 40] : 8);
  } catch {
    // ignore
  }
}
