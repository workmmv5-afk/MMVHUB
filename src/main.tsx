import {createRoot} from 'react-dom/client';
import {Capacitor} from '@capacitor/core';
import App from './App.tsx';
import './index.css';

if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('mmv-native');
} else {
  void import('virtual:pwa-register').then(({registerSW}) =>
    registerSW({immediate: true})
  );
}

createRoot(document.getElementById('root')!).render(<App />);
