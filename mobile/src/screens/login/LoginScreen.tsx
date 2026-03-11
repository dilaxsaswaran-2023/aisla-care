import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {apiClient} from '../../api/client';
import {InfoCard} from '../../components/InfoCard';
import {Screen} from '../../components/Screen';
import {colors} from '../../constants/colors';
import {APP_CONFIG} from '../../constants/config';
import {audioService} from '../../services/audioService';
import {locationService} from '../../services/locationService';
import {socketService} from '../../services/socketService';
import type {AppState} from '../../types/models';
import {
  formatCountLabel,
  formatReminderTime,
  formatStatusLabel,
} from '../../utils/format';

const projectAreas = [
  'api',
  'redux',
  'components',
  'screens',
  'navigation',
  'services',
  'utils',
  'constants',
  'types',
] as const;

const previewState: AppState = {
  session: {
    userId: 'elder-001',
    displayName: 'Nimal Perera',
    role: 'elderly',
  },
  reminders: [
    {
      id: 'reminder-1',
      label: 'Morning medication',
      scheduledFor: '2026-03-09T08:30:00.000Z',
      status: 'pending',
    },
    {
      id: 'reminder-2',
      label: 'Doctor appointment',
      scheduledFor: '2026-03-09T14:00:00.000Z',
      status: 'pending',
    },
  ],
  alertStatus: 'resolved',
};

export function LoginScreen(): React.JSX.Element {
  const nextReminder = previewState.reminders[0];
  const lastKnownLocation = locationService.getCachedLocation();

  return (
    <Screen
      title="Login"
      subtitle={`${APP_CONFIG.name} authentication entry screen for elderly users and caregivers.`}>
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Project foundation</Text>
        <Text style={styles.heroTitle}>
          {formatCountLabel(projectAreas.length, 'module')} ready under `src/`
        </Text>
        <Text style={styles.heroBody}>
          The app boots into the login screen, and `src/redux` is available as a
          placeholder for future store configuration.
        </Text>
      </View>

      <InfoCard
        title="Session"
        body={`${
          previewState.session?.displayName ?? 'Unknown user'
        } is signed in as ${previewState.session?.role ?? 'guest'}.`}
      />
      <InfoCard
        title="Next reminder"
        body={
          nextReminder
            ? `${nextReminder.label} at ${formatReminderTime(
                nextReminder.scheduledFor,
              )}.`
            : 'No reminders scheduled.'
        }
      />
      <InfoCard
        title="Alert status"
        body={`Current alert flow is ${formatStatusLabel(
          previewState.alertStatus ?? 'idle',
        )}.`}
      />
      <InfoCard
        title="Service stubs"
        body={`Socket: ${
          socketService.isConnected() ? 'connected' : 'idle'
        }. Audio: ${
          audioService.isRecording() ? 'recording' : 'ready'
        }. Location: ${lastKnownLocation.latitude.toFixed(
          4,
        )}, ${lastKnownLocation.longitude.toFixed(4)}.`}
      />
      <InfoCard
        title="API config"
        body={`REST base URL: ${apiClient.baseUrl}. Realtime URL: ${APP_CONFIG.socketUrl}.`}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    padding: 22,
    borderRadius: 24,
    backgroundColor: colors.primary,
    gap: 10,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: colors.primarySoft,
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    color: colors.surface,
  },
  heroBody: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.primarySoft,
  },
});
