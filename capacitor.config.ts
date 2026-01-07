import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.edumanage.app',
  appName: 'EduManage',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Uncomment the following line if you want to use a custom URL in development
    // url: 'http://localhost:8080',
    // cleartext: true
  },
  android: {
    buildOptions: {
      keystorePath: undefined, // Set this to your keystore path when building for production
      keystoreAlias: undefined, // Set this to your keystore alias
    },
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
