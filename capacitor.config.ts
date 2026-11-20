import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Same id as the previous APK so it's recognised as MMV-HUB
  appId: 'com.mmvhub.mobile',
  appName: 'MMV-HUB',
  webDir: 'dist',
  android: {
    // https://localhost origin → WebCrypto, IndexedDB & Firestore work as on web
    allowMixedContent: false,
    backgroundColor: '#F8F9FA',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_mmv',
      iconColor: '#1A73E8',
    },
  },
};

export default config;
