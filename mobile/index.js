/**
 * @format
 */

import {AppRegistry} from 'react-native';
import {getApps} from '@react-native-firebase/app';
import App from './App';
import {name as appName} from './app.json';
import {getMessaging, setBackgroundMessageHandler} from '@react-native-firebase/messaging';

import {handleBackgroundMessage} from './src/services/pushNotificationService';

if (getApps().length > 0) {
  setBackgroundMessageHandler(getMessaging(), handleBackgroundMessage);
}

AppRegistry.registerComponent(appName, () => App);
