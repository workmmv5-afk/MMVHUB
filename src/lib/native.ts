/**
 * Thin bridge to the Android app (Capacitor). Everything here is a no-op on
 * the web; native plugin packages are loaded lazily so the PWA bundle
 * doesn't grow.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import firebaseConfig from '../../firebase-applet-config.json';

export const isNative = (): boolean => Capacitor.isNativePlatform();

interface MmvWidgetsPlugin {
  setSnapshot(opts: { json: string }): Promise<void>;
  clear(): Promise<void>;
  setSecureScreen(opts: { enabled: boolean }): Promise<void>;
  getSystemAccent(): Promise<{ color?: string }>;
}

export const MmvWidgets = registerPlugin<MmvWidgetsPlugin>('MmvWidgets');

interface MmvGoogleAuthPlugin {
  signIn(opts: { serverClientId: string }): Promise<{ idToken: string; email?: string; displayName?: string }>;
  signOut(): Promise<void>;
}

export const MmvGoogleAuth = registerPlugin<MmvGoogleAuthPlugin>('MmvGoogleAuth');

/** Native Google account picker → ID token, with friendly errors. */
export async function nativeGoogleIdToken(): Promise<string> {
  const clientId = (firebaseConfig as { oAuthClientId?: string }).oAuthClientId;
  if (!clientId) throw new Error('Google sign-in is not configured for this build.');
  try {
    const { idToken } = await MmvGoogleAuth.signIn({ serverClientId: clientId });
    return idToken;
  } catch (err) {
    const e = err as { code?: string; message?: string };
    const msg = e.message ?? '';
    if (e.code === 'CANCELLED') throw new Error('Sign-in cancelled.');
    if (e.code === 'NO_ACCOUNT' && !/28444|developer console/i.test(msg)) {
      throw new Error('No Google account on this phone. Add one in Android Settings → Accounts.');
    }
    if (/28444|developer console|10:|not set up/i.test(msg) || e.code === 'NO_ACCOUNT') {
      throw new Error(
        'Google sign-in needs one-time setup: add this app (com.mmvhub.mobile + its SHA-1) as an Android OAuth client in Google Cloud. See README → Android App.'
      );
    }
    throw new Error(msg || 'Google sign-in failed.');
  }
}

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
