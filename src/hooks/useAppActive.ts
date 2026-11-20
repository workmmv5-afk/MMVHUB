import { useEffect, useState } from 'react';
import { isNative, loadApp } from '../lib/native';

/**
 * False while the app is in the background, so long-lived work (cloud
 * listeners, tickers) can pause to save battery.
 *  - Android app: immediately on pause (Capacitor appStateChange)
 *  - Web: after the tab has been hidden for a minute
 */
export function useAppActive(): boolean {
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (isNative()) {
      let remove: (() => void) | undefined;
      let cancelled = false;
      void loadApp().then(async (App) => {
        const sub = await App.addListener('appStateChange', ({ isActive }) => setActive(isActive));
        if (cancelled) void sub.remove();
        else remove = () => void sub.remove();
      });
      return () => {
        cancelled = true;
        remove?.();
      };
    }
    let timer = 0;
    const onVis = () => {
      window.clearTimeout(timer);
      if (document.visibilityState === 'hidden') {
        timer = window.setTimeout(() => setActive(false), 60_000);
      } else {
        setActive(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return active;
}
