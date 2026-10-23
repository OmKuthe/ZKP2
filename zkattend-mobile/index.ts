import { registerRootComponent } from 'expo';
import { registerForegroundServiceTask } from './app/services/ForegroundService';

import App from './App';

// Register the notifee foreground service runner BEFORE the React tree mounts.
// Required so that `asForegroundService: true` in displayNotification actually
// creates a real Android foreground service (and keeps the JS runtime alive).
registerForegroundServiceTask();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);