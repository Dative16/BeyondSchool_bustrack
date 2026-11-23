import { registerRootComponent } from 'expo';

// ORDER MATTERS: this import defines the background GPS task at load time.
// When Android restarts the app in the background, there is no screen — only
// this file runs — so the task must be registered before anything else.
import './src/location/task';

import App from './src/App';

// Tells React Native which component is the app's root (like ReactDOM.createRoot on web).
registerRootComponent(App);
