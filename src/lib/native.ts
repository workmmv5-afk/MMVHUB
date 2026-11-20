/**
 * Thin bridge to the Android app (Capacitor). Everything here is a no-op on
 * the web; native plugin packages are loaded lazily so the PWA bundle
 * doesn't grow.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

export const isNative = (): boolean => Capacitor.isNativePlatform();

interface MmvWidgetsPlugin {
  setSnapshot(opts: { json: string }): Promise<void>;
  clear(): Promise<void>;
  setSecureScreen(opts: { enabled: boolean }): Promise<void>;
  getSystemAccent(): Promise<{ color?: string }>;
}

export const MmvWidgets = registerPlugin<MmvWidgetsPlugin>('MmvWidgets');

export const loadLocalNotifications = () =>
  import('@capacitor/local-notifications').then((m) => m.LocalNotifications);

export const loadApp = () => import('@capacitor/app').then((m) => m.App);

/** 32-bit positive int id for Android notifications from any string. */
export function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2_000_000_000 || 1;
}
