import AsyncStorage from '@react-native-async-storage/async-storage';
import {getApps} from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  requestPermission,
  setAutoInitEnabled,
  subscribeToTopic,
  type Messaging,
  type RemoteMessage,
  unsubscribeFromTopic,
} from '@react-native-firebase/messaging';
import {
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';

import {speechService} from './speechService';

const fcmTokenStorageKey = 'aisla.fcmToken';
const pushTopics = ['chat_notifications', 'patient_alerts'] as const;

type NotificationTarget = 'caregiverChat' | 'home';

type InitializePushNotificationsOptions = {
  onNotificationOpen?: (
    target: NotificationTarget,
    remoteMessage: RemoteMessage,
  ) => void;
};

function getMessagingInstance(): Messaging | null {
  try {
    if (getApps().length === 0) {
      return null;
    }

    return getMessaging();
  } catch {
    return null;
  }
}

function isNotificationsAuthorized(status: number): boolean {
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL
  );
}

function parseNotificationTarget(
  remoteMessage: RemoteMessage,
): NotificationTarget | null {
  const rawTarget =
    remoteMessage.data?.screen ??
    remoteMessage.data?.route ??
    remoteMessage.data?.target ??
    remoteMessage.data?.type;

  if (rawTarget === 'caregiverChat' || rawTarget === 'chat') {
    return 'caregiverChat';
  }

  if (rawTarget === 'home') {
    return 'home';
  }

  return null;
}

function getForegroundNotificationTitle(
  remoteMessage: RemoteMessage,
): string {
  return remoteMessage.notification?.title || 'New notification';
}

function getForegroundNotificationBody(
  remoteMessage: RemoteMessage,
): string {
  const dataBody = remoteMessage.data?.body;
  const dataMessage = remoteMessage.data?.message;

  if (remoteMessage.notification?.body) {
    return remoteMessage.notification.body;
  }

  if (typeof dataBody === 'string') {
    return dataBody;
  }

  if (typeof dataMessage === 'string') {
    return dataMessage;
  }

  return 'You have a new update in AISLA Care.';
}

function buildNotificationAnnouncement(remoteMessage: RemoteMessage): string {
  const title = getForegroundNotificationTitle(remoteMessage).trim();
  const body = getForegroundNotificationBody(remoteMessage).trim();

  if (!title) {
    return body;
  }

  if (!body || body.toLowerCase() === title.toLowerCase()) {
    return title;
  }

  return `${title}. ${body}`;
}

function speakNotification(remoteMessage: RemoteMessage): void {
  const announcement = buildNotificationAnnouncement(remoteMessage);

  if (!announcement) {
    return;
  }

  speechService.speak(announcement).catch(() => undefined);
}

async function requestAndroidNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const androidVersion =
    typeof Platform.Version === 'number'
      ? Platform.Version
      : Number(Platform.Version);

  if (Number.isNaN(androidVersion) || androidVersion < 33) {
    return true;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    {
      title: 'Allow notifications',
      message: 'AISLA needs notification access for chat, SOS, and reminder alerts.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );

  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

async function persistFcmToken(token: string): Promise<void> {
  await AsyncStorage.setItem(fcmTokenStorageKey, token);
}

async function handleBackgroundMessage(
  remoteMessage: RemoteMessage,
): Promise<void> {
  if (__DEV__) {
    console.warn('FCM background message received.', remoteMessage);
  }
}

class PushNotificationService {
  private unsubscribeOnMessage: (() => void) | null = null;
  private unsubscribeOnTokenRefresh: (() => void) | null = null;
  private unsubscribeOnNotificationOpened: (() => void) | null = null;
  private isInitialized = false;

  async initialize(
    options: InitializePushNotificationsOptions = {},
  ): Promise<void> {
    this.cleanup();

    const messaging = getMessagingInstance();
    if (!messaging) {
      if (__DEV__) {
        console.warn(
          'FCM initialization skipped. No default Firebase app is configured.',
        );
      }
      return;
    }

    const notificationsAllowed = await requestAndroidNotificationPermission();
    if (!notificationsAllowed) {
      return;
    }

    try {
      await registerDeviceForRemoteMessages(messaging);

      const authorizationStatus = await requestPermission(messaging);
      if (!isNotificationsAuthorized(authorizationStatus)) {
        return;
      }

      await setAutoInitEnabled(messaging, true);

      const token = await messaging.getToken();
      await persistFcmToken(token);
      await Promise.all(pushTopics.map(topic => subscribeToTopic(messaging, topic)));

      if (__DEV__) {
        console.warn('FCM token ready.', token);
        console.warn('FCM topics subscribed.', pushTopics);
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('FCM initialization failed.', error);
      }
      return;
    }

    this.unsubscribeOnTokenRefresh = onTokenRefresh(messaging, token => {
      persistFcmToken(token).catch(() => undefined);

      if (__DEV__) {
        console.warn('FCM token refreshed.', token);
      }
    });

    this.unsubscribeOnMessage = onMessage(messaging, remoteMessage => {
      if (__DEV__) {
        console.warn('FCM foreground message received.', remoteMessage);
      }

      speakNotification(remoteMessage);

      const target = parseNotificationTarget(remoteMessage);
      Alert.alert(
        getForegroundNotificationTitle(remoteMessage),
        getForegroundNotificationBody(remoteMessage),
        [
          ...(target
            ? [
                {
                  text: 'Open',
                  onPress: () => {
                    options.onNotificationOpen?.(target, remoteMessage);
                  },
                },
              ]
            : []),
          {
            text: 'OK',
            style: 'cancel',
          },
        ],
      );
    });

    this.unsubscribeOnNotificationOpened = onNotificationOpenedApp(
      messaging,
      remoteMessage => {
        speakNotification(remoteMessage);

        const target = parseNotificationTarget(remoteMessage);
        if (target) {
          options.onNotificationOpen?.(target, remoteMessage);
        }
      },
    );

    getInitialNotification(messaging)
      .then(remoteMessage => {
        if (!remoteMessage) {
          return;
        }

        speakNotification(remoteMessage);

        const target = parseNotificationTarget(remoteMessage);
        if (target) {
          options.onNotificationOpen?.(target, remoteMessage);
        }
      })
      .catch(() => undefined);

    this.isInitialized = true;
  }

  cleanup(): void {
    const messaging = getMessagingInstance();
    if (messaging) {
      Promise.allSettled(
        pushTopics.map(topic => unsubscribeFromTopic(messaging, topic)),
      ).catch(() => undefined);
    }

    this.unsubscribeOnMessage?.();
    this.unsubscribeOnTokenRefresh?.();
    this.unsubscribeOnNotificationOpened?.();
    this.unsubscribeOnMessage = null;
    this.unsubscribeOnTokenRefresh = null;
    this.unsubscribeOnNotificationOpened = null;
    this.isInitialized = false;
  }

  async getStoredToken(): Promise<string | null> {
    return AsyncStorage.getItem(fcmTokenStorageKey);
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export const pushNotificationService = new PushNotificationService();
export {handleBackgroundMessage};
export type {InitializePushNotificationsOptions, NotificationTarget};
