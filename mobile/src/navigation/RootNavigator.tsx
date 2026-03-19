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
import {PatientCaregiverDirectoryScreen} from '../screens/patient/PatientCaregiverDirectoryScreen';
import {PatientHomeScreen} from '../screens/patient/PatientHomeScreen';
import {locationService} from '../services/locationService';
import {pushNotificationService} from '../services/pushNotificationService';
import {
  clearPersistedSession,
  loadPersistedSession,
  savePersistedSession,
} from '../services/sessionStorage';
import type {CaregiverContact, UserSession} from '../types/models';

type PatientRoute = 'home' | 'caregiverDirectory' | 'caregiverChat';
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
  const [selectedCaregiver, setSelectedCaregiver] =
    useState<CaregiverContact | null>(null);
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
      pushNotificationService.cleanup();
      return;
    }

    pushNotificationService
      .initialize({
        onNotificationOpen: target => {
          if (target === 'caregiverChat') {
            setPatientRoute('caregiverDirectory');
            return;
          }

          if (target === 'home') {
            setPatientRoute('home');
          }
        },
      })
      .catch(() => undefined);

    return () => {
      pushNotificationService.cleanup();
    };
  }, [session]);

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
      let syncStage: 'capture' | 'upload' = 'capture';
      let capturedLocation: Awaited<
        ReturnType<typeof locationService.getCurrentLocation>
      > | null = null;
      let patientLocationPayload: {
        patient_id: string;
        lat: number;
        lng: number;
        accuracy: number | null;
        captured_at: string;
      } | null = null;

      try {
        capturedLocation = await locationService.getCurrentLocation();
        patientLocationPayload = {
          patient_id: session.userId,
          lat: capturedLocation.latitude,
          lng: capturedLocation.longitude,
          accuracy: capturedLocation.accuracy,
          captured_at: capturedLocation.capturedAt,
        };
        syncStage = 'upload';
        await apiClient.sendPatientLocation(capturedLocation, session.userId);

        if (shouldPersistSession) {
          const currentSession = apiClient.getSession();

          if (currentSession && currentSession.userId === session.userId) {
            await savePersistedSession(currentSession);
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('Patient location sync failed.', {
            stage: syncStage,
            api: apiClient.patientLocationApiUrl,
            payload: patientLocationPayload,
            location: capturedLocation,
            error,
          });
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
          setSelectedCaregiver(null);
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
          const requestBody = {
            message: payload.message,
            voice_transcription: payload.voiceTranscription,
          };

          if (__DEV__) {
            console.log('SOS alert request.', {
              api: apiClient.sosAlertApiUrl,
              method: 'POST',
              payload: requestBody,
            });
          }♦

          try {
            const response = await apiClient.sendSosAlert(payload);

            if (__DEV__) {
              console.log('SOS alert response.', {
                api: apiClient.sosAlertApiUrl,
                method: 'POST',
                payload: requestBody,
                response,
              });
            }
          } catch (error) {
            if (__DEV__) {
              console.warn('SOS alert request failed.', {
                api: apiClient.sosAlertApiUrl,
                method: 'POST',
                payload: requestBody,
                error,
              });
            }

            throw error;
          }
        }}
        onOpenCaregiverChat={() => {
          setPatientRoute('caregiverDirectory');
        }}
        onSignOut={async () => {
          const requestId = authRequestIdRef.current + 1;
          authRequestIdRef.current = requestId;
          setPatientRoute('home');
          setSelectedCaregiver(null);

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
          setPatientRoute(previousRoute =>
            previousRoute === 'caregiverChat' ? 'caregiverDirectory' : 'home',
          );
        }}
        presentationStyle="fullScreen"
        visible={patientRoute !== 'home'}>
        {patientRoute === 'caregiverDirectory' || !selectedCaregiver ? (
          <PatientCaregiverDirectoryScreen
            onBack={() => {
              setPatientRoute('home');
            }}
            onSelectCaregiver={caregiver => {
              setSelectedCaregiver(caregiver);
              setPatientRoute('caregiverChat');
            }}
          />
        ) : (
          <PatientCaregiverChatScreen
            caregiver={selectedCaregiver}
            onBack={() => {
              setPatientRoute('caregiverDirectory');
            }}
          />
        )}
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
