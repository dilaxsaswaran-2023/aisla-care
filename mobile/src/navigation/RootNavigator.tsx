import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {apiClient} from '../api/client';
import {colors} from '../constants/colors';
import {CompleteInviteScreen} from '../screens/login/CompleteInviteScreen';
import {LoginScreen} from '../screens/login/LoginScreen';
import {PatientCaregiverChatScreen} from '../screens/patient/PatientCaregiverChatScreen';
import {PatientHomeScreen} from '../screens/patient/PatientHomeScreen';
import {locationService} from '../services/locationService';
import {
  clearPersistedSession,
  loadPersistedSession,
  savePersistedSession,
} from '../services/sessionStorage';
import type {UserSession} from '../types/models';

type PatientRoute = 'home' | 'caregiverChat';
const patientLocationSyncIntervalMs = 60 * 1000;

function AuthLoadingScreen(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.loadingSafeArea}>
      <View style={styles.loadingBody}>
        <ActivityIndicator color={colors.primary} size="small" />
        <Text style={styles.loadingTitle}>Restoring your session</Text>
        <Text style={styles.loadingText}>
          Checking saved login details before opening AISLA Care.
        </Text>
      </View>
    </SafeAreaView>
  );
}

export function RootNavigator(): React.JSX.Element {
  const [session, setSession] = useState<UserSession | null>(null);
  const [patientRoute, setPatientRoute] = useState<PatientRoute>('home');
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [shouldPersistSession, setShouldPersistSession] = useState(false);
  const authRequestIdRef = useRef(0);
  const locationSyncInFlightRef = useRef(false);

  useEffect(() => {
    let isActive = true;

    const restoreSession = async () => {
      const requestId = authRequestIdRef.current + 1;
      authRequestIdRef.current = requestId;

      try {
        const persistedSession = await loadPersistedSession();

        if (!persistedSession) {
          apiClient.clearSession();
          setShouldPersistSession(false);
          return;
        }

        apiClient.hydrateSession(persistedSession);

        const nextSession = await apiClient.getCurrentUser();

        if (!isActive || requestId !== authRequestIdRef.current) {
          return;
        }

        setSession(nextSession);
        setShouldPersistSession(true);
        await savePersistedSession(nextSession);
      } catch {
        apiClient.clearSession();
        await clearPersistedSession();

        if (!isActive || requestId !== authRequestIdRef.current) {
          return;
        }

        setSession(null);
        setShouldPersistSession(false);
      } finally {
        if (isActive && requestId === authRequestIdRef.current) {
          setIsRestoringSession(false);
        }
      }
    };

    restoreSession().catch(() => {
      if (!isActive) {
        return;
      }

      apiClient.clearSession();
      setSession(null);
      setShouldPersistSession(false);
      setIsRestoringSession(false);
    });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!session || session.role !== 'patient') {
      return;
    }

    let isActive = true;

    const syncPatientLocation = async () => {
      if (!isActive || locationSyncInFlightRef.current) {
        return;
      }

      locationSyncInFlightRef.current = true;

      try {
        const location = await locationService.getCurrentLocation();
        await apiClient.sendPatientLocation(location, session.userId);

        if (shouldPersistSession) {
          const currentSession = apiClient.getSession();

          if (currentSession && currentSession.userId === session.userId) {
            await savePersistedSession(currentSession);
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('Patient location sync failed.', error);
        }
      } finally {
        locationSyncInFlightRef.current = false;
      }
    };

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        syncPatientLocation().catch(() => undefined);
      }
    };

    const appStateSubscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    const intervalId = setInterval(() => {
      if (AppState.currentState === 'active') {
        syncPatientLocation().catch(() => undefined);
      }
    }, patientLocationSyncIntervalMs);

    syncPatientLocation().catch(() => undefined);

    return () => {
      isActive = false;
      locationSyncInFlightRef.current = false;
      appStateSubscription.remove();
      clearInterval(intervalId);
    };
  }, [session, shouldPersistSession]);

  if (isRestoringSession) {
    return <AuthLoadingScreen />;
  }

  if (!session) {
    return (
      <LoginScreen
        onLogin={async ({email, password, staySignedIn}) => {
          const requestId = authRequestIdRef.current + 1;
          authRequestIdRef.current = requestId;
          setPatientRoute('home');
          apiClient.clearSession();

          try {
            const nextSession = await apiClient.login(email, password);

            if (nextSession.role !== 'patient') {
              await apiClient.logout().catch(() => {
                apiClient.clearSession();
              });
              throw new Error(
                'This mobile app currently supports patient accounts only.',
              );
            }

            if (staySignedIn) {
              await savePersistedSession(nextSession);
            } else {
              await clearPersistedSession();
            }

            if (requestId !== authRequestIdRef.current) {
              return;
            }

            setShouldPersistSession(staySignedIn);
            setSession(nextSession);
          } catch (error) {
            if (requestId === authRequestIdRef.current) {
              apiClient.clearSession();
              setSession(null);
              setShouldPersistSession(false);
            }

            throw error;
          }
        }}
      />
    );
  }

  if (session.status === 'invited') {
    return (
      <CompleteInviteScreen
        initialFullName={session.displayName}
        initialPhoneCountry={session.phoneCountry}
        initialPhoneNumber={session.phoneNumber}
        onSubmit={async values => {
          const requestId = authRequestIdRef.current + 1;
          authRequestIdRef.current = requestId;

          const completedSession = await apiClient.completeInvite({
            fullName: values.fullName,
            newPassword: values.newPassword,
            phoneCountry: values.phoneCountry,
            phoneNumber: values.phoneNumber,
            address: values.address,
          });

          if (completedSession.role !== 'patient') {
            await apiClient.logout().catch(() => {
              apiClient.clearSession();
            });
            throw new Error(
              'This mobile app currently supports patient accounts only.',
            );
          }

          if (requestId !== authRequestIdRef.current) {
            return;
          }

          if (shouldPersistSession) {
            await savePersistedSession(completedSession);
          }

          setSession(completedSession);
        }}
      />
    );
  }

  return (
    <>
      <PatientHomeScreen
        onSendSos={async payload => {
          await apiClient.sendSosAlert(payload);
        }}
        onOpenCaregiverChat={() => {
          setPatientRoute('caregiverChat');
        }}
        onSignOut={async () => {
          const requestId = authRequestIdRef.current + 1;
          authRequestIdRef.current = requestId;
          setPatientRoute('home');

          try {
            await apiClient.logout();
          } finally {
            await clearPersistedSession();

            if (requestId !== authRequestIdRef.current) {
              return;
            }

            setShouldPersistSession(false);
            setSession(null);
          }
        }}
      />

      <Modal
        animationType="slide"
        onRequestClose={() => {
          setPatientRoute('home');
        }}
        presentationStyle="fullScreen"
        visible={patientRoute === 'caregiverChat'}>
        <PatientCaregiverChatScreen
          onBack={() => {
            setPatientRoute('home');
          }}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loadingSafeArea: {
    flex: 1,
    backgroundColor: '#F8FBFD',
  },
  loadingBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  loadingTitle: {
    fontFamily: 'Poppins-Bold',
    color: '#17375A',
    fontSize: 20,
  },
  loadingText: {
    color: '#6A7E8F',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
});
