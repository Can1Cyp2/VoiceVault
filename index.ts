import { registerRootComponent } from 'expo';
import { Alert } from 'react-native';

import App from './App';

// Global error handler for production debugging
if (!__DEV__) {
  const originalHandler = ErrorUtils.getGlobalHandler();
  
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error('🚨🚨🚨 GLOBAL ERROR CAUGHT:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      isFatal,
      fullError: JSON.stringify(error, null, 2)
    });
    
    // Show alert with error details in production
    if (isFatal) {
      Alert.alert(
        'App Error (Please Screenshot)',
        `Fatal Error: ${error?.message || 'Unknown'}\n\nName: ${error?.name || 'N/A'}\n\nThis will help debugging.`,
        [{ text: 'OK' }]
      );
    }
    
    // Call original handler
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });
  
  console.log('✅ Global error handler installed for production');
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
