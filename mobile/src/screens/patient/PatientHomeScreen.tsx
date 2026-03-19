import React, {useEffect, useRef, useState} from 'react';
import NetInfo from '@react-native-community/netinfo';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import FeatherIcons from 'react-native-vector-icons/Feather';

import {apiClient, getErrorMessage} from '../../api/client';
import {colors} from '../../constants/colors';
import {audioService} from '../../services/audioService';
import {
  caregiverCallService,
  caregiverPhoneNumber,
} from '../../services/caregiverCallService';
import {speechService} from '../../services/speechService';
import type {
  MedicationSchedule,
  Reminder as AppReminder,
} from '../../types/models';

const appLogo = require('../../assets/aisla-logo.png');
const buddiBotIcon = require('../../assets/animeBuddy.gif');
const themeBlue = '#177BC8';
const themeBlueSoft = '#EAF6FF';
const themeGreenSoft = '#1bcf03';
const themeMedication = '#B7791F';
const themeMedicationSoft = '#FFF4D9';
const themeMedicationCard = '#FFFCF2';
const themeRed = '#D93E32';
const themeRedSoft = '#FFF1EF';
const reminderScheduleBlue = '#5AA6E6';
const reminderScheduleBlueSoft = '#EEF7FF';
const reminderScheduleRose = '#E86D78';
const reminderScheduleRoseSoft = '#FFF1F3';
const reminderScheduleMint = '#20C8BE';
const reminderScheduleMintSoft = '#EAFCF8';
const reminderTimelineMinimumHour = 8;
const reminderTimelineMaximumHour = 16;
const reminderTimelineBaseRowHeight = 96;
const reminderTimelineExtraCardHeight = 72;
const offlineCaregiverMessage = "You are offline. I'm calling your caregiver.";
const sosPrompt = 'Are you okay? What do you need?';
const budiiPrompt = "Hi, I'm Budii. Are you okay? What do you need?";
const reminderAlertLeadMs = 60_000;
const reminderAlertTrailMs = 60_000;
const reminderClockTickMs = 1_000;
const reminderAnnouncementIntervalMs = 30_000;
const sosCountdownDurationSeconds = 10;
const buddiSpeechMinimumLengthMs = 60_000;
const buddiSpeechCompleteSilenceMs = 12_000;
const buddiSpeechPossibleSilenceMs = 8_000;
const buddiVoicePulseThreshold = 2;

type PatientHomeScreenProps = {
  onSignOut: () => Promise<void> | void;
  onOpenCaregiverChat: () => void;
  onSendSos: (payload: {
    message?: string;
    voiceTranscription?: string;
  }) => Promise<void> | void;
};

type SpeechResultsEvent = {
  value?: string[];
};

type SpeechErrorEvent = {
  error?: {
    code?: string | number;
    message?: string;
  };
};

type SpeechVolumeEvent = {
  value?: number;
};

type VoiceModule = {
  start: (locale: string, options?: Record<string, unknown>) => Promise<void>;
  stop: () => Promise<void>;
  cancel: () => Promise<void>;
  destroy: () => Promise<void>;
  isAvailable: () => Promise<0 | 1>;
  removeAllListeners: () => void;
  onSpeechStart?: (event: {error?: boolean}) => void;
  onSpeechEnd?: (event: {error?: boolean}) => void;
  onSpeechError?: (event: SpeechErrorEvent) => void;
  onSpeechResults?: (event: SpeechResultsEvent) => void;
  onSpeechPartialResults?: (event: SpeechResultsEvent) => void;
  onSpeechVolumeChanged?: (event: SpeechVolumeEvent) => void;
};

type DashboardTab = 'home' | 'reminders';
type VoiceSurface = 'sos' | 'buddi';
type ReminderTimelineState = 'scheduled' | 'completed' | 'missed' | 'alerting';
type ReminderFeedItem = AppReminder & {
  kind: 'reminder' | 'medication';
};

let cachedVoiceModule: VoiceModule | null = null;

function getVoiceModule(): VoiceModule | null {
  if (cachedVoiceModule) {
    return cachedVoiceModule;
  }

  try {
    cachedVoiceModule = require('@react-native-voice/voice')
      .default as VoiceModule;
    return cachedVoiceModule;
  } catch {
    return null;
  }
}

function getSpeechErrorMessage(event?: SpeechErrorEvent): string | null {
  const code = String(event?.error?.code ?? '').toLowerCase();
  const message = String(event?.error?.message ?? '').trim();
  const normalizedMessage = message.toLowerCase();
  const isNoMatchError =
    code.includes('no_match') ||
    code.includes('nomatch') ||
    code === '7' ||
    normalizedMessage.includes('no match');

  if (isNoMatchError) {
    return null;
  }

  return message || 'Speech recognition failed. Please try again.';
}

async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone access',
      message: 'AISLA needs microphone access to listen when you speak.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );

  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

function getReminderTimestamp(scheduledFor: string): number | null {
  const scheduledAt = new Date(scheduledFor);

  if (Number.isNaN(scheduledAt.getTime())) {
    return null;
  }

  return scheduledAt.getTime();
}

