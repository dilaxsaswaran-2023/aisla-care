import AsyncStorage from '@react-native-async-storage/async-storage';

import type {UserSession} from '../types/models';

const sessionStorageKey = 'aisla.session';

function isPersistedSession(value: unknown): value is UserSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<UserSession>;

  return (
    typeof candidate.userId === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.displayName === 'string' &&
    typeof candidate.role === 'string' &&
    typeof candidate.accessToken === 'string' &&
    typeof candidate.refreshToken === 'string'
  );
}

export async function loadPersistedSession(): Promise<UserSession | null> {
  try {
    const serializedSession = await AsyncStorage.getItem(sessionStorageKey);

    if (!serializedSession) {
      return null;
    }

    const parsedSession = JSON.parse(serializedSession) as unknown;

    if (!isPersistedSession(parsedSession)) {
      await AsyncStorage.removeItem(sessionStorageKey);
      return null;
    }

    return parsedSession;
  } catch {
    return null;
  }
}

export async function savePersistedSession(
  session: UserSession,
): Promise<void> {
  await AsyncStorage.setItem(sessionStorageKey, JSON.stringify(session));
}

export async function clearPersistedSession(): Promise<void> {
  await AsyncStorage.removeItem(sessionStorageKey);
}