function formatReminderTime(scheduledFor: string): string {
  const scheduledAt = new Date(scheduledFor);

  if (Number.isNaN(scheduledAt.getTime())) {
    return scheduledFor;
  }

  const today = new Date();
  const isToday =
    scheduledAt.getFullYear() === today.getFullYear() &&
    scheduledAt.getMonth() === today.getMonth() &&
    scheduledAt.getDate() === today.getDate();

  if (isToday) {
    return `Today, ${scheduledAt.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })}`;
  }

  return scheduledAt.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getStartOfDayTimestamp(value: number | Date): number {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function addDaysToTimestamp(dayTimestamp: number, days: number): number {
  const nextDate = new Date(dayTimestamp);
  nextDate.setDate(nextDate.getDate() + days);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate.getTime();
}

function isSameLocalDay(left: number | Date, right: number | Date): boolean {
  return getStartOfDayTimestamp(left) === getStartOfDayTimestamp(right);
}

function formatReminderClockTime(scheduledFor: string): string {
  const scheduledAt = new Date(scheduledFor);

  if (Number.isNaN(scheduledAt.getTime())) {
    return scheduledFor;
  }

  return scheduledAt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatReminderDayHeading(dayTimestamp: number): string {
  return new Date(dayTimestamp).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatReminderDayMeta(
  dayTimestamp: number,
  currentTimestamp: number,
): string {
  const dayDifference = Math.round(
    (getStartOfDayTimestamp(dayTimestamp) - getStartOfDayTimestamp(currentTimestamp)) /
      (24 * 60 * 60 * 1000),
  );

  if (dayDifference === 0) {
    return 'Today';
  }

  if (dayDifference === 1) {
    return 'Tomorrow';
  }

  if (dayDifference === -1) {
    return 'Yesterday';
  }

  return new Date(dayTimestamp).toLocaleDateString('en-US', {
    weekday: 'short',
  });
}

function formatTimelineHour(hour: number): string {
  const normalizedHour = ((hour % 24) + 24) % 24;
  const meridiem = normalizedHour >= 12 ? 'PM' : 'AM';
  const displayHour = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12;
  return `${displayHour} ${meridiem}`;
}

function buildReminderIsoAtLocalTime(
  dayTimestamp: number,
  hours: number,
  minutes: number,
): string {
  const date = new Date(dayTimestamp);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function buildDummyReminderFeed(dayTimestamp: number): ReminderFeedItem[] {
  return [
    {
      id: 'dummy-medication-morning',
      kind: 'medication',
      label: 'Morning Medication',
      scheduledFor: buildReminderIsoAtLocalTime(dayTimestamp, 8, 0),
      status: 'pending',
    },
    {
      id: 'dummy-water-morning',
      kind: 'reminder',
      label: 'Drink Water',
      scheduledFor: buildReminderIsoAtLocalTime(dayTimestamp, 9, 30),
      status: 'completed',
    },
    {
      id: 'dummy-medication-lunch',
      kind: 'medication',
      label: 'Lunch Medication',
      scheduledFor: buildReminderIsoAtLocalTime(dayTimestamp, 13, 0),
      status: 'pending',
    },
    {
      id: 'dummy-water-afternoon',
      kind: 'reminder',
      label: 'Drink Water',
      scheduledFor: buildReminderIsoAtLocalTime(dayTimestamp, 15, 0),
      status: 'pending',
    },
  ];
}

function formatRemainingTime(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0',
  )}`;
}

function formatCountdownSeconds(seconds: number): string {
  return `00:${String(Math.max(0, seconds)).padStart(2, '0')}`;
}

function isReminderAlerting(
  reminder: ReminderFeedItem,
  currentTime: number,
): boolean {
  const scheduledTime = getReminderTimestamp(reminder.scheduledFor);

  if (scheduledTime === null || reminder.status === 'completed') {
    return false;
  }

  return (
    currentTime >= scheduledTime - reminderAlertLeadMs &&
    currentTime <= scheduledTime + reminderAlertTrailMs
  );
}

function getReminderAlertMeta(
  reminder: ReminderFeedItem,
  currentTime: number,
): string | null {
  const scheduledTime = getReminderTimestamp(reminder.scheduledFor);

  if (scheduledTime === null) {
    return null;
  }

  if (currentTime < scheduledTime) {
    return `Due in ${formatRemainingTime(scheduledTime - currentTime)}`;
  }

  const remainingWindowMs = scheduledTime + reminderAlertTrailMs - currentTime;

  if (remainingWindowMs > 0) {
    return `Alarm ends in ${formatRemainingTime(remainingWindowMs)}`;
  }

  return 'Alarm window ending';
}

function buildReminderAnnouncement(
  reminder: ReminderFeedItem,
  currentTime: number,
): string {
  const scheduledTime = getReminderTimestamp(reminder.scheduledFor);
  const title = reminder.label.trim() || 'Care reminder';

  if (scheduledTime === null) {
    return `Reminder. ${title}.`;
  }

  if (currentTime < scheduledTime) {
    return `Reminder. ${title}. This is due in less than one minute.`;
  }

  return `Reminder. ${title}. It is time now.`;
}

function getReminderTimelineState(
  reminder: ReminderFeedItem,
  currentTime: number,
): ReminderTimelineState {
  if (reminder.status === 'completed') {
    return 'completed';
  }

  if (isReminderAlerting(reminder, currentTime)) {
    return 'alerting';
  }

  const scheduledTime = getReminderTimestamp(reminder.scheduledFor);

  if (scheduledTime !== null && scheduledTime < currentTime) {
    return 'missed';
  }

  return 'scheduled';
}

function getReminderTimelineStatusLabel(
  state: ReminderTimelineState,
): string {
  switch (state) {
    case 'completed':
      return 'Completed';
    case 'missed':
      return 'Missed';
    case 'alerting':
      return 'Due now';
    default:
      return 'Scheduled';
  }
}

function getReminderTimelineIconName(reminder: ReminderFeedItem): string {
  const label = reminder.label.toLowerCase();

  if (reminder.kind === 'medication') {
    return 'activity';
  }

  if (label.includes('water') || label.includes('drink')) {
    return 'droplet';
  }

  if (label.includes('food') || label.includes('meal')) {
    return 'coffee';
  }

  return reminder.status === 'completed' ? 'check' : 'bell';
}

function getReminderTimelinePalette(
  reminder: ReminderFeedItem,
  state: ReminderTimelineState,
): {
  accentColor: string;
  borderColor: string;
  cardBackgroundColor: string;
  iconBackgroundColor: string;
  iconColor: string;
  metaColor: string;
  statusColor: string;
  titleColor: string;
} {
  if (state === 'completed') {
    return {
      accentColor: reminderScheduleMint,
      borderColor: '#BDEFE9',
      cardBackgroundColor: reminderScheduleMintSoft,
      iconBackgroundColor: '#D7F7F2',
      iconColor: reminderScheduleMint,
      metaColor: '#5EA9A3',
      statusColor: reminderScheduleMint,
      titleColor: '#31726D',
    };
  }

  if (state === 'missed' || state === 'alerting') {
    return {
      accentColor: reminderScheduleRose,
      borderColor: '#F7CDD2',
      cardBackgroundColor: reminderScheduleRoseSoft,
      iconBackgroundColor: '#FFE0E4',
      iconColor: reminderScheduleRose,
      metaColor: '#C47880',
      statusColor: reminderScheduleRose,
      titleColor: '#C84A57',
    };
  }

  if (reminder.kind === 'medication') {
    return {
      accentColor: reminderScheduleRose,
      borderColor: '#F5D8DC',
      cardBackgroundColor: '#FFF8F9',
      iconBackgroundColor: '#FFECEF',
      iconColor: reminderScheduleRose,
      metaColor: '#C17C84',
      statusColor: reminderScheduleRose,
      titleColor: '#CC5360',
    };
  }

  return {
    accentColor: reminderScheduleBlue,
    borderColor: '#D5E9FA',
    cardBackgroundColor: reminderScheduleBlueSoft,
    iconBackgroundColor: '#DFF0FF',
    iconColor: reminderScheduleBlue,
    metaColor: '#7B9BB9',
    statusColor: '#7DCDBE',
    titleColor: '#3D8BC8',
  };
}

function BrandHeader({
  onSignOut,
}: {
  onSignOut: () => Promise<void> | void;
}): React.JSX.Element {
  const handleSignOutPress = () => {
    Promise.resolve(onSignOut()).catch(() => undefined);
  };

  return (
    <View style={styles.topBar}>
      <View style={styles.brandRow}>
        <Image resizeMode="contain" source={appLogo} style={styles.logoImage} />
        <View>
          <Text style={styles.brandText}>AISLA Care</Text>
          <Text style={styles.brandSubtitle}>Elder dashboard</Text>
        </View>
      </View>

      <Pressable
        accessibilityLabel="Sign out"
        accessibilityRole="button"
        onPress={handleSignOutPress}
        style={({pressed}) => [
          styles.signOutButton,
          pressed ? styles.pressed : null,
        ]}>
        <FeatherIcons color={themeBlue} name="log-out" size={22} />
      </Pressable>
    </View>
  );
}

function ReminderStatCard({
  value,
  label,
  accentColor,
  borderColor,
}: {
  value: number;
  label: string;
  accentColor: string;
  borderColor: string;
}): React.JSX.Element {
  return (
    <View
      style={[
        styles.reminderSummaryCard,
        {borderColor},
      ]}>
      <Text style={[styles.reminderSummaryValue, {color: accentColor}]}>
        {value}
      </Text>
      <Text style={styles.reminderSummaryLabel}>{label}</Text>
    </View>
  );
}

function BottomTabButton({
  active,
  icon,
  onPress,
}: {
  active: boolean;
  icon: 'home' | 'clipboard';
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.bottomTabButton,
        active ? styles.bottomTabButtonActive : null,
        pressed ? styles.pressed : null,
      ]}>
      <FeatherIcons
        color={active ? themeBlue : '#89A2B7'}
        name={icon}
        size={22}
      />
    </Pressable>
  );
}

function MicGlyph({active}: {active: boolean}): React.JSX.Element {
  return (
    <View style={styles.micGlyph}>
      <View
        style={[styles.micGlyphHead, active ? styles.micGlyphHeadActive : null]}
      />
      <View
        style={[styles.micGlyphStem, active ? styles.micGlyphStemActive : null]}
      />
      <View
        style={[styles.micGlyphBase, active ? styles.micGlyphBaseActive : null]}
      />
    </View>
  );
}

export function PatientHomeScreen({
  onSignOut,
  onOpenCaregiverChat,
  onSendSos,
}: PatientHomeScreenProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<DashboardTab>('home');
  const [activeVoiceSurface, setActiveVoiceSurface] =
    useState<VoiceSurface | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isBuddiVoiceDetected, setIsBuddiVoiceDetected] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [sosError, setSosError] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [offlineCaregiverStatus, setOfflineCaregiverStatus] = useState('');
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [selectedReminderDay, setSelectedReminderDay] = useState(() =>
    getStartOfDayTimestamp(Date.now()),
  );
  const [reminders, setReminders] = useState<ReminderFeedItem[]>([]);
  const [isLoadingReminders, setIsLoadingReminders] = useState(true);
  const [remindersError, setRemindersError] = useState('');
  const [silencedReminderId, setSilencedReminderId] = useState<string | null>(
    null,
  );
  const [sosCountdownSeconds, setSosCountdownSeconds] = useState(
    sosCountdownDurationSeconds,
  );
  const [isSubmittingSos, setIsSubmittingSos] = useState(false);
  const [sosSuccessMessage, setSosSuccessMessage] = useState('');
  const sosRequestIdRef = useRef(0);
  const activeVoiceSurfaceRef = useRef<VoiceSurface | null>(null);
  const isListeningRef = useRef(false);
  const buddiRestartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const buddiVoiceActivityTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const reminderFade = useRef(new Animated.Value(0)).current;
  const buddiPulse = useRef(new Animated.Value(0)).current;
  const lastReminderAnnouncementRef = useRef<string | null>(null);
  const reminderAnnouncementInFlightRef = useRef(false);
  const offlineFlowHandledRef = useRef(false);
  const offlineFlowInFlightRef = useRef(false);
  const voiceReady = getVoiceModule() !== null;

  const loadReminders = async () => {
    setIsLoadingReminders(true);
    setRemindersError('');

    try {
      const [remindersResult, medicationSchedulesResult] =
        await Promise.allSettled([
          apiClient.getReminders(),
          apiClient.getMedicationSchedules(),
        ]);
      const nextReminderItems: ReminderFeedItem[] = [];
      const errors: string[] = [];
      const dummyReminderItems = buildDummyReminderFeed(
        getStartOfDayTimestamp(Date.now()),
      );

      if (remindersResult.status === 'fulfilled') {
        console.log('Reminders API response.', {
          api: apiClient.remindersApiUrl,
          response: remindersResult.value,
        });

        const reminderItems = Array.isArray(remindersResult.value.data)
          ? remindersResult.value.data
          : [];

        nextReminderItems.push(
          ...reminderItems.map(reminder => ({
            ...reminder,
            kind: 'reminder' as const,
          })),
        );
      } else {
        console.warn('Reminders API request failed.', {
          api: apiClient.remindersApiUrl,
          error: remindersResult.reason,
        });

        errors.push(getErrorMessage(remindersResult.reason));
      }

      if (medicationSchedulesResult.status === 'fulfilled') {
        console.log('Medication schedules API response.', {
          api: apiClient.medicationSchedulesApiUrl,
          response: medicationSchedulesResult.value,
        });

        const medicationItems = Array.isArray(medicationSchedulesResult.value)
          ? medicationSchedulesResult.value
          : [];

        nextReminderItems.push(
          ...medicationItems
            .filter(schedule => schedule.isActive)
            .map((schedule: MedicationSchedule) => ({
              id: `medication-${schedule.id}`,
              kind: 'medication' as const,
              label: schedule.medicineName,
              scheduledFor: schedule.scheduledFor,
              status: 'pending' as const,
            })),
        );
      } else {
        console.warn('Medication schedules API request failed.', {
          api: apiClient.medicationSchedulesApiUrl,
          error: medicationSchedulesResult.reason,
        });

        errors.push(getErrorMessage(medicationSchedulesResult.reason));
      }

      if (nextReminderItems.length === 0) {
        setReminders(dummyReminderItems);
        setRemindersError('');
        console.warn('Reminder feed empty. Using dummy data.', {
          reminderApi: apiClient.remindersApiUrl,
          medicationApi: apiClient.medicationSchedulesApiUrl,
          fallbackCount: dummyReminderItems.length,
          errors,
        });
      } else {
        setReminders(nextReminderItems);
      }

      if (nextReminderItems.length > 0 && errors.length > 0) {
        console.warn('Reminder feed partially loaded.', {
          reminderApi: apiClient.remindersApiUrl,
          medicationApi: apiClient.medicationSchedulesApiUrl,
          errors,
        });
      }
    } catch (error) {
      const dummyReminderItems = buildDummyReminderFeed(
        getStartOfDayTimestamp(Date.now()),
      );

      setReminders(dummyReminderItems);
      setRemindersError('');
      console.warn('Reminder feed request crashed. Using dummy data.', {
        reminderApi: apiClient.remindersApiUrl,
        medicationApi: apiClient.medicationSchedulesApiUrl,
        error,
        fallbackCount: dummyReminderItems.length,
      });
    } finally {
      setIsLoadingReminders(false);
    }
  };

  const clearBuddiRestartTimeout = () => {
    if (buddiRestartTimeoutRef.current) {
      clearTimeout(buddiRestartTimeoutRef.current);
      buddiRestartTimeoutRef.current = null;
    }
  };

  const clearBuddiVoiceActivityTimeout = () => {
    if (buddiVoiceActivityTimeoutRef.current) {
      clearTimeout(buddiVoiceActivityTimeoutRef.current);
      buddiVoiceActivityTimeoutRef.current = null;
    }
  };

  const stopBuddiVoicePulse = () => {
    clearBuddiVoiceActivityTimeout();
    setIsBuddiVoiceDetected(false);
  };

  const markBuddiVoiceActivity = () => {
    if (activeVoiceSurfaceRef.current === 'sos') {
      return;
    }

    clearBuddiVoiceActivityTimeout();
    setIsBuddiVoiceDetected(true);
    buddiVoiceActivityTimeoutRef.current = setTimeout(() => {
      buddiVoiceActivityTimeoutRef.current = null;
      setIsBuddiVoiceDetected(false);
    }, 700);
  };

  useEffect(() => {
    activeVoiceSurfaceRef.current = activeVoiceSurface;
  }, [activeVoiceSurface]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    const voice = getVoiceModule();
    if (!voice) {
      return;
    }

    voice.onSpeechStart = () => {
      setIsListening(true);
      setSosError('');
      audioService.startRecording();
    };
    voice.onSpeechEnd = () => {
      setIsListening(false);
      audioService.stopRecording();
      stopBuddiVoicePulse();
    };
    voice.onSpeechResults = event => {
      const nextTranscript = event.value?.join(' ').trim() ?? '';
      if (nextTranscript) {
        markBuddiVoiceActivity();
        setTranscript(nextTranscript);
      }
    };
    voice.onSpeechPartialResults = event => {
      const nextPartialTranscript = event.value?.join(' ').trim() ?? '';
      if (nextPartialTranscript) {
        markBuddiVoiceActivity();
      }
      setPartialTranscript(nextPartialTranscript);
    };
    voice.onSpeechVolumeChanged = event => {
      if ((event.value ?? 0) > buddiVoicePulseThreshold) {
        markBuddiVoiceActivity();
      }
    };
    voice.onSpeechError = event => {
      const nextError = getSpeechErrorMessage(event);
      setIsListening(false);
      setSosError(nextError ?? '');
      audioService.stopRecording();
      stopBuddiVoicePulse();
    };

    return () => {
      clearBuddiRestartTimeout();
      clearBuddiVoiceActivityTimeout();
      audioService.stopRecording();
      speechService.stop().catch(() => undefined);
      voice
        .destroy()
        .catch(() => undefined)
        .finally(() => {
          voice.removeAllListeners();
        });
    };
  }, []);

  useEffect(() => {
    loadReminders().catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, reminderClockTickMs);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const nextOffline =
        state.isConnected === false || state.isInternetReachable === false;

      setIsOffline(nextOffline);

      if (!nextOffline) {
        offlineFlowHandledRef.current = false;
        setOfflineCaregiverStatus('');
        return;
      }

      if (offlineFlowHandledRef.current) {
        return;
      }

      offlineFlowHandledRef.current = true;
      triggerOfflineCareFlow().catch(error => {
        console.warn('Offline caregiver flow failed.', {error});
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    return () => {
      Vibration.cancel();
      audioService.releaseAlarm().catch(() => undefined);
      clearBuddiRestartTimeout();
      clearBuddiVoiceActivityTimeout();
    };
  }, []);

  useEffect(() => {
    const shouldPulse = isBuddiVoiceDetected;
    if (!shouldPulse) {
      buddiPulse.stopAnimation();
      buddiPulse.setValue(0);
      return;
    }

    buddiPulse.setValue(0);
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(buddiPulse, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(buddiPulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();

    return () => {
      pulseLoop.stop();
      buddiPulse.stopAnimation();
      buddiPulse.setValue(0);
    };
  }, [buddiPulse, isBuddiVoiceDetected]);

  useEffect(() => {
    if (activeVoiceSurface !== 'sos') {
      setSosCountdownSeconds(sosCountdownDurationSeconds);
      return;
    }

    setSosCountdownSeconds(sosCountdownDurationSeconds);
    const timer = setInterval(() => {
      setSosCountdownSeconds(previousSeconds =>
        previousSeconds > 0 ? previousSeconds - 1 : 0,
      );
    }, 1_000);

    return () => {
      clearInterval(timer);
    };
  }, [activeVoiceSurface]);

  const prepareVoiceSurface = (surface: VoiceSurface) => {
    clearBuddiRestartTimeout();
    if (surface === 'sos') {
      stopBuddiVoicePulse();
    }
    activeVoiceSurfaceRef.current = surface;
    setActiveVoiceSurface(surface);
    setTranscript('');
    setPartialTranscript('');
    setSosError('');
  };

  const beginListening = async () => {
    clearBuddiRestartTimeout();
    const voice = getVoiceModule();

    await speechService.stop();

    if (!voice) {
      setSosError(
        'Speech recognition is not available yet. Rebuild the app after installing native dependencies.',
      );
      return;
    }

    const permissionGranted = await requestMicrophonePermission();

    if (!permissionGranted) {
      setSosError('Microphone permission is required to record your message.');
      return;
    }

    try {
      const available = await voice.isAvailable();
      if (!available) {
        setSosError('Speech recognition is not available on this device.');
        return;
      }

      const listeningOptions =
        activeVoiceSurfaceRef.current === 'sos'
          ? {
              EXTRA_PARTIAL_RESULTS: true,
              REQUEST_PERMISSIONS_AUTO: false,
            }
          : {
              EXTRA_LANGUAGE_MODEL: 'LANGUAGE_MODEL_FREE_FORM',
              EXTRA_PARTIAL_RESULTS: true,
              EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS:
                buddiSpeechMinimumLengthMs,
              EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS:
                buddiSpeechCompleteSilenceMs,
              EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS:
                buddiSpeechPossibleSilenceMs,
              REQUEST_PERMISSIONS_AUTO: false,
            };

      setIsListening(true);
      audioService.startRecording();
      await voice.start('en-US', listeningOptions);
    } catch (error) {
      setIsListening(false);
      audioService.stopRecording();
      setSosError(
        error instanceof Error
          ? error.message
          : 'Unable to start speech recognition.',
      );
    }
  };

  const startVoiceFlow = async (surface: VoiceSurface) => {
    const requestId = sosRequestIdRef.current + 1;
    sosRequestIdRef.current = requestId;

    prepareVoiceSurface(surface);

    if (surface === 'sos' && isListeningRef.current) {
      await stopListening();
    }

    try {
      await speechService.speak(surface === 'sos' ? sosPrompt : budiiPrompt);
    } catch {
      // Fall through to voice capture even if TTS is unavailable.
    }

    if (requestId !== sosRequestIdRef.current) {
      return;
    }

    await beginListening();
  };

  const stopListening = async () => {
    clearBuddiRestartTimeout();
    const voice = getVoiceModule();
    if (!voice) {
      setIsListening(false);
      audioService.stopRecording();
      return;
    }

    try {
      await voice.stop();
    } catch (error) {
      setSosError(
        error instanceof Error
          ? error.message
          : 'Unable to stop speech recognition.',
      );
    } finally {
      setIsListening(false);
      audioService.stopRecording();
    }
  };

  const closeVoiceSurface = async () => {
    const voice = getVoiceModule();
    sosRequestIdRef.current += 1;
    clearBuddiRestartTimeout();
    activeVoiceSurfaceRef.current = null;

    await speechService.stop();

    if (voice) {
      try {
        await voice.cancel();
      } catch {
        // Ignore cancel errors if recognition is already stopped.
      }
    }

    setIsListening(false);
    stopBuddiVoicePulse();
    setPartialTranscript('');
    audioService.stopRecording();
    setIsSubmittingSos(false);
    setSosSuccessMessage('');
    setActiveVoiceSurface(null);
  };

  const triggerOfflineCareFlow = async () => {
    if (offlineFlowInFlightRef.current) {
      return;
    }

    offlineFlowInFlightRef.current = true;
    prepareVoiceSurface('buddi');
    setOfflineCaregiverStatus('Calling Annie now...');
    stopBuddiVoicePulse();

    try {
      if (isListeningRef.current) {
        await stopListening();
      } else {
        await speechService.stop();
        audioService.stopRecording();
      }

      setTranscript('');
      setPartialTranscript('');
      setSosError('');

      try {
        await speechService.speak(offlineCaregiverMessage);
      } catch {
        // Fall back to direct call even if TTS is unavailable.
      }

      await caregiverCallService.callCaregiver();
    } finally {
      offlineFlowInFlightRef.current = false;
    }
  };

  const displayedTranscript = partialTranscript || transcript;
  const buddiListeningActive = activeVoiceSurface !== 'sos' && isListening;
  const buddiPulseActive = isBuddiVoiceDetected;
  const buddiPulseScale = buddiPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.45],
  });
  const buddiPulseOpacity = buddiPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0],
  });
  const sosSuggestions = [
    'I need help right now.',
    'Please alert my caregiver.',
    'I feel dizzy and need assistance.',
  ] as const;

  const applySuggestion = (suggestion: string) => {
    setTranscript(suggestion);
    setPartialTranscript('');
    setSosError('');
  };

  const sortedReminders = [...reminders].sort((left, right) => {
    const leftCompleted = left.status === 'completed';
    const rightCompleted = right.status === 'completed';

    if (leftCompleted !== rightCompleted) {
      return leftCompleted ? 1 : -1;
    }

    const leftTime =
      getReminderTimestamp(left.scheduledFor) ?? Number.MAX_SAFE_INTEGER;
    const rightTime =
      getReminderTimestamp(right.scheduledFor) ?? Number.MAX_SAFE_INTEGER;

    return leftTime - rightTime;
  });
  const activeAlertReminder =
    sortedReminders.find(
      reminder =>
        isReminderAlerting(reminder, currentTime) &&
        reminder.id !== silencedReminderId,
    ) ?? null;
  const upcomingReminder =
    sortedReminders.find(reminder => {
      if (reminder.status === 'completed') {
        return false;
      }

      const scheduledTime = getReminderTimestamp(reminder.scheduledFor);

      return scheduledTime !== null && scheduledTime >= currentTime;
    }) ?? sortedReminders.find(reminder => reminder.status !== 'completed');
  const highlightedReminder = activeAlertReminder ?? upcomingReminder;

  useEffect(() => {
    const silencedReminderStillAlerting = silencedReminderId
      ? sortedReminders.some(
          reminder =>
            reminder.id === silencedReminderId &&
            isReminderAlerting(reminder, currentTime),
        )
      : false;

    if (silencedReminderId && !silencedReminderStillAlerting) {
      setSilencedReminderId(null);
    }
  }, [currentTime, silencedReminderId, sortedReminders]);

  const silenceReminderAlert = (reminderId: string) => {
    setSilencedReminderId(reminderId);
    lastReminderAnnouncementRef.current = null;
    reminderAnnouncementInFlightRef.current = false;
    reminderFade.stopAnimation();
    reminderFade.setValue(0);
    Vibration.cancel();
    speechService.stop().catch(() => undefined);
    audioService.stopAlarm().catch(() => undefined);
  };
  const isSelectedReminderToday = isSameLocalDay(
    selectedReminderDay,
    currentTime,
  );
  const remindersForSelectedDay = sortedReminders.filter(reminder => {
    const scheduledTime = getReminderTimestamp(reminder.scheduledFor);
    return (
      scheduledTime !== null && isSameLocalDay(scheduledTime, selectedReminderDay)
    );
  });
  const completedReminderCount = remindersForSelectedDay.filter(
    reminder => getReminderTimelineState(reminder, currentTime) === 'completed',
  ).length;
  const missedReminderCount = remindersForSelectedDay.filter(
    reminder => getReminderTimelineState(reminder, currentTime) === 'missed',
  ).length;
  const reminderHoursInView = remindersForSelectedDay
    .map(reminder => {
      const scheduledAt = new Date(reminder.scheduledFor);
      return Number.isNaN(scheduledAt.getTime()) ? null : scheduledAt.getHours();
    })
    .filter((hour): hour is number => hour !== null);
  const selectedDayCurrentHour = new Date(currentTime).getHours();
  const reminderTimelineStartHour =
    reminderHoursInView.length > 0
      ? Math.min(
          reminderTimelineMinimumHour,
          ...reminderHoursInView,
          isSelectedReminderToday
            ? selectedDayCurrentHour
            : reminderTimelineMinimumHour,
        )
      : reminderTimelineMinimumHour;
  const reminderTimelineEndHour =
    reminderHoursInView.length > 0
      ? Math.max(
          reminderTimelineMaximumHour,
          ...reminderHoursInView,
          isSelectedReminderToday
            ? selectedDayCurrentHour + 1
            : reminderTimelineMaximumHour,
        )
      : reminderTimelineMaximumHour;
  const reminderTimelineRows = Array.from(
    {length: reminderTimelineEndHour - reminderTimelineStartHour + 1},
    (_, index) => {
      const hour = reminderTimelineStartHour + index;
      const items = remindersForSelectedDay.filter(reminder => {
        const scheduledAt = new Date(reminder.scheduledFor);
        return (
          !Number.isNaN(scheduledAt.getTime()) && scheduledAt.getHours() === hour
        );
      });

      return {
        hour,
        items,
        height:
          reminderTimelineBaseRowHeight +
          Math.max(0, items.length - 1) * reminderTimelineExtraCardHeight,
      };
    },
  );
  let reminderCurrentTimeLineTop: number | null = null;

  if (isSelectedReminderToday) {
    const now = new Date(currentTime);
    const nowHour = now.getHours();

    if (
      nowHour >= reminderTimelineStartHour &&
      nowHour <= reminderTimelineEndHour
    ) {
      let accumulatedHeight = 0;

      for (const row of reminderTimelineRows) {
        if (row.hour === nowHour) {
          const hourProgress =
            (now.getMinutes() * 60 + now.getSeconds()) / (60 * 60);
          reminderCurrentTimeLineTop =
            accumulatedHeight + hourProgress * row.height;
          break;
        }

        accumulatedHeight += row.height;
      }
    }
  }

  useEffect(() => {
    if (!activeAlertReminder) {
      reminderFade.stopAnimation();
      reminderFade.setValue(0);
      return;
    }

    reminderFade.setValue(0);
    const fadeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(reminderFade, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.timing(reminderFade, {
          toValue: 0,
          duration: 380,
          useNativeDriver: true,
        }),
      ]),
    );

    fadeLoop.start();

    return () => {
      fadeLoop.stop();
      reminderFade.stopAnimation();
      reminderFade.setValue(0);
    };
  }, [activeAlertReminder, reminderFade]);

  useEffect(() => {
    if (!activeAlertReminder) {
      lastReminderAnnouncementRef.current = null;
      reminderAnnouncementInFlightRef.current = false;
      Vibration.cancel();
      audioService.stopAlarm().catch(() => undefined);
      return;
    }

    Vibration.cancel();
    Vibration.vibrate([0, 700, 400], true);
    audioService.startAlarm().catch(() => undefined);

    return () => {
      Vibration.cancel();
      audioService.stopAlarm().catch(() => undefined);
    };
  }, [activeAlertReminder]);

  useEffect(() => {
    if (!activeAlertReminder) {
      lastReminderAnnouncementRef.current = null;
      reminderAnnouncementInFlightRef.current = false;
      return;
    }

    if (activeVoiceSurface || isListening) {
      return;
    }

    const scheduledTime = getReminderTimestamp(
      activeAlertReminder.scheduledFor,
    );
    if (scheduledTime === null) {
      return;
    }

    const announcementSlot = Math.floor(
      Math.max(0, currentTime - (scheduledTime - reminderAlertLeadMs)) /
        reminderAnnouncementIntervalMs,
    );
    const announcementKey = `${activeAlertReminder.id}:${announcementSlot}`;

    if (
      lastReminderAnnouncementRef.current === announcementKey ||
      reminderAnnouncementInFlightRef.current
    ) {
      return;
    }

    lastReminderAnnouncementRef.current = announcementKey;
    reminderAnnouncementInFlightRef.current = true;
    speechService
      .speak(buildReminderAnnouncement(activeAlertReminder, currentTime))
      .catch(() => undefined)
      .finally(() => {
        reminderAnnouncementInFlightRef.current = false;
      });
  }, [activeAlertReminder, activeVoiceSurface, currentTime, isListening]);

  const fixedReminderLabel = activeAlertReminder
    ? 'Reminder alarm active'
    : isLoadingReminders
    ? 'Loading reminders'
    : remindersError
    ? 'Reminders unavailable'
    : 'Upcoming reminder';
  const fixedReminderMeta = highlightedReminder
    ? activeAlertReminder
      ? getReminderAlertMeta(highlightedReminder, currentTime) ??
        formatReminderTime(highlightedReminder.scheduledFor)
      : formatReminderTime(highlightedReminder.scheduledFor)
    : isLoadingReminders
    ? 'Fetching your reminder list'
    : remindersError
    ? remindersError
    : 'Check back later';
  const handleFixedReminderPress = () => {
    if (activeAlertReminder) {
      silenceReminderAlert(activeAlertReminder.id);
      return;
    }

    if (remindersError) {
      loadReminders().catch(() => undefined);
    }

    setActiveTab('reminders');
  };

  const openSosPrompt = () => {
    startVoiceFlow('sos').catch(() => undefined);
  };
  const handleCaregiverCall = async () => {
    await caregiverCallService.callCaregiver();
  };
  const openBudiiModal = () => {
    if (isOffline) {
      setOfflineCaregiverStatus('Calling Annie now...');
      prepareVoiceSurface('buddi');
      return;
    }

    setOfflineCaregiverStatus('');
    prepareVoiceSurface('buddi');
    if (!isListeningRef.current) {
      beginListening().catch(() => undefined);
    }
  };
  const closeVoiceSurfaceSafely = () => {
    closeVoiceSurface().catch(() => undefined);
  };
  const handleMicPress = () => {
    if (activeVoiceSurface === 'buddi') {
      if (!isListening) {
        beginListening().catch(() => undefined);
      }
      return;
    }

    if (isListening) {
      stopListening().catch(() => undefined);
      return;
    }

    beginListening().catch(() => undefined);
  };

  const submitSosAlert = async () => {
    if (isSubmittingSos) {
      return;
    }

    const message = displayedTranscript.trim();

    setIsSubmittingSos(true);
    setSosError('');
    setSosSuccessMessage('');

    try {
      await onSendSos({
        message: message || 'Patient triggered SOS button',
        voiceTranscription: message || undefined,
      });
      setSosSuccessMessage('SOS alert sent to your care team.');
      setTimeout(() => {
        closeVoiceSurface().catch(() => undefined);
      }, 1200);
    } catch (error) {
      setSosError(
        error instanceof Error
          ? error.message
          : 'Unable to send SOS alert right now.',
      );
    } finally {
      setIsSubmittingSos(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {activeTab === 'home' ? <BrandHeader onSignOut={onSignOut} /> : null}

      <View style={styles.screenBody}>
        <View
          pointerEvents="box-none"
          style={[
            styles.fixedSosContainer,
            activeTab === 'reminders'
              ? styles.fixedReminderScheduleContainer
              : null,
          ]}>
          {activeTab === 'home' ? (
            <>
              <Pressable
                accessibilityLabel={
                  activeAlertReminder
                    ? 'Silence reminder alarm'
                    : 'Open reminders'
                }
                accessibilityRole="button"
                onPress={handleFixedReminderPress}
                style={({pressed}) => [
                  styles.fixedReminderButton,
                  activeAlertReminder
                    ? styles.fixedReminderButtonAlerting
                    : null,
                  pressed ? styles.pressed : null,
                ]}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.fixedReminderButtonFadeOverlay,
                    activeAlertReminder
                      ? styles.fixedReminderButtonFadeOverlayAlerting
                      : null,
                    {opacity: reminderFade},
                  ]}
                />
                <View
                  style={[
                    styles.fixedReminderButtonIcon,
                    activeAlertReminder
                      ? styles.fixedReminderButtonIconAlerting
                      : null,
                  ]}>
                  <FeatherIcons
                    color={activeAlertReminder ? themeRed : themeBlue}
                    name="bell"
                    size={18}
                  />
                </View>
                <View style={styles.fixedReminderButtonCopy}>
                  <Text
                    style={[
                      styles.fixedReminderButtonLabel,
                      activeAlertReminder
                        ? styles.fixedReminderButtonLabelAlerting
                        : null,
                    ]}>
                    {fixedReminderLabel}
                  </Text>
                  <Text numberOfLines={2} style={styles.fixedReminderButtonTitle}>
                    {highlightedReminder?.label ?? 'No upcoming reminders'}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.fixedReminderButtonMeta,
                      activeAlertReminder
                        ? styles.fixedReminderButtonMetaAlerting
                        : null,
                    ]}>
                    {fixedReminderMeta}
                  </Text>
                </View>
                <FeatherIcons color="#7A95AA" name="chevron-right" size={18} />
              </Pressable>

              <Pressable
                accessibilityLabel="Open SOS voice prompt"
                accessibilityRole="button"
                onPress={openSosPrompt}
                style={({pressed}) => [
                  styles.topSosButton,
                  pressed ? styles.pressed : null,
                ]}>
                <Text style={styles.topSosButtonText}>SOS</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.reminderScheduleHeader}>
              <View style={styles.reminderScheduleDateRow}>
                <Pressable
                  accessibilityLabel="Show previous day reminders"
                  accessibilityRole="button"
                  onPress={() => {
                    setSelectedReminderDay(previousDay =>
                      addDaysToTimestamp(previousDay, -1),
                    );
                  }}
                  style={({pressed}) => [
                    styles.reminderScheduleNavButton,
                    pressed ? styles.pressed : null,
                  ]}>
                  <FeatherIcons color="#17375A" name="chevron-left" size={24} />
                </Pressable>

                <View style={styles.reminderScheduleDateCopy}>
                  <Text style={styles.reminderScheduleDateTitle}>
                    {formatReminderDayHeading(selectedReminderDay)}
                  </Text>
                  <Text style={styles.reminderScheduleDateMeta}>
                    {formatReminderDayMeta(selectedReminderDay, currentTime)}
                  </Text>
                </View>

                <Pressable
                  accessibilityLabel="Show next day reminders"
                  accessibilityRole="button"
                  onPress={() => {
                    setSelectedReminderDay(previousDay =>
                      addDaysToTimestamp(previousDay, 1),
                    );
                  }}
                  style={({pressed}) => [
                    styles.reminderScheduleNavButton,
                    pressed ? styles.pressed : null,
                  ]}>
                  <FeatherIcons color="#17375A" name="chevron-right" size={24} />
                </Pressable>
              </View>

              <View style={styles.reminderSummaryRow}>
                <ReminderStatCard
                  accentColor="#17375A"
                  borderColor="#E6EDF4"
                  label="Total"
                  value={remindersForSelectedDay.length}
                />
                <ReminderStatCard
                  accentColor={reminderScheduleMint}
                  borderColor="#D8F4EF"
                  label="Done"
                  value={completedReminderCount}
                />
                <ReminderStatCard
                  accentColor={reminderScheduleRose}
                  borderColor="#F7D8DC"
                  label="Missed"
                  value={missedReminderCount}
                />
              </View>
            </View>
          )}
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            activeTab === 'home' ? styles.homeContent : null,
            activeTab === 'reminders' ? styles.remindersContent : null,
          ]}
          scrollEnabled={activeTab === 'reminders'}
          showsVerticalScrollIndicator={activeTab === 'reminders'}>
          {activeTab === 'home' ? (
            <>
              <Pressable
                accessibilityLabel="Talk to Buddi"
                accessibilityRole="button"
                onPress={openBudiiModal}
                style={({pressed}) => [
                  styles.buddiActionButton,
                  voiceReady
                    ? styles.buddiActionButtonReady
                    : styles.buddiActionButtonOffline,
                  pressed ? styles.pressed : null,
                ]}>
                <View style={styles.buddiActionContent}>
                  <View style={styles.buddiActionIconWrap}>
                    {buddiPulseActive ? (
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.buddiActionIconPulse,
                          {
                            opacity: buddiPulseOpacity,
                            transform: [{scale: buddiPulseScale}],
                          },
                        ]}
                      />
                    ) : null}
                    <Image
                      resizeMode="contain"
                      source={buddiBotIcon}
                      style={styles.buddiActionIcon}
                    />
                  </View>
                  <Text style={styles.buddiActionTitle}>Talk to Buddi</Text>
                </View>
              </Pressable>

              <View style={styles.assuranceCard}>
                <Text style={styles.assuranceEyebrow}>Safety status</Text>
                <Text style={styles.assuranceTitle}>
                  You&apos;re safe and connected
                </Text>
                <Text style={styles.assuranceBody}>
                  Your caregiver near you.
                </Text>
                <View style={styles.assuranceActionsRow}>
                  <Pressable
                    accessibilityLabel={`Call Annie on ${caregiverPhoneNumber}`}
                    accessibilityRole="button"
                    onPress={handleCaregiverCall}
                    style={({pressed}) => [
                      styles.assuranceCallButton,
                      pressed ? styles.pressed : null,
                    ]}>
                    <FeatherIcons color="#FFFFFF" name="phone-call" size={18} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Chat with Annie"
                    accessibilityRole="button"
                    onPress={onOpenCaregiverChat}
                    style={({pressed}) => [
                      styles.assuranceActionButton,
                      pressed ? styles.pressed : null,
                    ]}>
                    <FeatherIcons
                      color="#FFFFFF"
                      name="message-circle"
                      size={18}
                    />
                    <Text style={styles.assuranceActionText}>
                      Chat with Annie
                    </Text>
                  </Pressable>
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.remindersList}>
                {isLoadingReminders ? (
                  <View style={styles.remindersEmptyState}>
                    <ActivityIndicator color={themeBlue} size="small" />
                    <Text style={styles.remindersEmptyTitle}>
                      Loading reminders
                    </Text>
                    <Text style={styles.remindersEmptyBody}>
                      Fetching your care plan from the server.
                    </Text>
                  </View>
                ) : remindersError ? (
                  <View style={styles.remindersEmptyState}>
                    <Text style={styles.remindersEmptyTitle}>
                      Unable to load reminders
                    </Text>
                    <Text style={styles.remindersEmptyBody}>
                      {remindersError}
                    </Text>
                    <Pressable
                      accessibilityLabel="Retry reminders loading"
                      accessibilityRole="button"
                      onPress={() => {
                        loadReminders().catch(() => undefined);
                      }}
                      style={({pressed}) => [
                        styles.assuranceActionButton,
                        pressed ? styles.pressed : null,
                      ]}>
                      <FeatherIcons
                        color="#FFFFFF"
                        name="refresh-cw"
                        size={18}
                      />
                      <Text style={styles.assuranceActionText}>Try again</Text>
                    </Pressable>
                  </View>
                ) : remindersForSelectedDay.length > 0 ? (
                  <View style={styles.reminderTimelineShell}>
                    <View style={styles.reminderTimelineGrid}>
                      {reminderCurrentTimeLineTop !== null ? (
                        <View
                          pointerEvents="none"
                          style={[
                            styles.reminderTimelineNowMarker,
                            {top: reminderCurrentTimeLineTop},
                          ]}>
                          <View style={styles.reminderTimelineNowDot} />
                          <View style={styles.reminderTimelineNowLine} />
                        </View>
                      ) : null}

                      {reminderTimelineRows.map(row => (
                        <View
                          key={`timeline-hour-${row.hour}`}
                          style={[
                            styles.reminderTimelineRow,
                            {minHeight: row.height},
                          ]}>
                          <View style={styles.reminderTimelineHourCell}>
                            <Text style={styles.reminderTimelineHourText}>
                              {formatTimelineHour(row.hour)}
                            </Text>
                          </View>

                          <View style={styles.reminderTimelineEventsCell}>
                            {row.items.map(reminder => {
                              const timelineState = getReminderTimelineState(
                                reminder,
                                currentTime,
                              );
                              const palette = getReminderTimelinePalette(
                                reminder,
                                timelineState,
                              );
                              const alertMeta =
                                timelineState === 'alerting'
                                  ? getReminderAlertMeta(reminder, currentTime)
                                  : null;
                              const isAlertingCard =
                                timelineState === 'alerting';

                              return (
                                <Pressable
                                  key={reminder.id}
                                  accessibilityRole={
                                    isAlertingCard ? 'button' : undefined
                                  }
                                  disabled={!isAlertingCard}
                                  onPress={() => {
                                    silenceReminderAlert(reminder.id);
                                  }}
                                  style={({pressed}) => [
                                    styles.reminderTimelineCard,
                                    {
                                      backgroundColor:
                                        palette.cardBackgroundColor,
                                      borderColor: palette.borderColor,
                                    },
                                    isAlertingCard && pressed
                                      ? styles.pressed
                                      : null,
                                  ]}>
                                  <View
                                    style={[
                                      styles.reminderTimelineCardAccent,
                                      {backgroundColor: palette.accentColor},
                                    ]}
                                  />

                                  <View
                                    style={[
                                      styles.reminderTimelineCardIconWrap,
                                      {
                                        backgroundColor:
                                          palette.iconBackgroundColor,
                                      },
                                    ]}>
                                    <FeatherIcons
                                      color={palette.iconColor}
                                      name={getReminderTimelineIconName(reminder)}
                                      size={20}
                                    />
                                  </View>

                                  <View style={styles.reminderTimelineCardCopy}>
                                    <Text
                                      numberOfLines={1}
                                      style={[
                                        styles.reminderTimelineCardTitle,
                                        {color: palette.titleColor},
                                      ]}>
                                      {reminder.label}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.reminderTimelineCardTime,
                                        {color: palette.metaColor},
                                      ]}>
                                      {formatReminderClockTime(
                                        reminder.scheduledFor,
                                      )}
                                    </Text>
                                    {alertMeta ? (
                                      <Text
                                        numberOfLines={1}
                                        style={[
                                          styles.reminderTimelineCardAlert,
                                          {color: palette.statusColor},
                                        ]}>
                                        {alertMeta}
                                      </Text>
                                    ) : null}
                                  </View>

                                  <Text
                                    style={[
                                      styles.reminderTimelineCardStatus,
                                      {color: palette.statusColor},
                                    ]}>
                                    {getReminderTimelineStatusLabel(
                                      timelineState,
                                    )}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={styles.remindersEmptyState}>
                    <Text style={styles.remindersEmptyTitle}>No tasks yet</Text>
                    <Text style={styles.remindersEmptyBody}>
                      No reminders or medication schedules are planned for this
                      day.
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>

      <View style={styles.bottomTabBar}>
        <BottomTabButton
          active={activeTab === 'home'}
          icon="home"
          onPress={() => setActiveTab('home')}
        />
        <BottomTabButton
          active={activeTab === 'reminders'}
          icon="clipboard"
          onPress={() => setActiveTab('reminders')}
        />
      </View>

      <Modal
        animationType="fade"
        onRequestClose={closeVoiceSurfaceSafely}
        statusBarTranslucent
        transparent
        visible={activeVoiceSurface === 'sos'}>
        <Pressable
          onPress={closeVoiceSurfaceSafely}
          style={styles.modalBackdrop}>
          <Pressable onPress={() => {}} style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderSpacer} />
              <Text style={styles.modalCountdownText}>
                {formatCountdownSeconds(sosCountdownSeconds)}
              </Text>
              <Pressable
                onPress={closeVoiceSurfaceSafely}
                style={({pressed}) => [
                  styles.modalCloseButton,
                  pressed ? styles.pressed : null,
                ]}>
                <FeatherIcons color="#6A7E8F" name="x" size={22} />
              </Pressable>
            </View>

            <View style={styles.modalContentBlock}>
              <Text style={styles.modalTitle}>
                Are you okay? What do you need?
              </Text>
              {displayedTranscript || sosError ? (
                <Text
                  style={[
                    styles.sosTranscriptText,
                    sosError ? styles.transcriptError : null,
                  ]}>
                  {displayedTranscript || sosError}
                </Text>
              ) : null}
            </View>

            <View style={styles.modalMicDock}>
              <Text style={styles.modalMicLabel}>
                {isListening ? 'Listening now...' : 'Tap to start listening'}
              </Text>
              <View style={styles.modalMicHalo}>
                <Pressable
                  onPress={handleMicPress}
                  style={({pressed}) => [
                    styles.modalMicButton,
                    isListening ? styles.modalMicButtonActive : null,
                    pressed ? styles.pressed : null,
                  ]}>
                  <MicGlyph active={isListening} />
                </Pressable>
              </View>

              {sosSuccessMessage ? (
                <Text style={styles.sosSuccessText}>{sosSuccessMessage}</Text>
              ) : null}

              <Pressable
                disabled={isSubmittingSos}
                onPress={() => {
                  submitSosAlert().catch(() => undefined);
                }}
                style={({pressed}) => [
                  styles.sosSubmitButton,
                  isSubmittingSos ? styles.sosSubmitButtonDisabled : null,
                  pressed ? styles.pressed : null,
                ]}>
                <Text style={styles.sosSubmitButtonText}>
                  {isSubmittingSos ? 'Sending...' : 'Send SOS Alert'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={closeVoiceSurfaceSafely}
        transparent
        visible={activeVoiceSurface === 'buddi'}>
        <Pressable
          onPress={closeVoiceSurfaceSafely}
          style={styles.buddiModalBackdrop}>
          <Pressable onPress={() => {}} style={styles.buddiModalSheet}>
            <View style={styles.buddiModalGlowPink} />
            <View style={styles.buddiModalGlowBlue} />

            <View style={styles.buddiModalHeaderRow}>
              <View style={styles.buddiModalHeaderSpacer} />
              <Pressable
                onPress={closeVoiceSurfaceSafely}
                style={({pressed}) => [
                  styles.buddiModalCloseButton,
                  pressed ? styles.pressed : null,
                ]}>
                <Text style={styles.buddiModalCloseButtonText}>X</Text>
              </Pressable>
            </View>

            <View style={styles.buddiModalContentBlock}>
              <View style={styles.buddiModalHeader}>
                <Text style={styles.buddiModalTitle}>
                  {isOffline ? 'You are offline' : 'Hi, how can I help you?'}
                </Text>
                <Text style={styles.buddiModalSubtitle}>
                  {isOffline
                    ? 'Buddi could not reach AISLA Care. Annie is being called now.'
                    : 'Suggestions on what to ask from AISLA Care'}
                </Text>
              </View>

              {isOffline ? (
                <View style={styles.buddiOfflineCard}>
                  <View style={styles.buddiOfflineIconWrap}>
                    <FeatherIcons
                      color="#FFFFFF"
                      name="wifi-off"
                      size={24}
                    />
                  </View>
                  <View style={styles.buddiOfflineCopy}>
                    <Text style={styles.buddiOfflineTitle}>
                      You are offline
                    </Text>
                    <Text style={styles.buddiOfflineBody}>
                      {offlineCaregiverMessage}
                    </Text>
                    <View style={styles.buddiOfflineCallRow}>
                      <FeatherIcons
                        color="#7A1F17"
                        name="phone-call"
                        size={16}
                      />
                      <Text style={styles.buddiOfflineCallText}>
                        {offlineCaregiverStatus || 'Calling Annie now...'}
                      </Text>
                    </View>
                    <Text style={styles.buddiOfflinePhoneText}>
                      Caregiver contact: {caregiverPhoneNumber}
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.buddiSuggestionList}>
                    {sosSuggestions.map((suggestion, index) => (
                      <Pressable
                        key={suggestion}
                        onPress={() => applySuggestion(suggestion)}
                        style={({pressed}) => [
                          styles.buddiSuggestionCard,
                          index === 0 ? styles.buddiSuggestionCardCompact : null,
                          pressed ? styles.pressed : null,
                        ]}>
                        <Text style={styles.buddiSuggestionCardText}>
                          {suggestion}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {displayedTranscript || sosError ? (
                    <View style={styles.buddiTranscriptCard}>
                      <Text
                        style={[
                          styles.transcriptText,
                          sosError ? styles.transcriptError : null,
                        ]}>
                        {displayedTranscript || sosError}
                      </Text>
                    </View>
                  ) : null}
                </>
              )}
            </View>

            <View style={styles.buddiModalMicDock}>
              {isOffline ? (
                <>
                  <View style={styles.buddiOfflineStatusBadge}>
                    <FeatherIcons color="#7A1F17" name="alert-triangle" size={16} />
                    <Text style={styles.buddiOfflineStatusBadgeText}>
                      Emergency offline support active
                    </Text>
                  </View>
                  <Text style={styles.buddiOfflineFooterText}>
                    Buddi switched to direct caregiver calling because the device
                    lost internet access.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.buddiModalMicLabel}>
                    {buddiListeningActive
                      ? 'Listening...'
                      : 'Tap mic to listen'}
                  </Text>
                  <View style={styles.buddiModalMicHalo}>
                    {buddiPulseActive ? (
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.buddiModalMicPulse,
                          {
                            opacity: buddiPulseOpacity,
                            transform: [{scale: buddiPulseScale}],
                          },
                        ]}
                      />
                    ) : null}
                    <Pressable
                      onPress={handleMicPress}
                      style={({pressed}) => [
                        styles.modalMicButton,
                        isListening ? styles.modalMicButtonActive : null,
                        pressed ? styles.pressed : null,
                      ]}>
                      <MicGlyph active={isListening} />
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FBFD',
  },
  topBar: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    backgroundColor: '#F8FBFD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoImage: {
    width: 45,
    height: 45,
  },
  brandText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 21,
    color: '#17375A',
    // letterSpacing: -0.6,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#5B7691',
    marginTop: -6,
  },
  signOutButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenBody: {
    flex: 1,
    position: 'relative',
  },
  content: {
    paddingHorizontal: 24,
    gap: 18,
  },
  homeContent: {
    paddingTop: 375,
    paddingBottom: 12,
  },
  remindersContent: {
    paddingTop: 272,
    paddingBottom: 120,
  },
  fixedSosContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
  },
  fixedReminderScheduleContainer: {
    alignItems: 'stretch',
    paddingBottom: 22,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#B7CADB',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: {width: 0, height: 8},
    elevation: 4,
  },
  fixedReminderButton: {
    alignSelf: 'stretch',
    marginHorizontal: 24,
    marginBottom: 16,
    minHeight: 82,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7EBF7',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  fixedReminderButtonAlerting: {
    borderColor: '#F1B7B1',
    backgroundColor: '#FFF8F7',
    shadowColor: '#8A2D24',
    shadowOpacity: 0.18,
  },
  fixedReminderButtonFadeOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    backgroundColor: themeBlueSoft,
  },
  fixedReminderButtonFadeOverlayAlerting: {
    backgroundColor: '#FFD7D2',
    borderWidth: 1,
    borderColor: '#F1B7B1',
  },
  fixedReminderButtonIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: themeBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixedReminderButtonIconAlerting: {
    backgroundColor: themeRedSoft,
  },
  fixedReminderButtonCopy: {
    flex: 1,
    gap: 2,
  },
  fixedReminderButtonLabel: {
    fontFamily: 'Poppins-Bold',
    fontSize: 11,
    color: themeBlue,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  fixedReminderButtonLabelAlerting: {
    color: themeRed,
  },
  fixedReminderButtonTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    lineHeight: 20,
    color: '#17375A',
  },
  fixedReminderButtonMeta: {
    fontSize: 13,
    color: '#6A7E8F',
  },
  fixedReminderButtonMetaAlerting: {
    color: '#B4372A',
  },
  fixedReminderHeader: {
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 4,
  },
  reminderScheduleHeader: {
    paddingHorizontal: 24,
    paddingTop: 10,
    gap: 18,
  },
  reminderScheduleDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  reminderScheduleNavButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5EDF5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D0DBE5',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 2,
  },
  reminderScheduleDateCopy: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  reminderScheduleDateTitle: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 19,
    color: '#17375A',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  reminderScheduleDateMeta: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: themeBlue,
  },
  reminderSummaryRow: {
    flexDirection: 'row',
    gap: 14,
  },
  reminderSummaryCard: {
    flex: 1,
    minHeight: 98,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#D8E4EE',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
    elevation: 3,
  },
  reminderSummaryValue: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.8,
  },
  reminderSummaryLabel: {
    fontSize: 14,
    color: '#708293',
  },
  bottomTabBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#F8FBFD',
    borderTopWidth: 1,
    borderTopColor: '#D8ECFA',
  },
  bottomTabButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabButtonActive: {
    opacity: 1,
  },
  topSosButton: {
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderRadius: 1000,
    backgroundColor: themeRed,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7A1F17',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 8,
  },
  topSosButtonText: {
    fontFamily: 'Poppins-ExtraBold',
    color: '#FFFFFF',
    fontSize: 54,
    letterSpacing: -0.4,
  },
  buddiActionButton: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buddiActionButtonReady: {
    backgroundColor: themeBlue,
  },
  buddiActionButtonOffline: {
    backgroundColor: '#7A2430',
  },
  buddiActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  buddiActionIconWrap: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buddiActionIconPulse: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  buddiActionIcon: {
    width: 54,
    height: 54,
  },
  buddiActionTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: '#FFFFFF',
    paddingTop: 9,
  },
  sectionTitle: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 25,
    color: '#17375A',
    letterSpacing: -0.8,
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: '#6A7E8F',
  },
  remindersList: {
    gap: 16,
  },
  remindersEmptyState: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCEEF8',
    paddingHorizontal: 18,
    paddingVertical: 22,
    gap: 6,
  },
  remindersEmptyTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 17,
    color: '#17375A',
  },
  remindersEmptyBody: {
    fontSize: 14,
    lineHeight: 22,
    color: '#678196',
  },
  reminderTimelineShell: {
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EEF4',
    shadowColor: '#D3DEE8',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 6},
    elevation: 3,
    overflow: 'hidden',
  },
  reminderTimelineGrid: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  reminderTimelineNowMarker: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  reminderTimelineNowDot: {
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: reminderScheduleMint,
    marginLeft: 70,
  },
  reminderTimelineNowLine: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: reminderScheduleMint,
  },
  reminderTimelineRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
  },
  reminderTimelineHourCell: {
    width: 84,
    paddingTop: 14,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF3F7',
    alignItems: 'flex-start',
  },
  reminderTimelineHourText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 15,
    color: '#707F8F',
  },
  reminderTimelineEventsCell: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderLeftColor: '#EEF3F7',
    borderTopColor: '#EEF3F7',
    gap: 10,
    justifyContent: 'center',
  },
  reminderTimelineCard: {
    position: 'relative',
    minHeight: 72,
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 14,
    paddingLeft: 18,
    paddingRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  reminderTimelineCardAccent: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    left: 0,
    width: 4,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
  },
  reminderTimelineCardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderTimelineCardCopy: {
    flex: 1,
    gap: 2,
  },
  reminderTimelineCardTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    lineHeight: 20,
  },
  reminderTimelineCardTime: {
    fontSize: 13,
  },
  reminderTimelineCardAlert: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
  },
  reminderTimelineCardStatus: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    textAlign: 'right',
    maxWidth: 82,
  },
  reminderCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E3EEF6',
    shadowColor: '#274A67',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 3,
  },
  reminderCardAlerting: {
    borderColor: '#F0B2AA',
    backgroundColor: '#FFF8F7',
    shadowColor: '#8A2D24',
    shadowOpacity: 0.14,
  },
  reminderBadge: {
    width: 70,
    height: 70,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderBadgeAlerting: {
    borderWidth: 1,
    borderColor: '#F0B2AA',
  },
  reminderBadgeText: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 18,
  },
  reminderBody: {
    flex: 1,
    gap: 4,
  },
  reminderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  reminderStatus: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reminderStatusPending: {
    backgroundColor: themeBlueSoft,
  },
  reminderStatusComplete: {
    backgroundColor: themeGreenSoft,
  },
  reminderStatusAlerting: {
    backgroundColor: '#FDE2DE',
  },
  reminderStatusText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 12,
  },
  reminderStatusTextPending: {
    color: themeBlue,
  },
  reminderStatusTextComplete: {
    color: '#FFFFFF',
  },
  reminderStatusTextAlerting: {
    color: themeRed,
  },
  reminderTitle: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 19,
    lineHeight: 24,
    color: '#17375A',
    letterSpacing: -0.4,
  },
  reminderTitleHeader: {
    flex: 1,
    marginRight: 8,
  },
  reminderTime: {
    fontSize: 14,
    color: '#6A7E8F',
  },
  reminderTimeAlerting: {
    color: '#B4372A',
  },
  reminderAlertMessage: {
    fontFamily: 'Poppins-Bold',
    fontSize: 13,
    color: themeRed,
  },
  reminderDescription: {
    fontSize: 15,
    lineHeight: 23,
    color: '#567185',
  },
  assuranceCard: {
    borderRadius: 24,
    padding: 22,
    backgroundColor: '#EEF8FF',
    borderWidth: 1,
    borderColor: '#D4EBFA',
    gap: 8,
  },
  assuranceEyebrow: {
    fontFamily: 'Poppins-Bold',
    fontSize: 13,
    color: themeBlue,
  },
  assuranceTitle: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 23,
    lineHeight: 28,
    color: '#17375A',
    letterSpacing: -0.7,
  },
  assuranceBody: {
    fontSize: 15,
    lineHeight: 24,
    color: '#567185',
  },
  assuranceActionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  assuranceActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#17375A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assuranceActionText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  assuranceCallButton: {
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: '#21A365',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A7C4D',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
    elevation: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(241, 247, 251, 0.82)',
  },
  modalSheet: {
    flex: 1,
    justifyContent: 'space-between',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  modalHeaderSpacer: {
    width: 42,
    height: 42,
  },
  modalCountdownText: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 45,
    color: themeRed,
    letterSpacing: -0.4,
  },
  modalCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.66)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContentBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 24,
  },
  modalTitle: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 32,
    lineHeight: 42,
    color: '#17375A',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  transcriptText: {
    fontSize: 18,
    lineHeight: 29,
    color: '#17375A',
    textAlign: 'left',
  },
  sosTranscriptText: {
    marginTop: 20,
    fontSize: 18,
    lineHeight: 28,
    color: '#17375A',
    textAlign: 'center',
  },
  transcriptError: {
    color: themeRed,
  },
  transcriptPlaceholder: {
    color: '#93A8B7',
  },
  modalMicDock: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 56,
    paddingTop: 20,
    gap: 12,
  },
  modalMicLabel: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    color: '#567185',
  },
  modalMicHalo: {
    width: 78,
    height: 78,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalMicButton: {
    width: 55,
    height: 55,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F7C7C1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 6},
    elevation: 4,
  },
  modalMicButtonActive: {
    backgroundColor: '#FFF3F1',
    borderColor: themeRed,
  },
  buddiModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 40, 57, 0.42)',
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 18,
  },
  buddiModalSheet: {
    position: 'relative',
    backgroundColor: '#F5EEF8',
    borderRadius: 32,
    minHeight: '88%',
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  buddiModalGlowPink: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(242, 197, 222, 0.44)',
    left: -40,
    bottom: -88,
  },
  buddiModalGlowBlue: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: 'rgba(188, 211, 255, 0.44)',
    right: -72,
    bottom: -120,
  },
  buddiModalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  buddiModalHeaderSpacer: {
    width: 42,
    height: 42,
  },
  buddiModalCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buddiModalCloseButtonText: {
    fontFamily: 'Poppins-Medium',
    color: '#6A7E8F',
    fontSize: 20,
  },
  buddiModalContentBlock: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  buddiModalHeader: {
    gap: 14,
  },
  buddiModalTitle: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 26,
    lineHeight: 34,
    color: '#17375A',
    letterSpacing: -0.6,
  },
  buddiModalSubtitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    lineHeight: 25,
    color: '#6A7E8F',
  },
  buddiOfflineCard: {
    marginTop: 26,
    borderRadius: 26,
    backgroundColor: '#FFF1F0',
    borderWidth: 1,
    borderColor: '#F2B8B2',
    padding: 20,
    flexDirection: 'row',
    gap: 14,
    shadowColor: '#B44A40',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 8},
    elevation: 4,
  },
  buddiOfflineIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: themeRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buddiOfflineCopy: {
    flex: 1,
    gap: 8,
  },
  buddiOfflineTitle: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 20,
    lineHeight: 24,
    color: '#8A251E',
  },
  buddiOfflineBody: {
    fontSize: 15,
    lineHeight: 23,
    color: '#8A4A43',
  },
  buddiOfflineCallRow: {
    marginTop: 4,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: '#FFE3E0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buddiOfflineCallText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 13,
    color: '#7A1F17',
  },
  buddiOfflinePhoneText: {
    fontSize: 13,
    color: '#96524A',
  },
  sosSubmitButton: {
    marginTop: 16,
    minHeight: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D93E32',
    paddingHorizontal: 18,
  },
  sosSubmitButtonDisabled: {
    opacity: 0.65,
  },
  sosSubmitButtonText: {
    fontFamily: 'Poppins-Bold',
    color: '#FFFFFF',
    fontSize: 15,
  },
  sosSuccessText: {
    marginTop: 12,
    color: '#1D7A28',
    fontSize: 14,
    textAlign: 'center',
  },
  buddiSuggestionList: {
    marginTop: 26,
    gap: 14,
  },
  buddiSuggestionCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3EAF1',
    backgroundColor: 'rgba(255,255,255,0.78)',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  buddiSuggestionCardCompact: {
    width: '58%',
  },
  buddiSuggestionCardText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    lineHeight: 25,
    color: '#1E2B38',
  },
  buddiTranscriptCard: {
    marginTop: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D8ECFA',
    backgroundColor: 'rgba(255,255,255,0.78)',
    paddingHorizontal: 20,
    paddingVertical: 24,
    minHeight: 130,
    justifyContent: 'flex-start',
  },
  buddiModalMicDock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 20,
    gap: 14,
  },
  buddiModalMicHalo: {
    position: 'relative',
    width: 78,
    height: 78,
    borderRadius: 999,
    backgroundColor: 'rgba(235, 200, 226, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buddiModalMicPulse: {
    position: 'absolute',
    width: 78,
    height: 78,
    borderRadius: 999,
    backgroundColor: 'rgba(217, 62, 50, 0.2)',
  },
  buddiModalMicLabel: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    color: '#567185',
  },
  buddiOfflineStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: '#FFE3E0',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buddiOfflineStatusBadgeText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 13,
    color: '#7A1F17',
  },
  buddiOfflineFooterText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#7F5A55',
    textAlign: 'center',
  },
  micGlyph: {
    width: 14,
    alignItems: 'center',
  },
  micGlyphHead: {
    width: 10,
    height: 14,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: themeRed,
  },
  micGlyphHeadActive: {
    borderColor: '#B9291E',
  },
  micGlyphStem: {
    width: 2,
    height: 8,
    backgroundColor: themeRed,
    borderRadius: 999,
  },
  micGlyphStemActive: {
    backgroundColor: '#B9291E',
  },
  micGlyphBase: {
    width: 10,
    height: 2,
    borderRadius: 999,
    backgroundColor: themeRed,
    marginTop: 2,
  },
  micGlyphBaseActive: {
    backgroundColor: '#B9291E',
  },
  pressed: {
    opacity: 0.85,
  },
});
